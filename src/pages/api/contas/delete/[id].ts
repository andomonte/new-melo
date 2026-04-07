import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const { id } = req.query; // This 'id' now refers to the 'id' (primary key) of dbdados_banco

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID da conta é obrigatório e deve ser uma string' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Start the transaction
    await client.query('BEGIN');

    // Check if the account exists
    const accountExistsResult = await client.query(
      'SELECT id FROM dbdados_banco WHERE id = $1',
      [id],
    );

    if (accountExistsResult.rowCount === 0) {
      throw new Error(`Conta com ID ${id} não encontrada.`);
    }

    // Delete the account
    await client.query('DELETE FROM dbdados_banco WHERE id = $1', [id]);

    // Commit the transaction
    await client.query('COMMIT');

    res
      .status(200)
      .json({ message: `Conta com ID ${id} foi excluída com sucesso.` });
  } catch (error: any) {
    // Rollback in case of error
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao excluir conta:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao excluir conta' });
  } finally {
    if (client) {
      client.release();
    }
  }
}