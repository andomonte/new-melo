// src/pages/api/products/searchPaginated.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function searchProductsPaginated(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: Filial não informada no cookie.');
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const { search = '', page = '1', perPage = '10', PRVENDA = '0' } = req.query;

  const searchTerm = search as string;
  const currentPage = parseInt(page as string, 10);
  const itemsPerPage = parseInt(perPage as string, 10);
  const tipoCliente = PRVENDA as string;

  if (isNaN(currentPage) || currentPage < 1) {
    return res.status(400).json({ error: 'Parâmetro "page" inválido.' });
  }
  if (isNaN(itemsPerPage) || itemsPerPage < 1) {
    return res.status(400).json({ error: 'Parâmetro "perPage" inválido.' });
  }

  const offset = (currentPage - 1) * itemsPerPage;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Query para obter os dados paginados
    // RENOMEIE AS COLUNAS NO SELECT PARA CAIXA BAIXA OU O NOME ESPERADO NO FRONTEND
    const dataQuerySql = `
      SELECT
          p.ref AS ref, -- Adicionado 'AS ref' para garantir caixa baixa
          p.codgpe AS codgpf, -- Mapeia codgpe do BD para codgpf na interface
          p.codprod AS codprod,
          p.descr AS descr,
          p.qtest AS qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel, -- Certifique-se que qtddisponivel está na sua interface se for usá-la
          p.dolar AS dolar,
         m.descr "MARCA",
          fp."PRECOVENDA"
          FROM dbprod p
          JOIN DBMARCAS M ON m.codmarca=p.codmarca
          JOIN dbformacaoprvenda fp ON p.codprod = fp."CODPROD"
          WHERE fp."PRECOVENDA" > 0
          AND (p.descr ILIKE $1 OR p.ref ILIKE $2)
          AND fp."TIPOPRECO" = $3
      ORDER BY qtddisponivel DESC
      LIMIT $4 OFFSET $5;
    `;

    // Query para obter a contagem total de itens (inalterada)
    const countQuerySql = `
      SELECT COUNT(*)
      FROM dbprod p
      JOIN cmp_produto cp ON p.codprod = cp."CODPROD"
      JOIN dbformacaoprvenda fp ON p.codprod = fp."CODPROD"
      WHERE fp."PRECOVENDA" > 0
          AND (p.descr ILIKE $1 OR p.ref ILIKE $2)
          AND fp."TIPOPRECO" = $3;
    `;

    const queryParams = [
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      tipoCliente,
      itemsPerPage,
      offset,
    ];

    const countQueryParams = [
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      tipoCliente,
    ];

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuerySql, queryParams),
      client.query(countQuerySql, countQueryParams),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const products = dataResult.rows; // Agora 'products' já terá as chaves em caixa baixa (ou como definidas no SELECT AS)

    const lastPage = Math.ceil(total / itemsPerPage);

    // REMOVA A LÓGICA DE CONVERTER PARA CAIXA ALTA AQUI
    // const formattedProducts = products.map((item) => {
    //   const formattedItem: { [key: string]: any } = {};
    //   for (const key in item) {
    //     if (Object.prototype.hasOwnProperty.call(item, key)) {
    //       formattedItem[key.toUpperCase()] = item[key];
    //     }
    //   }
    //   return serializeBigInt(formattedItem);
    // });

    // Use os produtos diretamente, pois já foram mapeados no SELECT SQL
    res.status(200).json({
      data: serializeBigInt(products), // Aplicar serializeBigInt ao array completo, se necessário
      meta: {
        total: total,
        lastPage: lastPage,
        currentPage: currentPage,
        perPage: itemsPerPage,
      },
    });
  } catch (error) {
    console.error('ERRO no API Route (searchPaginated):', error);
    res
      .status(500)
      .json({ error: 'Erro ao buscar dados dos produtos paginados.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
