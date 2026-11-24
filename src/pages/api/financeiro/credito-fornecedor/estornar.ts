import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { CreditoValidacaoError, estornarBaixaComCredito } from '@/lib/compras/creditoFornecedor';

/**
 * Crédito de Fornecedor — estorno de uma baixa feita com crédito: cancela o lançamento no
 * histórico do título, devolve o valor ao crédito e refaz o pago do título.
 *   POST { cod_pgto, fpg_cof_id, motivo, usuario? }   (motivo obrigatório)
 * O consumo do crédito por uma NF não se estorna aqui: reconfigure o pagamento da NF.
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const { cod_pgto, fpg_cof_id, motivo, usuario } = req.body || {};
  if (!cod_pgto || !fpg_cof_id) return res.status(400).json({ erro: 'Informe o título e o lançamento.' });
  const quem = usuario || parseCookies({ req }).userName || 'Sistema';
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await estornarBaixaComCredito(db, String(cod_pgto), fpg_cof_id, String(motivo || ''), String(quem));
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, ...r });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof CreditoValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao estornar uso de crédito:', e);
    return res.status(500).json({ erro: 'Erro ao estornar o uso do crédito', detalhes: e?.message });
  } finally {
    db.release();
  }
}
