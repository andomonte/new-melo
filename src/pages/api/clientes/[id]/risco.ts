import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
      // Return zeros if no ID (new client)
      return res.status(200).json({
        totalVencido: 0,
        maiorCompra: 0,
        mediaAtraso: 0,
        primeiraCompra: null,
        ultimaCompra: null
      });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  const pool = getPgPool(filial);

  try {
    const client = await pool.connect();
    try {
        // 1. Total Vencido (Overdue)
        // dt_venc < today AND (dt_pgto IS NULL) AND cancel != 'S'
        const overdueQuery = `
            SELECT SUM(COALESCE(valor_pgto, 0) - COALESCE(valor_rec, 0)) as total
            FROM dbreceb
            WHERE codcli = $1
            AND dt_venc < CURRENT_DATE
            AND dt_pgto IS NULL
            AND (cancel IS NULL OR cancel != 'S')
        `;
        const overdueRes = await client.query(overdueQuery, [id]);
        const totalVencido = Number(overdueRes.rows[0]?.total || 0);

        // 2. Maior Compra (Last 12 months)
        const maxPurchaseQuery = `
            SELECT MAX(valor_pgto) as max_val
            FROM dbreceb
            WHERE codcli = $1
            AND dt_emissao >= (CURRENT_DATE - INTERVAL '12 months')
            AND (cancel IS NULL OR cancel != 'S')
        `;
        const maxRes = await client.query(maxPurchaseQuery, [id]);
        const maiorCompra = Number(maxRes.rows[0]?.max_val || 0);

        // 3. Média Atraso (Average Delay Days)
        // Only for paid bills that were late
        const avgDelayQuery = `
            SELECT AVG(dt_pgto - dt_venc) as avg_delay
            FROM dbreceb
            WHERE codcli = $1
            AND dt_pgto IS NOT NULL
            AND dt_pgto > dt_venc
            AND (cancel IS NULL OR cancel != 'S')
        `;
        const avgRes = await client.query(avgDelayQuery, [id]);
        const mediaAtraso = Math.round(Number(avgRes.rows[0]?.avg_delay || 0));

        // 4. History (First/Last Purchase)
        const historyQuery = `
            SELECT MIN(dt_emissao) as first_buy, MAX(dt_emissao) as last_buy
            FROM dbreceb
            WHERE codcli = $1
            AND (cancel IS NULL OR cancel != 'S')
        `;
        const histRes = await client.query(historyQuery, [id]);
        
        const formatDate = (date: any) => {
            if (!date) return null;
            const d = new Date(date);
            return d.toLocaleDateString('pt-BR');
        };

        res.status(200).json({
            totalVencido,
            maiorCompra,
            mediaAtraso,
            primeiraCompra: formatDate(histRes.rows[0]?.first_buy),
            ultimaCompra: formatDate(histRes.rows[0]?.last_buy)
        });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching client risk:', error);
    res.status(500).json({ error: 'Error fetching risk data' });
  }
}
