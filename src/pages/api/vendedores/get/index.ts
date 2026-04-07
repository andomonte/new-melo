// src/pages/api/vendedores/get.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Importe sua função serializeBigInt
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
  filtros?: { campo: string; tipo: string; valor: string }[];
}

function buildWhereClause(
  filtros: { campo: string; tipo: string; valor: string }[],
  baseIndex: number = 1,
) {
  if (!filtros || filtros.length === 0) return { whereClause: '', params: [] };

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = baseIndex;

  filtros.forEach((filtro) => {
    const { campo, tipo, valor } = filtro;

    switch (tipo) {
      case 'igual':
        conditions.push(`"${campo}" = $${paramIndex}`);
        params.push(valor);
        paramIndex++;
        break;
      case 'contém':
        conditions.push(`LOWER("${campo}"::text) LIKE LOWER($${paramIndex})`);
        params.push(`%${valor}%`);
        paramIndex++;
        break;
      case 'começa':
        conditions.push(`LOWER("${campo}"::text) LIKE LOWER($${paramIndex})`);
        params.push(`${valor}%`);
        paramIndex++;
        break;
      case 'termina':
        conditions.push(`LOWER("${campo}"::text) LIKE LOWER($${paramIndex})`);
        params.push(`%${valor}`);
        paramIndex++;
        break;
      case 'diferente':
        conditions.push(`"${campo}" != $${paramIndex}`);
        params.push(valor);
        paramIndex++;
        break;
      case 'maior':
        conditions.push(`"${campo}" > $${paramIndex}`);
        params.push(parseFloat(valor) || 0);
        paramIndex++;
        break;
      case 'menor':
        conditions.push(`"${campo}" < $${paramIndex}`);
        params.push(parseFloat(valor) || 0);
        paramIndex++;
        break;
      case 'maior_igual':
        conditions.push(`"${campo}" >= $${paramIndex}`);
        params.push(parseFloat(valor) || 0);
        paramIndex++;
        break;
      case 'menor_igual':
        conditions.push(`"${campo}" <= $${paramIndex}`);
        params.push(parseFloat(valor) || 0);
        paramIndex++;
        break;
      case 'nulo':
        conditions.push(`"${campo}" IS NULL`);
        break;
      case 'nao_nulo':
        conditions.push(`"${campo}" IS NOT NULL`);
        break;
    }
  });

  const whereClause =
    conditions.length > 0 ? `AND (${conditions.join(' AND ')})` : '';
  return { whereClause, params };
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method === 'GET') {
    // Mantém compatibilidade com GET para busca simples
    const { page = '1', perPage = '10', search = '' }: GetParams = req.query;

    const cookies = parseCookies({ req });
    const filial = cookies.filial_melo;

    if (!filial) {
      return res.status(400).json({ error: 'Filial não informada no cookie' });
    }

    let client: PoolClient | undefined;

    try {
      const pool = getPgPool(filial);
      client = await pool.connect();

      const pageNumber = parseInt(page, 10);
      const perPageNumber = parseInt(perPage, 10);
      const offset = (pageNumber - 1) * perPageNumber;
      const searchTerm = `%${search}%`;

      const vendedoresResult = await client.query(
        `
        SELECT
            codvend,
            nome AS "NOMERAZAO",
            nome,
            valobj,
            comnormal,
            comtele,
            debito,
            credito,
            limite,
            status,
            codcv,
            comobj,
            valobjf,
            valobjm,
            valobjsf,
            ra_mat
        FROM dbvend
        WHERE
            LOWER(CAST(codvend AS TEXT)) LIKE LOWER($1)
            OR
            LOWER(COALESCE(nome, '')) LIKE LOWER($1)
        ORDER BY COALESCE(nome, codvend)
        OFFSET $2
        LIMIT $3
      `,
        [searchTerm, offset, perPageNumber],
      );

      const vendedores = vendedoresResult.rows;

      const countResult = await client.query(
        `
        SELECT COUNT(*) as total
        FROM dbvend
        WHERE
            LOWER(CAST(codvend AS TEXT)) LIKE LOWER($1)
            OR
            LOWER(COALESCE(nome, '')) LIKE LOWER($1)
      `,
        [searchTerm],
      );
      const total = parseInt(countResult.rows[0].total, 10);

      res.status(200).json({
        data: vendedores.map((vendedor) => serializeBigInt(vendedor)),
        meta: {
          total: total,
          lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
          currentPage: total > 0 ? pageNumber : 1,
          perPage: perPageNumber,
        },
      });
    } catch (error) {
      console.error('Erro ao obter vendedores:', error);
      res.status(500).json({ error: 'Erro ao obter vendedores.' });
    } finally {
      if (client) {
        client.release();
      }
    }
  } else if (req.method === 'POST') {
    // Nova funcionalidade para filtros avançados
    const { page = 1, perPage = 10, search = '', filtros = [] } = req.body;

    const cookies = parseCookies({ req });
    const filial = cookies.filial_melo;

    if (!filial) {
      return res.status(400).json({ error: 'Filial não informada no cookie' });
    }

    let client: PoolClient | undefined;

    try {
      const pool = getPgPool(filial);
      client = await pool.connect();

      const pageNumber = parseInt(page, 10);
      const perPageNumber = parseInt(perPage, 10);
      const offset = (pageNumber - 1) * perPageNumber;

      const baseParams: any[] = [];
      let searchCondition = '';
      let paramIndex = 1;

      // Condição de busca global se fornecida
      if (search && search.trim()) {
        const searchTerm = `%${search}%`;
        searchCondition = `WHERE (LOWER(CAST(codvend AS TEXT)) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(nome, '')) LIKE LOWER($${paramIndex}))`;
        baseParams.push(searchTerm);
        paramIndex++;
      } else {
        searchCondition = 'WHERE 1=1';
      }

      // Adiciona filtros avançados
      const { whereClause, params: filtroParams } = buildWhereClause(
        filtros,
        paramIndex,
      );

      const allParams = [...baseParams, ...filtroParams, offset, perPageNumber];
      const offsetParamIndex = baseParams.length + filtroParams.length + 1;
      const limitParamIndex = offsetParamIndex + 1;

      const vendedoresResult = await client.query(
        `
        SELECT
            codvend,
            nome AS "NOMERAZAO",
            nome,
            valobj,
            comnormal,
            comtele,
            debito,
            credito,
            limite,
            status,
            codcv,
            comobj,
            valobjf,
            valobjm,
            valobjsf,
            ra_mat
        FROM dbvend
        ${searchCondition}
        ${whereClause}
        ORDER BY COALESCE(nome, codvend)
        OFFSET $${offsetParamIndex}
        LIMIT $${limitParamIndex}
      `,
        allParams,
      );

      const vendedores = vendedoresResult.rows;

      // Count query para paginação
      const countParams = [...baseParams, ...filtroParams];
      const countResult = await client.query(
        `
        SELECT COUNT(*) as total
        FROM dbvend
        ${searchCondition}
        ${whereClause}
      `,
        countParams,
      );
      const total = parseInt(countResult.rows[0].total, 10);

      res.status(200).json({
        data: vendedores.map((vendedor) => serializeBigInt(vendedor)),
        meta: {
          total: total,
          lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
          currentPage: total > 0 ? pageNumber : 1,
          perPage: perPageNumber,
        },
      });
    } catch (error) {
      console.error('Erro ao obter vendedores:', error);
      res.status(500).json({ error: 'Erro ao obter vendedores.' });
    } finally {
      if (client) {
        client.release();
      }
    }
  } else {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
}
