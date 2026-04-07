import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface NFeStatusAssociacao {
  nfeId: string;
  totalItens: number;
  itensAssociados: number;
  percentual: number;
  status: 'NAO_INICIADA' | 'PARCIAL' | 'COMPLETA';
}

interface StatusResponse {
  success: boolean;
  data?: NFeStatusAssociacao[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeIds } = req.query;

  if (!nfeIds || typeof nfeIds !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'nfeIds é obrigatório (ex: nfeIds=123,456,789)'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const nfeIdsArray = nfeIds.split(',').map(id => id.trim());

    console.log(`🔍 Buscando status de associação para ${nfeIdsArray.length} NFe(s)`);

    // Query para buscar status de todas as NFes de uma vez
    const statusResult = await client.query(`
      WITH nfe_total_itens AS (
        SELECT
          codnfe_ent as nfe_id,
          COUNT(*) as total_itens
        FROM dbnfe_ent_det
        WHERE codnfe_ent = ANY($1::varchar[])
        GROUP BY codnfe_ent
      ),
      nfe_itens_associados AS (
        SELECT
          nfe_id,
          COUNT(*) as itens_associados
        FROM nfe_item_associacao
        WHERE nfe_id = ANY($1::varchar[])
        GROUP BY nfe_id
      )
      SELECT
        t.nfe_id,
        t.total_itens,
        COALESCE(a.itens_associados, 0) as itens_associados,
        CASE
          WHEN COALESCE(a.itens_associados, 0) = 0 THEN 'NAO_INICIADA'
          WHEN COALESCE(a.itens_associados, 0) >= t.total_itens THEN 'COMPLETA'
          ELSE 'PARCIAL'
        END as status,
        CASE
          WHEN t.total_itens > 0 THEN
            ROUND((COALESCE(a.itens_associados, 0)::numeric / t.total_itens::numeric) * 100, 2)
          ELSE 0
        END as percentual
      FROM nfe_total_itens t
      LEFT JOIN nfe_itens_associados a ON t.nfe_id = a.nfe_id
      ORDER BY t.nfe_id
    `, [nfeIdsArray]);

    const statusData: NFeStatusAssociacao[] = statusResult.rows.map((row: any) => ({
      nfeId: row.nfe_id,
      totalItens: parseInt(row.total_itens),
      itensAssociados: parseInt(row.itens_associados),
      percentual: parseFloat(row.percentual),
      status: row.status
    }));

    console.log(`✅ Status calculado para ${statusData.length} NFe(s)`);

    return res.status(200).json({
      success: true,
      data: statusData
    });

  } catch (err) {
    console.error('❌ Erro ao buscar status de associação:', err);

    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar status de associação'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
