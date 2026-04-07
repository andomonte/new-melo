import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { PerfilAtualizacao } from '@/data/perfis/perfis';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const data: PerfilAtualizacao = req.body;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN'); // Iniciar transação

    // 1. Criar o Perfil
    const perfilResult = await client.query(
      `
      INSERT INTO db_manaus.tb_login_perfil (login_perfil_name)
      VALUES ($1)
      RETURNING login_perfil_name
    `,
      [data.login_perfil_name],
    );
    const perfil = perfilResult.rows[0];

    // 2. Processar Telas e Permissões (tb_grupo_Permissao)
    const permissoesGrupos = data.grupos[0].telas.map((tela) => ({
      editar: tela.permissoes.editar,
      cadastrar: tela.permissoes.cadastrar,
      remover: tela.permissoes.remover,
      exportar: tela.permissoes.exportar,
      grupoId: data.login_perfil_name, // Usamos login_perfil_name como grupoId
      tela: tela.tela.value,
    }));

    const permissoesGruposValues = permissoesGrupos.map((p) => [
      p.editar,
      p.cadastrar,
      p.remover,
      p.exportar,
      p.grupoId,
      p.tela,
    ]);

    if (permissoesGruposValues.length > 0) {
      await client.query(
        `
        INSERT INTO db_manaus."tb_grupo_Permissao" (editar, cadastrar, remover, exportar, "grupoId", tela)
        VALUES ${permissoesGruposValues
          .map(
            (_, index) =>
              `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${
                index * 6 + 4
              }, $${index * 6 + 5}, $${index * 6 + 6})`,
          )
          .join(', ')}
      `,
        permissoesGruposValues.flat(),
      );
    }

    // 3. Processar Funções (tb_login_access_perfil)
    const funcoesPerfis = data.grupos[0].funcoes.map((funcao) => ({
      id_functions: BigInt(funcao.value), // Convertendo para BigInt
      login_perfil_name: data.login_perfil_name,
    }));

    const funcoesPerfisValues = funcoesPerfis.map((f) => [
      f.id_functions.toString(), // Converter BigInt para string para o PG
      f.login_perfil_name,
    ]);

    if (funcoesPerfisValues.length > 0) {
      for (const [idFunction, perfilName] of funcoesPerfisValues) {
        await client.query(
          `
      INSERT INTO db_manaus.tb_login_access_perfil (id_functions, login_perfil_name)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM db_manaus.tb_login_access_perfil
        WHERE id_functions = $1 AND login_perfil_name = $2
      )
      `,
          [idFunction, perfilName],
        );
      }
    }

    await client.query('COMMIT'); // Confirmar transação

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json(
        serializeBigInt({
          data: {
            ...perfil,
            telas: permissoesGrupos,
            funcoes: funcoesPerfis,
          },
        }),
      );
  } catch (error: any) {
    await client?.query('ROLLBACK'); // Reverter transação em caso de erro
    console.error('Erro ao criar perfil:', error);
    res
      .status(500)
      .json({ error: 'Erro ao criar perfil. Detalhes: ' + error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
