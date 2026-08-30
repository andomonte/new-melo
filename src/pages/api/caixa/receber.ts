import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import {
  executarRecebimento,
  executarRecebimentoMulti,
  type ReceberParams,
  type TituloReceber,
} from '@/lib/caixa/receber';
import { gerarComprovante } from '@/lib/financeiro/gerarComprovante';

/**
 * Fase 1 — recebimento do Caixa (dinheiro/PIX/cartão), 1 ou vários títulos.
 * Baixa o(s) título(s), cria os títulos a receber da operadora (cartão), tudo numa transação.
 *
 * POST single: { cod_receb, dataPgto, cod_conta, username, juros?, principalPendente?, pagamentos[] }
 * POST multi:  { titulos: [{cod_receb, principalPendente, juros}], dataPgto, cod_conta, username, pagamentos[] }
 * dryRun: true → roda tudo e dá ROLLBACK, retornando a prévia sem gravar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });

  const body = req.body || {};
  const dryRun = Boolean(body.dryRun);
  const dataPgto = body.dataPgto || new Date().toISOString().slice(0, 10);
  const ehMulti = Array.isArray(body.titulos) && body.titulos.length > 0;

  if (!body.cod_conta || !body.pagamentos?.length) {
    return res.status(400).json({ erro: 'Parâmetros obrigatórios: cod_conta e pagamentos[].' });
  }
  if (!ehMulti && !body.cod_receb) {
    return res.status(400).json({ erro: 'Informe cod_receb (single) ou titulos[] (multi).' });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let resultado: any;
    if (ehMulti) {
      const resultados = await executarRecebimentoMulti(client, {
        titulos: body.titulos as TituloReceber[],
        dataPgto,
        cod_conta: body.cod_conta,
        username: body.username,
        pagamentos: body.pagamentos,
      });
      resultado = { resultados, multi: true };
    } else {
      const single = await executarRecebimento(client, { ...(body as ReceberParams), dataPgto });
      resultado = single;
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      return res.status(200).json({ sucesso: true, simulado: true, mensagem: 'Simulação — nada foi gravado.', ...resultado });
    }

    // Inserir na fila de impressão DANFE (robô 2) para cada fatura envolvida
    try {
      const codRecebs: string[] = [];
      if (ehMulti && resultado.resultados) {
        for (const r of resultado.resultados) {
          if (r.cod_receb) codRecebs.push(r.cod_receb);
        }
      } else if (body.cod_receb) {
        codRecebs.push(body.cod_receb);
      }
      if (codRecebs.length > 0) {
        const faturas = await client.query(
          `SELECT DISTINCT cod_fat FROM dbreceb WHERE cod_receb = ANY($1) AND cod_fat IS NOT NULL`,
          [codRecebs],
        );
        for (const f of faturas.rows) {
          const existe = await client.query(
            `SELECT 1 FROM fin_impressao WHERE imp_aut_id = $1 AND imp_impresso = 'N' LIMIT 1`,
            [f.cod_fat],
          );
          if (existe.rows.length === 0) {
            await client.query(
              `INSERT INTO fin_impressao (imp_aut_id, imp_data, imp_impresso, imp_fila)
               VALUES ($1, NOW(), 'N', 1)`,
              [f.cod_fat],
            );
          }
        }
      }
    } catch (filaErr: any) {
      // Não bloqueia o recebimento se falhar a fila de impressão
      console.error('Aviso: erro ao inserir na fila de impressão DANFE:', filaErr.message);
    }

    // Comprovante de pagamento (fin_autenticacao) — fiel ao Delphi. Não bloqueia o recebimento.
    try {
      let codusrComp: string | null = null;
      if (body.username) {
        const u = await client.query(`SELECT codusr FROM dbusuario WHERE nomeusr = $1 LIMIT 1`, [body.username]);
        codusrComp = u.rows[0]?.codusr ?? null;
      }
      const codRecebs: string[] = ehMulti
        ? (body.titulos as any[]).map((t) => String(t.cod_receb))
        : [String(body.cod_receb)];
      const docs = await client.query(`SELECT cod_receb, nro_doc FROM dbreceb WHERE cod_receb = ANY($1)`, [codRecebs]);
      const nroMap = new Map(docs.rows.map((r: any) => [String(r.cod_receb), r.nro_doc]));
      const itens = ehMulti
        ? (resultado.resultados || []).map((r: any) => ({
            cod_receb: String(r.cod_receb),
            valor: Number(r.baixa?.principalRecebido || 0),
            nro_doc: nroMap.get(String(r.cod_receb)) ?? null,
            valor_areceber: Number(r.baixa?.principalRecebido || 0),
            valor_juros: 0,
            valor_total: Number(r.baixa?.principalRecebido || 0),
          }))
        : [
            {
              cod_receb: String(body.cod_receb),
              valor: Number(resultado?.baixa?.principalRecebido || 0),
              nro_doc: nroMap.get(String(body.cod_receb)) ?? null,
            },
          ];
      const compItens = itens.filter((i: any) => i.cod_receb);
      if (compItens.length > 0) {
        await gerarComprovante(client, { codusr: codusrComp, cod_conta: body.cod_conta, itens: compItens });
      }
    } catch (e) {
      console.warn('Falha ao gerar comprovante (não bloqueia o recebimento):', e);
    }

    await client.query('COMMIT');
    return res.status(200).json({ sucesso: true, simulado: false, mensagem: 'Recebimento efetuado.', ...resultado });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro no recebimento do caixa:', error);
    return res.status(500).json({ erro: 'Erro ao efetuar recebimento', detalhes: error.message });
  } finally {
    client.release();
  }
}
