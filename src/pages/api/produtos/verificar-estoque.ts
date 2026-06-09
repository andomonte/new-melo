import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod } = req.query;

  if (!codprod || typeof codprod !== 'string' || !codprod.trim()) {
    return res.status(400).json({ error: 'codprod é obrigatório' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const result = await client.query(
      `SELECT COALESCE(SUM(COALESCE(arp_qtest, 0)), 0) as estoque
       FROM cad_armazem_produto
       WHERE arp_codprod = $1`,
      [codprod.trim()],
    );

    const quantidade = parseFloat(result.rows[0]?.estoque || '0');

    return res.status(200).json({
      temEstoque: quantidade > 0,
      quantidade,
    });
  } catch (error: any) {
    console.error('Erro ao verificar estoque do produto:', error);
    return res.status(500).json({
      error: 'Erro ao verificar estoque',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
