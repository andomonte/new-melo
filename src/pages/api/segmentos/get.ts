import { NextApiRequest, NextApiResponse } from 'next';
import { executePaginatedQuery, buildSearchClause } from '@/utils/pg-migration';
import { PoolClient } from 'pg';

import { GetParams } from '@/data/common/getParams';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' }: GetParams = req.query;
  let client: PoolClient | undefined;

  try {
    const searchFields = search ? ['descricao'] : [];
    const { clause: searchClause, params: searchParams } = buildSearchClause(String(search), searchFields);

    const result = await executePaginatedQuery(
      'dbsegmento',
      'codsegmento, descricao',
      searchClause,
      'descricao',
      Number(page),
      Number(perPage),
      searchParams
    );

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(result);
  } catch (error) {
    console.error('Erro ao buscar segmentos:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
