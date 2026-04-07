import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
}

interface Perfil {
  login_perfil_name: string; // Adicione outras propriedades da sua tabela tb_login_perfil aqui
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '10', search = '' }: GetParams = req.query;
  let client: PoolClient | undefined;

  try {
    const currentPage = parseInt(page, 10);
    const itemsPerPage = parseInt(perPage, 10);
    const offset = (currentPage - 1) * itemsPerPage;

    const pool = getPgPool();
    client = await pool.connect();

    const query = `
SELECT login_perfil_name
FROM db_manaus.tb_login_perfil
WHERE LOWER(login_perfil_name) LIKE $1
LIMIT $2 OFFSET $3
`;

    const countQuery = `
SELECT COUNT(*) AS total
FROM db_manaus.tb_login_perfil
WHERE LOWER(login_perfil_name) LIKE $1
`;

    const [perfisResult, countResult] = await Promise.all([
      client.query<Perfil>(query, [
        `%${search.toLowerCase()}%`,
        itemsPerPage,
        offset,
      ]),
      client.query<{ total: string }>(countQuery, [
        `%${search.toLowerCase()}%`,
      ]),
    ]);

    const perfis = perfisResult.rows;
    const count = parseInt(countResult.rows[0]?.total || '0', 10);

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(
        serializeBigInt({
          data: perfis,
          meta: {
            total: count,
            lastPage: count > 0 ? Math.ceil(count / itemsPerPage) : 1,
            currentPage: count > 0 ? currentPage : 1,
            perPage: itemsPerPage,
          },
        }),
      );
  } catch (errors) {
    console.error('Erro ao buscar perfis:', errors);
    res.status(500).json({ error: 'Erro ao buscar perfis' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
