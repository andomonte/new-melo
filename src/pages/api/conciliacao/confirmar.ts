import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { executarRecebimentoMulti, type TituloReceber } from '@/lib/caixa/receber';
import { gerarComprovante } from '@/lib/financeiro/gerarComprovante';
import { salvarApelido } from '@/lib/conciliacao/db';

/**
 * POST /api/conciliacao/confirmar
 * body: { lin_id, titulos: string[], cof_id, cod_conta, usuario, forma? }
 *
 * Confirma a conciliação de UMA linha do extrato: revalida o saldo dos títulos (FOR UPDATE),
 * dá baixa pelo MESMO engine do Caixa (cascata/parcial), gera o comprovante e marca a linha
 * como 'conciliado'. Nunca aplica valor maior que o saldo. Tudo numa transação.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { lin_id, titulos, cof_id, cod_conta, usuario, forma, salvarApelido: memorizar } = req.body || {};
  const codRecebs: string[] = Array.isArray(titulos) ? titulos.map(String).filter(Boolean) : [];
  if (!lin_id || codRecebs.length === 0) return res.status(400).json({ erro: 'Informe lin_id e titulos.' });
  if (!cod_conta) return res.status(400).json({ erro: 'Informe a conta do operador (cod_conta).' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const linRes = await client.query(
      `SELECT lin_valor_cent, lin_status, to_char(lin_data,'YYYY-MM-DD') AS lin_data,
              lin_pagador_doc, lin_pagador_nome
         FROM conc_linha WHERE lin_id = $1`,
      [lin_id],
    );
    if (linRes.rows.length === 0) return res.status(404).json({ erro: 'Linha não encontrada.' });
    const linha = linRes.rows[0];
    if (linha.lin_status === 'conciliado') return res.status(400).json({ erro: 'Linha já conciliada.' });
    if (linha.lin_status === 'duplicado') return res.status(400).json({ erro: 'Linha marcada como duplicada.' });
    const recebidoCent = Number(linha.lin_valor_cent);
    if (recebidoCent <= 0) return res.status(400).json({ erro: 'Valor da linha inválido.' });

    await client.query('BEGIN');

    // Revalida saldo (FOR UPDATE) — outro usuário pode ter baixado nesse meio tempo.
    const tit = await client.query(
      `SELECT cod_receb, nro_doc, codcli,
              ROUND((COALESCE(valor_pgto,0)-COALESCE(valor_rec,0))*100)::bigint AS saldo_cent
         FROM dbreceb
        WHERE cod_receb = ANY($1) AND (cancel IS NULL OR cancel<>'S') AND rec IS DISTINCT FROM 'S'
        FOR UPDATE`,
      [codRecebs],
    );
    if (tit.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Título(s) não estão mais em aberto (saldo mudou).' });
    }
    const nroMap = new Map(tit.rows.map((r: any) => [String(r.cod_receb), r.nro_doc]));
    const saldoMap = new Map(tit.rows.map((r: any) => [String(r.cod_receb), Number(r.saldo_cent)]));
    const totalSaldoCent = tit.rows.reduce((s: number, r: any) => s + Number(r.saldo_cent), 0);
    // Nunca aplicar mais que o saldo total.
    const pagCent = Math.min(recebidoCent, totalSaldoCent);

    const titulosPayload: TituloReceber[] = tit.rows.map((r: any) => ({
      cod_receb: String(r.cod_receb),
      principalPendente: Number(r.saldo_cent) / 100,
      juros: 0,
    }));

    let codusr: string | null = null;
    if (usuario) {
      const u = await client.query(`SELECT codusr FROM dbusuario WHERE nomeusr = $1 LIMIT 1`, [usuario]);
      codusr = u.rows[0]?.codusr ?? null;
    }

    const resultados = await executarRecebimentoMulti(client, {
      titulos: titulosPayload,
      dataPgto: linha.lin_data,
      cod_conta: String(cod_conta),
      username: String(usuario ?? ''),
      pagamentos: [
        { forma: (forma || 'pix') as any, valor: pagCent / 100, cof_id: cof_id ?? null, tipo: '42' } as any,
      ],
    });

    // Comprovante (fin_autenticacao) do que foi efetivamente baixado.
    const itens = (resultados || []).map((r: any) => ({
      cod_receb: String(r.cod_receb),
      valor: Number(r.baixa?.principalRecebido || 0),
      nro_doc: nroMap.get(String(r.cod_receb)) ?? null,
      valor_areceber: Number(r.baixa?.principalRecebido || 0),
      valor_juros: 0,
      valor_total: Number(r.baixa?.principalRecebido || 0),
    })).filter((i: any) => i.cod_receb && i.valor > 0);

    let autId: string | null = null;
    if (itens.length > 0) {
      const comp = await gerarComprovante(client, { codusr, cod_conta: String(cod_conta), itens });
      autId = comp?.aut_id ?? null;
    }

    await client.query(
      `UPDATE conc_linha SET lin_status='conciliado', lin_titulo=$2, lin_aut_id=$3::numeric WHERE lin_id=$1`,
      [lin_id, codRecebs.join(','), autId],
    );

    // Memoriza o pagador → cliente (apelido) para as próximas importações resolverem sozinhas.
    if (memorizar) {
      const codcliTit = tit.rows[0]?.codcli ? String(tit.rows[0].codcli) : null;
      if (codcliTit) {
        await salvarApelido(client, {
          documento: linha.lin_pagador_doc,
          nomeNorm: linha.lin_pagador_nome,
          codcli: codcliTit,
          usuario,
        }).catch(() => {});
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ sucesso: true, aut_id: autId, resultados });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao confirmar conciliação:', error);
    return res.status(500).json({ erro: 'Erro ao confirmar', detalhes: error.message });
  } finally {
    client.release();
  }
}
