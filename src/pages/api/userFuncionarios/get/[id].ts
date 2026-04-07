import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { user_login_id, perfil_name, codigo_filial } = req.query;
  let client: PoolClient | undefined;

  // 1. Validar os três campos da chave primária composta
  if (
    !user_login_id ||
    typeof user_login_id !== 'string' ||
    !perfil_name ||
    typeof perfil_name !== 'string' ||
    !codigo_filial ||
    typeof codigo_filial !== 'string'
  ) {
    res
      .status(400)
      .json({
        error:
          'Os campos user_login_id, perfil_name e codigo_filial são obrigatórios.',
      });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const filialId = parseInt(codigo_filial, 10);
    if (isNaN(filialId)) {
      res
        .status(400)
        .json({ error: 'codigo_filial deve ser um número válido.' });
      return;
    }

    // 2. Montar a query SQL usando a chave composta na cláusula WHERE
    const userQuery = `
      SELECT * FROM tb_user_perfil WHERE user_login_id = $1 AND perfil_name = $2 AND codigo_filial = $3;
    `;
    const userResult = await client.query(userQuery, [
      user_login_id,
      perfil_name,
      filialId,
    ]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(userResult.rows[0]));
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
