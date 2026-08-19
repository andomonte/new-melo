import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import {
  executarRecebimento,
  executarRecebimentoMulti,
  type ReceberParams,
  type TituloReceber,
} from '@/lib/caixa/receber';

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
