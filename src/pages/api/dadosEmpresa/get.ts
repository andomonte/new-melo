// src/pages/api/dadosEmpresa/listarDadosEmpresa.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';
import { DBDadosEmpresa } from '@/data/dadosEmpresa/dadosEmpresas';

interface GetParams {
  cgc?: string;
  page?: string;
  perPage?: string;
  search?: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  // Obter parâmetros da query, com valores padrão
  const { cgc, page = '1', perPage = '10', search = '' }: GetParams = req.query;

  // Obter a filial do cookie, pois é necessária para getPgPool
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;

  try {
    // Usar a filial do cookie para obter o pool de conexão
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const offset = (pageNum - 1) * perPageNum;
    const searchTerm = `%${search}%`;

    // --- Construção da query para buscar dados da empresa ---
    let query = `
      SELECT *
      FROM dadosempresa
      WHERE 1=1 -- Cláusula verdadeira para facilitar a adição de condições AND
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1; // Para controlar a indexação dos parâmetros na query

    // Se um CGC específico for fornecido (para busca de um único registro)
    if (cgc) {
      query += ` AND cgc = $${paramIndex++}`;
      params.push(cgc);
    }
    // Se houver termo de busca para listagem (por nomecontribuinte ou cgc)
    else if (search) {
      // Usar 'else if' para evitar conflito com busca por CGC exato
      query += ` AND (nomecontribuinte ILIKE $${paramIndex++} OR cgc ILIKE $${paramIndex++})`;
      params.push(searchTerm);
      params.push(searchTerm);
    }

    // --- Consulta para obter a contagem total (para paginação) ---
    // Precisamos construir a query de contagem com os mesmos filtros da query principal
    let countQuery = `SELECT COUNT(*) as total FROM dadosempresa WHERE 1=1`;
    const countParams: (string | number)[] = [];
    let countParamIndex = 1;

    if (cgc) {
      countQuery += ` AND cgc = $${countParamIndex++}`;
      countParams.push(cgc);
    } else if (search) {
      countQuery += ` AND (nomecontribuinte ILIKE $${countParamIndex++} OR cgc ILIKE $${countParamIndex++})`;
      countParams.push(searchTerm);
      countParams.push(searchTerm);
    }

    const totalResult = await client.query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].total, 10);
    const lastPage = total > 0 ? Math.ceil(total / perPageNum) : 1;

    // --- Adiciona LIMIT e OFFSET para paginação na query principal ---
    query += ` ORDER BY cgc ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(perPageNum);
    params.push(offset);

    const result = await client.query<DBDadosEmpresa>(query, params);

    // Processa os resultados para que 'token' seja booleano e 'certificado' indique se há dados
    const empresasProcessadas = result.rows
      .map((empresa) => {
        // Remove os campos criptografados do objeto para segurança
        const { token, certificadoKey, certificadoCrt, cadeiaCrt, ...restOfEmpresa } = empresa;

        return {
          ...restOfEmpresa, // Todos os outros campos da empresa
          token: token !== null && token !== '', // true se tem valor, false se nulo ou vazio
          certificado: (certificadoKey !== null && certificadoKey !== '') ||
                      (certificadoCrt !== null && certificadoCrt !== '') ||
                      (cadeiaCrt !== null && cadeiaCrt !== ''), // true se tem algum dado de certificado
        };
      })
      .map(serializeBigInt);

    // Retorna a resposta padronizada com data e meta
    res.status(200).json({
      data: empresasProcessadas, // Sempre um array, mesmo que vazio ou com um item
      meta: {
        total: total,
        lastPage: lastPage,
        currentPage: pageNum,
        perPage: perPageNum,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar dados da empresa:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao buscar dados da empresa.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
