import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { atualizarFaixaPreco, type ModoAtualizacao } from '@/lib/produtos/politicaPreco';

/**
 * POST /api/produtos/politica-preco/atualizar
 * Body: { codprod, tipoPreco, modo?: 'MARGEM' | 'PRECO', valor }  (legado: { margem })
 *
 * Edita UMA faixa (tipo de preço) da Análise de Margem e grava na hora — modelo Delphi
 * ATUALIZAR_PRECO: MARGEM recalcula o preço; PRECO recalcula a margem.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { codprod, tipoPreco } = req.body || {};
  const modo: ModoAtualizacao = req.body?.modo === 'PRECO' ? 'PRECO' : 'MARGEM';
  const valor = Number(req.body?.valor ?? req.body?.margem);
  const tp = Number(tipoPreco);
  if (!codprod || tipoPreco === undefined || tipoPreco === null || Number.isNaN(tp) || Number.isNaN(valor)) {
    return res.status(400).json({ error: 'codprod, tipoPreco e valor são obrigatórios' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();
    await client.query('BEGIN');
    const r = await atualizarFaixaPreco(client, String(codprod), tp, modo, valor);
    await client.query('COMMIT');
    return res.status(200).json({ success: true, ...r });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Erro ao atualizar política de preço:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.',
    });
  } finally {
    if (client) client.release();
  }
}
