import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  try {
    const { page = '1', perPage = '10', search = '' } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const perPageNumber = parseInt(perPage as string, 10);
    const offset = (pageNumber - 1) * perPageNumber;

    const pool = getPgPool();
    client = await pool.connect();

    // --- CORREÇÃO AQUI: Adicionada a cláusula ORDER BY para ordenar a lista de usuários ---
    const usuariosQuery = `SELECT login_user_login, login_user_name FROM tb_login_user
      WHERE login_user_login ILIKE $1 OR login_user_name ILIKE $1
      ORDER BY login_user_login  -- Ordena a lista de usuários pelo login
      LIMIT $2 OFFSET $3;
    `;
    const usuariosResult = await client.query(usuariosQuery, [
      `%${search}%`,
      perPageNumber,
      offset,
    ]);
    const usuarios = usuariosResult.rows;

    const totalQuery = `SELECT COUNT(*) as total
      FROM tb_login_user
      WHERE login_user_login ILIKE $1 OR login_user_name ILIKE $1;
    `;
    const totalResult = await client.query(totalQuery, [`%${search}%`]);
    const total = parseInt(totalResult.rows[0].total, 10);

    const acessosPerfilResult = await client.query(
      `SELECT * FROM tb_login_access_perfil;`,
    );

    const acessosUsuarioResult = await client.query(
      `SELECT id_functions, login_user_login, login_perfil_name, codigo_filial FROM tb_login_access_user;`,
    );

    const funcoesResult = await client.query(
      `SELECT * FROM tb_login_functions;`,
    );

    // --- Buscando Armazéns do Usuário usando 'dbarmazem' ---
    const armazensUsuarioResult = await client.query(
      `SELECT
          tla.id_armazem,
          da.nome AS nome_armazem,
          da.filial AS filial_armazem,
          da.ativo AS ativo_armazem,
          tla.login_user_login,
          tla.login_perfil_name,
          tla.codigo_filial
        FROM
          tb_login_armazem_user tla
        JOIN
          dbarmazem da ON tla.id_armazem = da.id_armazem;
      `,
    );
    const armazensDoUsuario = armazensUsuarioResult.rows;
    // --- FIM DA BUSCA DE ARMAZÉNS ---

    const acessosPerfil = acessosPerfilResult.rows;
    const acessosUsuario = acessosUsuarioResult.rows;
    const funcoesDoBanco = funcoesResult.rows;

    const resposta = await Promise.all(
      usuarios.map(async (usuario) => {
        // Query para obter os perfis do usuário, já ordenada por perfil_name
        const userPerfisQuery = `SELECT perfil_name, codigo_filial, nome_filial, codvend
          FROM tb_user_perfil
          WHERE user_login_id = $1
          ORDER BY perfil_name; 
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
                  armazens: [],
                  codvend: userPerfil.codvend ?? null,
                },
              ],

              funcoesPadraoPerfil: [],
              funcoesDoUsuario: [],
              codvend: userPerfil.codvend ?? null,
            });
          }
        });

        const addedPadrao = new Map<string, Set<number>>();
        const addedUsuario = new Map<string, Set<string>>();

        acessosPerfil.forEach((item) => {
          userPerfis.forEach((userPerfil) => {
            if (item.login_perfil_name === userPerfil.perfil_name) {
              const key = `${userPerfil.perfil_name}-${userPerfil.codigo_filial}`;
              let perfil = perfisMap.get(key);

              if (!perfil) {
                perfil = {
                  perfil_name: userPerfil.perfil_name,
                  filial: [
                    {
                      codigo_filial: userPerfil.codigo_filial,
                      nome_filial: userPerfil.nome_filial,
                      armazens: [],
                      codvend: userPerfil.codvend ?? null,
                    },
                  ],

                  funcoesPadraoPerfil: [],
                  funcoesDoUsuario: [],
                  codvend: userPerfil.codvend ?? null,
                };
                perfisMap.set(key, perfil);
              }

              if (perfil) {
                const funcao = funcoesDoBanco.find(
                  (func) =>
                    Number(func.id_functions) === Number(item.id_functions),
                );

                if (funcao) {
                  let funcSet = addedPadrao.get(key);
                  if (!funcSet) {
                    funcSet = new Set();
                    addedPadrao.set(key, funcSet);
                  }
                  if (!funcSet.has(Number(funcao.id_functions))) {
                    perfil.funcoesPadraoPerfil.push({
                      id_functions: Number(funcao.id_functions),
                      descricao: funcao.descricao,
                      sigla: funcao.sigla ?? '-',
                      usadoEm: funcao.usadoEm ?? '-',
                      codigo_filial: userPerfil.codigo_filial,
                    });
                    funcSet.add(Number(funcao.id_functions));
                  }
                } else {
                  console.warn(
                    `[DEBUG] FuncaoPadrao NÃO ENCONTRADA no funcoesDoBanco para id_functions: ${item.id_functions} (do perfil)`,
                  );
                }
              }
            }
          });
        });

        acessosUsuario.forEach((item) => {
          userPerfis.forEach((userPerfil) => {
            if (
              item.login_user_login === usuario.login_user_login &&
              item.login_perfil_name === userPerfil.perfil_name &&
              Number(item.codigo_filial) === Number(userPerfil.codigo_filial)
            ) {
              const key = `${userPerfil.perfil_name}-${userPerfil.codigo_filial}`;
              let perfil = perfisMap.get(key);

              if (!perfil) {
                perfil = {
                  perfil_name: userPerfil.perfil_name,
                  filial: [
                    {
                      codigo_filial: userPerfil.codigo_filial,
                      nome_filial: userPerfil.nome_filial,
                      armazens: [],
                      codvend: userPerfil.codvend ?? null,
                    },
                  ],

                  funcoesPadraoPerfil: [],
                  funcoesDoUsuario: [],
                  codvend: userPerfil.codvend ?? null,
                };
                perfisMap.set(key, perfil);
              }

              if (perfil) {
                const funcao = funcoesDoBanco.find(
                  (func) =>
                    Number(func.id_functions) === Number(item.id_functions),
                );

                if (funcao) {
                  let funcSet = addedUsuario.get(key);
                  if (!funcSet) {
                    funcSet = new Set();
                    addedUsuario.set(key, funcSet);
                  }
                  const funcKey = `${Number(funcao.id_functions)}-${Number(
                    item.codigo_filial,
                  )}`;

                  if (!funcSet.has(funcKey)) {
                    perfil.funcoesDoUsuario.push({
                      id_functions: Number(funcao.id_functions),
                      descricao: funcao.descricao,
                      sigla: funcao.sigla ?? '-',
                      usadoEm: funcao.usadoEm ?? '-',
                      codigo_filial: userPerfil.codigo_filial,
                    });
                    funcSet.add(funcKey);
                  }
                } else {
                  console.warn(
                    `[DEBUG] FuncaoUsuario NÃO ENCONTRADA no funcoesDoBanco para id_functions: ${item.id_functions} (do acesso)`,
                  );
                }
              }
            }
          });
        });

        // --- Mapear e adicionar armazéns do usuário às filiais correspondentes ---
        armazensDoUsuario.forEach((armazem) => {
          if (armazem.login_user_login === usuario.login_user_login) {
            const key = `${armazem.login_perfil_name}-${armazem.codigo_filial}`;
            const perfilEntry = perfisMap.get(key);

            if (perfilEntry) {
              const filialEntry = perfilEntry.filial.find(
                (f: any) =>
                  Number(f.codigo_filial) === Number(armazem.codigo_filial),
              );

              if (filialEntry) {
                const existingArmazem = filialEntry.armazens.find(
                  (a: any) => a.id_armazem === armazem.id_armazem,
                );
                if (!existingArmazem) {
                  filialEntry.armazens.push({
                    id_armazem: Number(armazem.id_armazem),
                    nome: armazem.nome_armazem,
                    filial: armazem.filial_armazem,
                    ativo: armazem.ativo_armazem,
                  });
                }
              }
            }
          }
        });
        // --- FIM DO MAPEAMENTO DE ARMAZÉNS ---

        const perfis = Array.from(perfisMap.values());
        // --- ORDENAÇÃO FINAL DOS PERFIS POR 'perfil_name' (mantida) ---
        perfis.sort((a, b) => {
          if (a.perfil_name < b.perfil_name) return -1;
          if (a.perfil_name > b.perfil_name) return 1;
          return 0;
        });
        // --- FIM DA ORDENAÇÃO DE PERFIS ---

        return {
          login_user_login: usuario.login_user_login,
          login_user_name: usuario.login_user_name,
          codvend: usuario.codvend ?? null,
          perfis,
        };
      }),
    );

    const meta = {
      currentPage: pageNumber,
      perPage: perPageNumber,
      total,
      lastPage: Math.ceil(total / perPageNumber),
    };

    res.status(200).json(serializeBigInt({ data: resposta, meta }));
  } catch (error) {
    console.error('Erro ao buscar e processar dados:', error);
    res.status(500).json({ error: 'Erro ao buscar e processar dados.' });
  } finally {
    if (client) client.release();
  }
}
