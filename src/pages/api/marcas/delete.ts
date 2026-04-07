import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { codmarca } = req.body;

    if (!codmarca) {
      res.status(400).json({ error: 'Código da marca é obrigatório' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    // Verificar se a marca existe antes de tentar deletar
    const checkQuery = `
      SELECT codmarca FROM dbmarcas 
      WHERE codmarca = $1;
    `;
    const checkResult = await client.query(checkQuery, [codmarca]);

    if (checkResult.rowCount === 0) {
      res.status(404).json({ error: 'Marca não encontrada' });
      return;
    }

    // Deletar a marca
    const deleteQuery = `
      DELETE FROM dbmarcas 
      WHERE codmarca = $1
      RETURNING codmarca;
    `;

    const result = await client.query(deleteQuery, [codmarca]);

    if (result.rowCount === 0) {
      res.status(500).json({ error: 'Erro ao deletar a marca' });
      return;
    }

    res.status(200).json({
      message: 'Marca deletada com sucesso',
      codmarca: result.rows[0].codmarca,
    });
  } catch (error) {
    console.error('Erro ao deletar marca:', error);

    // Verificar se é erro de foreign key constraint
    if ((error as any).code === '23503') {
      res.status(400).json({
        error:
          'Não é possível deletar esta marca pois ela está sendo utilizada por outros registros.',
        message:
          'Esta marca está vinculada a produtos ou outros registros no sistema.',
      });
      return;
    }

    res.status(500).json({
      error: 'Erro interno ao deletar a marca.',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
