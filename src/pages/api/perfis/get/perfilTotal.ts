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
    const itemsPerPage = parseInt(perPage, 10);

    const pool = getPgPool();
    client = await pool.connect();

    // Este endpoint alimenta o COMBO de perfis (Cadastrar/Editar Usuário) — precisa
    // trazer TODOS os perfis, ordenados. Antes usava LIMIT 10 sem ORDER BY, então
    // perfis novos (ex.: "financeiro") ficavam de fora do dropdown.
    const query = `
SELECT login_perfil_name
FROM tb_login_perfil
WHERE LOWER(login_perfil_name) LIKE $1
ORDER BY login_perfil_name
`;

    const perfisResult = await client.query<Perfil>(query, [
      `%${search.toLowerCase()}%`,
    ]);

    const perfis = perfisResult.rows;
    const count = perfis.length;

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(
        serializeBigInt({
          data: perfis,
          meta: {
            total: count,
            lastPage: 1,
            currentPage: 1,
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
