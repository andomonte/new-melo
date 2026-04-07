/**
 * GET /api/importacao/list
 * Lista importações com filtros opcionais
 *
 * Query params:
 * - busca: busca por nro_di ou navio
 * - status: N | E | C
 * - page: número da página (default 1)
 * - limit: itens por página (default 25)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const busca = (req.query.busca as string) || '';
  const status = (req.query.status as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  const offset = (page - 1) * limit;

  const pool = getPgPool(filial);

  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (busca) {
      conditions.push(`(nro_di ILIKE $${paramIdx} OR navio ILIKE $${paramIdx})`);
      params.push(`%${busca}%`);
      paramIdx++;
    }

    if (status && ['N', 'E', 'C'].includes(status)) {
      conditions.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM db_manaus.dbent_importacao ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch rows
    const dataResult = await pool.query(
      `SELECT
        id, nro_di, data_di, status, tipo_die, taxa_dolar,
        total_mercadoria, frete, seguro, thc, total_cif,
        pis_cofins, ii, ipi, siscomex, anuencia,
        peso_liquido, qtd_adicoes, navio,
        data_entrada_brasil, codusr, data_cad
      FROM db_manaus.dbent_importacao
      ${where}
      ORDER BY data_cad DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar importações:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao listar importações',
    });
  }
}
