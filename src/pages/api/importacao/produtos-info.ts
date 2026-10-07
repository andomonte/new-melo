/**
 * GET /api/importacao/produtos-info?codprods=123,456
 *
 * Retorna Referência (dbprod.ref) e Marca (dbmarcas.descr) de uma lista de códigos
 * de produto, para a tela de Importação exibir essas infos nos itens associados —
 * independentemente de como a associação foi feita (manual, auto, pedido).
 *
 * Resposta: { map: { "<codprod>": { referencia, marca } } }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const raw = String(req.query.codprods || '');
  const codprods = Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean)));
  if (codprods.length === 0) {
    return res.status(200).json({ map: {} });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  try {
    const result = await pool.query(
      `SELECT p.codprod, p.ref, COALESCE(m.descr, '') AS marca
         FROM dbprod p
         LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
        WHERE p.codprod = ANY($1::varchar[])`,
      [codprods],
    );

    const map: Record<string, { referencia: string | null; marca: string | null }> = {};
    for (const row of result.rows) {
      map[String(row.codprod)] = {
        referencia: row.ref || null,
        marca: row.marca || null,
      };
    }

    return res.status(200).json({ map });
  } catch (error: any) {
    console.error('Erro ao buscar info de produtos:', error);
    return res.status(500).json({ message: error.message || 'Erro ao buscar info de produtos' });
  }
}
