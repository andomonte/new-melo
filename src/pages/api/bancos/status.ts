import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

/**
 * PATCH/POST /api/bancos/status  { banco, status: 'ativo'|'inativo' }
 * Ativa/inativa um banco de cobrança (dbbanco_cobranca.status).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) return res.status(400).json({ error: 'Filial não informada no cookie' });

  const { banco, status } = req.body || {};
  if (!banco) return res.status(400).json({ error: 'Informe o banco.' });
  if (status !== 'ativo' && status !== 'inativo') {
    return res.status(400).json({ error: "status deve ser 'ativo' ou 'inativo'." });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    const r = await client.query(
      `UPDATE dbbanco_cobranca SET status = $2 WHERE CAST(banco AS TEXT) = $1`,
      [String(banco), status],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Banco não encontrado.' });
    return res.status(200).json({ sucesso: true, banco, status });
  } catch (error: any) {
    console.error('Erro ao alterar status do banco:', error);
    return res.status(500).json({ error: 'Erro ao alterar status do banco' });
  } finally {
    if (client) client.release();
  }
}
