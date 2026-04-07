// pages/api/inscricoesEstaduais/get.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const {
    page = '1',
    perPage = '10',
    search = '',
    cgc = '',
  } = req.query as {
    page?: string;
    perPage?: string;
    search?: string;
    cgc?: string;
  };

  const pageNum = parseInt(page, 10);
  const perPageNum = parseInt(perPage, 10);
  const offset = (pageNum - 1) * perPageNum;

  try {
    const pool = getPgPool(filial);
    const client = await pool.connect();

    try {
      // Construir WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtro por CGC se fornecido
      if (cgc) {
        conditions.push(`ie.cgc = $${paramIndex}`);
        params.push(cgc);
        paramIndex++;
      }

      // Filtro de busca (por inscrição estadual ou nome do contribuinte)
      if (search) {
        conditions.push(
          `(ie.inscricaoestadual ILIKE $${paramIndex} OR ie.nomecontribuinte ILIKE $${paramIndex})`,
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM db_ie ie
        ${whereClause}
      `;

      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Query para buscar dados paginados
      const dataQuery = `
        SELECT
          ie.cgc,
          ie.inscricaoestadual,
          ie.nomecontribuinte
        FROM db_ie ie
        ${whereClause}
        ORDER BY ie.nomecontribuinte ASC, ie.inscricaoestadual ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(perPageNum, offset);

      const dataResult = await client.query(dataQuery, params);

      const data = dataResult.rows;

      const meta = {
        page: pageNum,
        perPage: perPageNum,
        total,
        lastPage: Math.ceil(total / perPageNum),
      };

      return res.status(200).json({ data, meta });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao buscar inscrições estaduais:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar inscrições estaduais' });
  }
}
