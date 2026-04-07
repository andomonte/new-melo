import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
// A interface foi alterada para UserPerfil, correspondente à sua nova tabela
import { UserPerfil } from '@/data/userFuncionario/userFuncionarios';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  // O tipo de dados de entrada agora é UserPerfil
  const data: UserPerfil = req.body;

  // Validação para garantir que os campos obrigatórios estão presentes
  if (!data.user_login_id || !data.perfil_name || !data.codigo_filial) {
    return res.status(400).json({
      error:
        'Os campos user_login_id, perfil_name e codigo_filial são obrigatórios.',
    });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // A consulta SQL foi atualizada para a tabela 'tb_user_perfil'
    // e os campos foram ajustados para corresponder à nova tabela
    const insertQuery = `
      INSERT INTO tb_user_perfil (
        user_login_id,
        perfil_name,
        codigo_filial,
        nome_filial,
        codvend,
        codcomprador
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    // Os valores passados para a query agora correspondem aos campos da nova tabela
    const userResult = await client.query(insertQuery, [
      data.user_login_id,
      data.perfil_name,
      data.codigo_filial,
      data.nome_filial,
      data.codvend,
      data.codcomprador,
    ]);
    const user = userResult.rows[0];

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(user),
      });
  } catch (error) {
    console.error('Erro ao criar perfil de usuário:', error);
    return res.status(500).json({
      message: 'Erro interno ao criar perfil de usuário.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
