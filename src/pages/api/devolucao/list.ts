/**
 * GET /api/devolucao/list
 * Lista devoluções com filtros opcionais
 *
 * Query params:
 * - busca: busca por numero_entrada, fornecedor ou nfe_numero
 * - status: PENDENTE | EM_PROCESSAMENTO | CONCLUIDA | CANCELADA
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
      conditions.push(
        `(numero_entrada ILIKE $${paramIdx} OR fornecedor ILIKE $${paramIdx} OR nfe_numero ILIKE $${paramIdx})`,
      );
      params.push(`%${busca}%`);
      paramIdx++;
    }

    if (status && ['PENDENTE', 'EM_PROCESSAMENTO', 'CONCLUIDA', 'CANCELADA'].includes(status)) {
      conditions.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM devolucoes ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(
      `SELECT
        id, entrada_id, numero_entrada, fornecedor, nfe_numero, nfe_serie,
        status, total_itens, qtd_total_devolucao, observacao,
        created_by, created_at, updated_at
      FROM devolucoes
      ${where}
      ORDER BY created_at DESC
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
    console.error('Erro ao listar devoluções:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao listar devoluções',
    });
  }
}
