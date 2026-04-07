// API: Buscar estatísticas financeiras de um cliente
// Retorna: media3Meses, totalDebito, maiorCompra, titulosVencer, titulosVencidos, atrasoMedio

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'ID do cliente obrigatório.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar todas as estatísticas em uma única query
    const result = await client.query(
      `
      SELECT 
        -- Média dos últimos 3 meses
        COALESCE(
          (SELECT AVG(total) 
           FROM dbvenda 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND data >= CURRENT_DATE - INTERVAL '3 months'
          ), 0
        ) as media_3_meses,
        
        -- Maior compra nos últimos 12 meses
        COALESCE(
          (SELECT MAX(total) 
           FROM dbvenda 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND data >= CURRENT_DATE - INTERVAL '12 months'
          ), 0
        ) as maior_compra_12m,
        
        -- Total de débitos não pagos
        COALESCE(
          (SELECT SUM(valor_rec) 
           FROM dbreceb 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND (rec IS NULL OR rec = 'N')
          ), 0
        ) as total_debito,
        
        -- Títulos a vencer
        COALESCE(
          (SELECT SUM(valor_rec) 
           FROM dbreceb 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND (rec IS NULL OR rec = 'N')
             AND dt_venc >= CURRENT_DATE
          ), 0
        ) as titulos_vencer,
        
        -- Títulos vencidos
        COALESCE(
          (SELECT SUM(valor_rec) 
           FROM dbreceb 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND (rec IS NULL OR rec = 'N')
             AND dt_venc < CURRENT_DATE
          ), 0
        ) as titulos_vencidos,
        
        -- Atraso médio
        COALESCE(
          (SELECT AVG(CURRENT_DATE - dt_venc)::INTEGER
           FROM dbreceb 
           WHERE codcli = $1 
             AND (cancel IS NULL OR cancel = 'N')
             AND (rec IS NULL OR rec = 'N')
             AND dt_venc < CURRENT_DATE
          ), 0
        ) as atraso_medio
      `,
      [id],
    );

    const stats = result.rows[0];

    const estatisticas = {
      media3Meses: parseFloat(stats.media_3_meses || 0),
      totalDebito: parseFloat(stats.total_debito || 0),
      maiorCompra: parseFloat(stats.maior_compra_12m || 0),
      titulosVencer: parseFloat(stats.titulos_vencer || 0),
      titulosVencidos: parseFloat(stats.titulos_vencidos || 0),
      atrasoMedio: parseInt(stats.atraso_medio || 0),
    };

    res.status(200).json(estatisticas);
  } catch (error) {
    console.error('Erro ao buscar estatísticas financeiras:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas financeiras',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
