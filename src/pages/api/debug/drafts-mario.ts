import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let client;
  try {
    const pool = getPgPool('MANAUS');
    client = await pool.connect();

    const result = await client.query(`
      SELECT
        draft_id,
        filial,
        codusr,
        codvend,
        codcli,
        tipo,
        status,
        total,
        label,
        created_at,
        updated_at,
        payload->'header'->>'codusr' as header_codusr,
        payload->'header'->>'vendedor' as header_vendedor,
        payload->'header'->>'operador' as header_operador,
        payload->'header'->>'codcli' as header_codcli,
        payload->'header'->>'uName' as header_uname,
        jsonb_array_length(COALESCE(payload->'itens', '[]'::jsonb)) as qtd_itens
      FROM dbvenda_draft
      WHERE ltrim(codusr::text, '0') = '94'
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      total: result.rows.length,
      drafts: result.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
}
