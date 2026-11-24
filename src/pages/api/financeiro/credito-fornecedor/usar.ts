import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { CreditoValidacaoError, usarCredito } from '@/lib/compras/creditoFornecedor';

/**
 * Crédito de Fornecedor — "Usar crédito": baixa títulos em aberto do fornecedor/filiais com o
 * crédito do grupo (forma Z ABATIMENTO DE SALDO, conta 0128; não mexe em caixa nem banco).
 *   POST { grupo, itens: [{ cod_pgto, valor }], obs?, usuario? }
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { grupo, itens, obs, usuario } = req.body || {};
  if (!grupo || !Array.isArray(itens)) return res.status(400).json({ erro: 'Informe o fornecedor e os títulos.' });
  const quem = usuario || parseCookies({ req }).userName || 'Sistema';
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await usarCredito(db, String(grupo), itens, String(quem), obs);
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof CreditoValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao usar crédito de fornecedor:', e);
    return res.status(500).json({ erro: 'Erro ao usar o crédito', detalhes: e?.message });
  } finally {
    db.release();
  }
}
