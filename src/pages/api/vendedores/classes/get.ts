// src/pages/api/vendedores/classes/get.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Importe sua função serializeBigInt
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '10', search = '' }: GetParams = req.query; // Ajustado perPage para 10 como padrão
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // Assumindo que a filial_melo é necessária para selecionar o pool correto

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão para a filial
    client = await pool.connect(); // Conecta ao banco de dados

    const pageNumber = parseInt(page, 10);
    const perPageNumber = parseInt(perPage, 10);
    const offset = (pageNumber - 1) * perPageNumber;
    const searchTerm = `%${search}%`; // Padrão de busca para ILIKE

    // --- Consulta para buscar as classes de vendedor com paginação e filtro ---
    // A tabela é 'dbclassevendedor' e as colunas são 'codcv' e 'descr'.
    const classesVendedorResult = await client.query(
      `
      SELECT
          codcv,
          descr
      FROM dbclassevendedor -- <-- Nome da sua tabela de classes de vendedor
      WHERE
          LOWER(CAST(codcv AS TEXT)) LIKE LOWER($1) -- Busca por codcv
          OR
          LOWER(descr) LIKE LOWER($1) -- Busca por descr
      ORDER BY descr -- Ou codcv, o que for mais relevante para ordenação padrão
      OFFSET $2
      LIMIT $3
    `,
      [searchTerm, offset, perPageNumber],
    );

    const classesVendedor = classesVendedorResult.rows;

    // --- Consulta para obter a contagem total de classes de vendedor (para a paginação) ---
    const countResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM dbclassevendedor -- <-- Nome da sua tabela de classes de vendedor
      WHERE
          LOWER(CAST(codcv AS TEXT)) LIKE LOWER($1)
          OR
          LOWER(descr) LIKE LOWER($1)
    `,
      [searchTerm],
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Retorna os dados e metadados da paginação
    res.status(200).json({
      data: classesVendedor.map((classe) => serializeBigInt(classe)), // Aplica serializeBigInt
      meta: {
        total: total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar classes de vendedor:', error);
    res.status(500).json({ error: 'Erro ao buscar classes de vendedor' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}
