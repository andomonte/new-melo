import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { PerfilAtualizacao } from '@/data/perfis/perfis';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const data: PerfilAtualizacao = req.body;
  const { login_perfil_name, grupos } = data;
  let client: PoolClient | undefined;

  if (!login_perfil_name || !grupos || grupos.length === 0) {
    return res.status(400).json({ error: 'Dados do perfil incompletos.' });
  }

  const grupo = grupos[0]; // Assumindo que sempre haverá um único grupo na edição

  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN'); // Iniciar transação

    try {
      // 1. Atualizar o nome do perfil (opcional, mantendo o mesmo por padrão)
      await client.query(
        `
          UPDATE tb_login_perfil
          SET login_perfil_name = $1
          WHERE login_perfil_name = $2
        `,
        [login_perfil_name, login_perfil_name],
      );

      // 2. Remover as permissões de tela existentes
      await client.query(
        `
          DELETE FROM "tb_grupo_Permissao"
          WHERE "grupoId" = $1
        `,
        [login_perfil_name],
      );

      // 3. Inserir as novas permissões de tela
      const telasParaInserir = grupo.telas.map((tela) => ({
        grupoId: login_perfil_name,
        tela: tela.tela.value,
        cadastrar: tela.permissoes.cadastrar,
        editar: tela.permissoes.editar,
        remover: tela.permissoes.remover,
        exportar: tela.permissoes.exportar,
      }));

      if (telasParaInserir.length > 0) {
        // id explícito (MAX+1) porque a sequence de "tb_grupo_Permissao".id
        // dessincroniza após cargas de dados (o sync-sequences não cobre o nome
        // com maiúsculas), gerando 23505 duplicate key. Mesmo padrão da migration 071.
        const maxRes = await client.query(
          `SELECT COALESCE(MAX(id), 0) AS maxid FROM "tb_grupo_Permissao"`,
        );
        const baseId = Number(maxRes.rows[0].maxid);
        const values = telasParaInserir.flatMap((t, i) => [
          baseId + i + 1,
          t.grupoId,
          t.tela,
          t.cadastrar,
          t.editar,
          t.remover,
          t.exportar,
        ]);
        const placeholders = telasParaInserir
          .map(
            (_, index) =>
              `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${
                index * 7 + 4
              }, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`,
          )
          .join(', ');
        await client.query(
          `
            INSERT INTO "tb_grupo_Permissao" (id, "grupoId", tela, cadastrar, editar, remover, exportar)
            VALUES ${placeholders}
          `,
          values,
        );
      }

      // 4. Remover as funções de acesso existentes
      await client.query(
        `
          DELETE FROM tb_login_access_perfil
          WHERE login_perfil_name = $1
        `,
        [login_perfil_name],
      );

      // 5. Inserir as novas funções de acesso
      const funcoesParaInserir = grupo.funcoes.map((funcao) => ({
        login_perfil_name: login_perfil_name,
        id_functions: funcao.value,
      }));

      if (funcoesParaInserir.length > 0) {
        const values = funcoesParaInserir.flatMap((f) => [
          f.login_perfil_name,
          f.id_functions,
        ]);
        const placeholders = funcoesParaInserir
          .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
          .join(', ');
        await client.query(
          `
            INSERT INTO tb_login_access_perfil (login_perfil_name, id_functions)
            VALUES ${placeholders}
          `,
          values,
        );
      }

      await client.query('COMMIT'); // Confirmar transação
      res.status(200).json({ message: 'Perfil atualizado com sucesso.' });
    } catch (error) {
      await client.query('ROLLBACK'); // Reverter transação em caso de erro
      console.error('Erro ao atualizar perfil:', error);
      res
        .status(500)
        .json({
          error: 'Erro ao atualizar perfil.',
          details: (error as Error).message,
        });
    }
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    res.status(500).json({ error: 'Erro ao conectar ao banco de dados.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
