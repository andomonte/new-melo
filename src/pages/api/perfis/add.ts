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
      INSERT INTO tb_login_perfil (login_perfil_name)
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

    if (permissoesGrupos.length > 0) {
      // id explícito (MAX+1): a sequence de "tb_grupo_Permissao".id dessincroniza
      // após cargas (o sync-sequences não cobre o nome com maiúsculas) → 23505.
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(id), 0) AS maxid FROM "tb_grupo_Permissao"`,
      );
      const baseId = Number(maxRes.rows[0].maxid);
      const permissoesGruposValues = permissoesGrupos.map((p, i) => [
        baseId + i + 1,
        p.editar,
        p.cadastrar,
        p.remover,
        p.exportar,
        p.grupoId,
        p.tela,
      ]);
      await client.query(
        `
        INSERT INTO "tb_grupo_Permissao" (id, editar, cadastrar, remover, exportar, "grupoId", tela)
        VALUES ${permissoesGruposValues
          .map(
            (_, index) =>
              `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${
                index * 7 + 4
              }, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`,
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
      INSERT INTO tb_login_access_perfil (id_functions, login_perfil_name)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM tb_login_access_perfil
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
