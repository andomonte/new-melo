import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { UserPerfil } from '@/data/userFuncionario/userFuncionarios'; // Importa a nova interface

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const data: UserPerfil = req.body;

  // A validação agora checa os campos da chave primária composta
  if (!data.user_login_id || !data.perfil_name || !data.codigo_filial) {
    res.status(400).json({
      error:
        'Os campos user_login_id, perfil_name e codigo_filial são obrigatórios.',
    });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // A query SQL foi atualizada para a tabela 'tb_user_perfil'
    // e os campos foram ajustados para corresponder à nova tabela
    const updateQuery = `
      UPDATE tb_user_perfil
      SET
        nome_filial = $1,
        codvend = $2,
        codcomprador = $3
      WHERE user_login_id = $4 AND perfil_name = $5 AND codigo_filial = $6
      RETURNING *;
    `;

    // Os valores passados para a query agora correspondem aos campos da nova tabela e da chave composta
    const result = await client.query(updateQuery, [
      data.nome_filial,
      data.codvend,
      data.codcomprador,
      data.user_login_id,
      data.perfil_name,
      data.codigo_filial,
    ]);

    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ error: 'Registro de perfil de usuário não encontrado.' });
      return;
    }

    const updatedUser = result.rows[0];

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(updatedUser),
      });
  } catch (error) {
    console.log('Erro ao atualizar perfil de usuário:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
