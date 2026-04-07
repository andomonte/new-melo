import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { PerfilCompleto } from '@/data/perfis/perfis'; // Importe a interface PerfilCompleto

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
}

interface PerfilBase {
  login_perfil_name: string;
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
      ORDER BY login_perfil_name
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM db_manaus.tb_login_perfil
      WHERE LOWER(login_perfil_name) LIKE $1
    `;

    const [perfisBaseResult, countResult] = await Promise.all([
      client.query<PerfilBase>(query, [
        `%${search.toLowerCase()}%`,
        itemsPerPage,
        offset,
      ]),
      client.query<{ total: string }>(countQuery, [
        `%${search.toLowerCase()}%`,
      ]),
    ]);

    const perfisBase = perfisBaseResult.rows;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const perfisDetalhados: PerfilCompleto[] = await Promise.all(
      perfisBase
        .map(async (perfilBase) => {
          const perfilDetalhadoResult = await client!.query<any>(
            `
          SELECT
            p.login_perfil_name AS login_perfil_name,
            t."CODIGO_TELA",
            t."NOME_TELA",
            BOOL_OR(gp.cadastrar) AS cadastrar,
            BOOL_OR(gp.editar) AS editar,
            BOOL_OR(gp.remover) AS remover,
            BOOL_OR(gp.exportar) AS exportar,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT lap.id_functions), NULL) AS funcoes,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.login_user_login), NULL) AS usuarios
          FROM db_manaus.tb_login_perfil p
          LEFT JOIN db_manaus."tb_grupo_Permissao" gp ON gp."grupoId" = p.login_perfil_name
          LEFT JOIN db_manaus.tb_telas t ON t."CODIGO_TELA" = gp.tela
          LEFT JOIN db_manaus.tb_login_access_perfil lap ON lap.login_perfil_name = p.login_perfil_name
          LEFT JOIN db_manaus.tb_login_user u ON u.login_perfil_name = p.login_perfil_name
          WHERE p.login_perfil_name = $1
          GROUP BY p.login_perfil_name, t."CODIGO_TELA", t."NOME_TELA"
        `,
            [perfilBase.login_perfil_name],
          );

          const perfilDetalhado = perfilDetalhadoResult.rows;

          if (!perfilDetalhado || perfilDetalhado.length === 0) {
            return null as any; // Tratar caso o perfil detalhado não seja encontrado (improvável)
          }

          const login_perfil_name = perfilDetalhado[0].login_perfil_name;
          const usuarios = perfilDetalhado[0].usuarios || [];
          const funcoesSet = new Set<number>();
          perfilDetalhado.forEach((item) => {
            (item.funcoes || []).forEach((funcId: string) =>
              funcoesSet.add(parseInt(funcId, 10)),
            );
          });
          const funcoes = Array.from(funcoesSet);

          const telasPermissoes: PerfilCompleto['telasPermissoes'] =
            perfilDetalhado.map((item) => ({
              CODIGO_TELA: item.CODIGO_TELA,
              NOME_TELA: item.NOME_TELA,
              cadastrar: item.cadastrar,
              editar: item.editar,
              remover: item.remover,
              exportar: item.exportar,
            }));

          return {
            login_perfil_name,
            telasPermissoes,
            funcoes,
            usuarios: usuarios.map((user: string) => ({
              login_user_login: user,
            })),
          };
        })
        .filter(Boolean), // Remove nulls caso algum perfil detalhado não seja encontrado
    );

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(
        serializeBigInt({
          data: perfisDetalhados,
          meta: {
            total,
            lastPage: total > 0 ? Math.ceil(total / itemsPerPage) : 1,
            currentPage: total > 0 ? currentPage : 1,
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
