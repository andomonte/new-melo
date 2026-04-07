import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient, QueryResult } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const defaultProfileId = 'ID_DO_PERFIL_PADRAO';
  let client: PoolClient | undefined;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do perfil é obrigatório.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN'); // Iniciar transação

    try {
      // Desconectar usuários associados ao perfil
      await client.query(
        `
        UPDATE tb_login_user
        SET login_perfil_name = $1
        WHERE login_perfil_name = $2
      `,
        [defaultProfileId, id],
      );

      // Remover registros da tabela de acesso ao perfil
      await client.query(
        `
        DELETE FROM tb_login_access_perfil
        WHERE login_perfil_name = $1
      `,
        [id],
      );

      // Remover permissões de grupo associadas ao perfil
      await client.query(
        `
        DELETE FROM "tb_grupo_Permissao"
        WHERE "grupoId" = $1
      `,
        [id],
      );

      // Finalmente, deletar o perfil
      const perfilDeletadoResult: QueryResult<any> = await client.query(
        `
  DELETE FROM tb_login_perfil
  WHERE login_perfil_name = $1
  RETURNING login_perfil_name
`,
        [id],
      );

      await client.query('COMMIT'); // Confirmar transação

      const rowCount = perfilDeletadoResult?.rowCount ?? 0;

      if (rowCount > 0) {
        return res
          .status(200)
          .json({ message: `Perfil "${id}" deletado com sucesso.` });
      } else {
        return res
          .status(404)
          .json({ error: `Perfil "${id}" não encontrado.` });
      }
    } catch (error) {
      await client.query('ROLLBACK'); // Reverter transação em caso de erro
      console.error('Erro ao deletar perfil:', error);
      return res.status(500).json({
        error: 'Erro ao deletar perfil.',
        details: (error as Error).message,
      });
    }
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao conectar ao banco de dados.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
