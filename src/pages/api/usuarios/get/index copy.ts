import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined; // Inicializa client com undefined

  try {
    const { page = '1', perPage = '10', search = '' } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const perPageNumber = parseInt(perPage as string, 10);
    const offset = (pageNumber - 1) * perPageNumber;

    const pool = getPgPool();
    client = await pool.connect();

    const usuariosQuery = `
      SELECT * FROM tb_login_user
      WHERE login_user_login ILIKE $1 OR login_user_name ILIKE $1
      LIMIT $2 OFFSET $3;
    `;
    const usuariosResult = await client.query(usuariosQuery, [
      `%${search}%`,
      perPageNumber,
      offset,
    ]);
    const usuarios = usuariosResult.rows;

    const totalQuery = `
      SELECT COUNT(*) as total
      FROM tb_login_user
      WHERE login_user_login ILIKE $1 OR login_user_name ILIKE $1;
    `;
    const totalResult = await client.query(totalQuery, [`%${search}%`]);
    const total = parseInt(totalResult.rows[0].total, 10);

    const acessosPerfilResult = await client.query(
      `SELECT * FROM tb_login_access_perfil;`,
    );
    const acessosUsuarioResult = await client.query(
      `SELECT * FROM tb_login_access_user;`,
    );
    const funcoesResult = await client.query(
      `SELECT * FROM tb_login_functions;`,
    );

    const acessosPerfil = acessosPerfilResult.rows;
    const acessosUsuario = acessosUsuarioResult.rows;
    const funcoesDoBanco = funcoesResult.rows;

    const resposta = await Promise.all(
      usuarios.map(async (usuario) => {
        const userPerfisQuery = `
          SELECT perfil_name, codigo_filial, nome_filial
          FROM tb_user_perfil
          WHERE user_login_id = $1;
        `;
        if (!client) {
          throw new Error('Client não inicializado');
        }
        const userPerfisResult = await client.query(userPerfisQuery, [
          usuario.login_user_login,
        ]);
        const userPerfis = userPerfisResult.rows;

        const perfisMap = new Map<string, any>();

        userPerfis.forEach((userPerfil) => {
          const key = `${userPerfil.perfil_name}-${userPerfil.codigo_filial}`;

          if (!perfisMap.has(key)) {
            perfisMap.set(key, {
              perfil_name: userPerfil.perfil_name,
              filial: [
                {
                  codigo_filial: userPerfil.codigo_filial,
                  nome_filial: userPerfil.nome_filial,
                },
              ],
              funcoes: [],
            });
          }
        });

        acessosPerfil.forEach((item) => {
          userPerfis.forEach((userPerfil) => {
            if (item.login_perfil_name === userPerfil.perfil_name) {
              const key = `${userPerfil.perfil_name}-${userPerfil.codigo_filial}`;
              const perfil = perfisMap.get(key);

              if (perfil) {
                const funcao = funcoesDoBanco.find(
                  (func) =>
                    Number(func.id_functions) === Number(item.id_functions) &&
                    Number(func.codigo_filial) === userPerfil.codigo_filial,
                );

                if (funcao) {
                  perfil.funcoes.push({
                    id_functions: Number(funcao.id_functions),
                    descricao: funcao.descricao,
                    sigla: funcao.sigla ?? '-',
                    usadoEm: funcao.usadoEm ?? '-',
                    codigo_filial: Number(funcao.codigo_filial),
                  });
                }
              }
            }
          });
        });

        acessosUsuario.forEach((item) => {
          userPerfis.forEach((userPerfil) => {
            if (
              item.login_user_login === usuario.login_user_login &&
              item.login_perfil_name === userPerfil.perfil_name
            ) {
              const key = `${userPerfil.perfil_name}-${userPerfil.codigo_filial}`;
              const perfil = perfisMap.get(key);

              if (perfil) {
                const funcao = funcoesDoBanco.find(
                  (func) =>
                    Number(func.id_functions) === Number(item.id_functions) &&
                    Number(func.codigo_filial) === userPerfil.codigo_filial,
                );

                if (funcao) {
                  perfil.funcoes.push({
                    id_functions: Number(funcao.id_functions),
                    descricao: funcao.descricao,
                    sigla: funcao.sigla ?? '-',
                    usadoEm: funcao.usadoEm ?? '-',
                    codigo_filial: Number(funcao.codigo_filial),
                  });
                }
              }
            }
          });
        });

        const perfis = Array.from(perfisMap.values());

        return {
          login_user_login: usuario.login_user_login,
          login_user_name: usuario.login_user_name,
          perfis,
        };
      }),
    );

    const meta = {
      currentPage: pageNumber,
      perPage: perPageNumber,
      total,
      totalPages: Math.ceil(total / perPageNumber),
    };

    res.status(200).json(serializeBigInt({ data: resposta, meta }));
  } catch (error) {
    console.error('Erro ao buscar e processar dados:', error);
    res.status(500).json({ error: 'Erro ao buscar e processar dados.' });
  } finally {
    if (client) client.release();
  }
}
