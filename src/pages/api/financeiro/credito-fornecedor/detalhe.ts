import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { detalheGrupo, titulosAbertosDoGrupo } from '@/lib/compras/creditoFornecedor';

/**
 * Crédito de Fornecedor — detalhe do grupo (fornecedor + filiais).
 *   GET ?grupo=45990181                → filiais, créditos, histórico de usos e saldo
 *   GET ?grupo=45990181&titulos=1      → títulos em aberto do fornecedor e das filiais
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const grupo = typeof req.query.grupo === 'string' ? req.query.grupo.trim() : '';
  if (!grupo) return res.status(400).json({ erro: 'Informe o fornecedor (grupo).' });
  try {
    if (req.query.titulos) return res.status(200).json({ titulos: await titulosAbertosDoGrupo(pool, grupo) });
    return res.status(200).json(await detalheGrupo(pool, grupo));
  } catch (e: any) {
    console.error('Erro no detalhe de crédito de fornecedor:', e);
    return res.status(500).json({ erro: 'Erro ao buscar o crédito do fornecedor', detalhes: e?.message });
  }
}
