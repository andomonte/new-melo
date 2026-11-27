/**
 * GET /api/devolucao/pendentes
 * Devoluções de compra do web aguardando emissão da NF (alerta do Faturamento: contador no
 * menu "Devolução" e aviso quando chega uma nova). Leve: só contagem + a mais recente.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const pool = await getPgPoolFilial(req);
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total,
              MAX(d.dev_id)::text AS ultimo,
              (SELECT json_build_object('devId', x.dev_id::text, 'obs', x.dev_obs, 'fornecedor', f.nome)
                 FROM fat_devolucao x
                 LEFT JOIN dbent e ON e.codent = x.dev_coddoc
                 LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor
                WHERE x.dev_origem = 'WEB' AND x.dev_status = 'A' AND COALESCE(x.dev_cancel,'N') <> 'S'
                ORDER BY x.dev_id DESC LIMIT 1) AS recente
         FROM fat_devolucao d
        WHERE d.dev_origem = 'WEB' AND COALESCE(d.dev_cancel,'N') <> 'S'
          AND (d.dev_status = 'A' OR (d.dev_origem = 'WEB' AND d.dev_status = 'F' AND d.dev_codfat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbfat_nfe n WHERE n.codfat = d.dev_codfat AND n.status = '100')))`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(r.rows[0]);
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Erro ao consultar devoluções pendentes' });
  }
}
