import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

/**
 * "Status Compra Cliente" — consulta (igual ao Delphi).
 * Mostra a data da última compra e a maior compra (data + total).
 * Fonte: dbvenda com status='F' (faturada) e cancel='N'.
 *
 * IMPORTANTE: NÃO edita a coluna dbclien.status (essa é o status de crédito
 * '1'/'2'). No Delphi esta ação é apenas uma consulta.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Método ${req.method} não permitido` });
  }

  const pool = getPgPool(filial);

  try {
    // Data da última compra faturada
    const ultima = await pool.query(
      `SELECT TO_CHAR(MAX(data), 'DD/MM/YYYY') AS data
         FROM dbvenda
        WHERE codcli = $1 AND status = 'F' AND COALESCE(cancel, 'N') = 'N'`,
      [id],
    );

    // Maior compra faturada (data + total)
    const maior = await pool.query(
      `SELECT TO_CHAR(data, 'DD/MM/YYYY') AS data, COALESCE(total, 0) AS total
         FROM dbvenda
        WHERE codcli = $1 AND status = 'F' AND COALESCE(cancel, 'N') = 'N'
        ORDER BY total DESC
        LIMIT 1`,
      [id],
    );

    return res.status(200).json({
      ultimaCompraData: ultima.rows[0]?.data || null,
      maiorCompraData: maior.rows[0]?.data || null,
      maiorCompraTotal: maior.rows[0] ? Number(maior.rows[0].total) : 0,
    });
  } catch (error) {
    console.error('Erro ao consultar status de compra:', error);
    return res.status(500).json({
      error: 'Erro ao consultar status de compra',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
