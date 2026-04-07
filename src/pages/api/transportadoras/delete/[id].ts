import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID da transportadora é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia uma transação
    await client.query('BEGIN');

    // Verificar se a transportadora existe
    const checkQuery = 'SELECT * FROM dbtransp WHERE codtransp = $1';
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transportadora não encontrada' });
    }

    const transportadoraParaExcluir = checkResult.rows[0];

    // Verificar se a transportadora está sendo usada em algum registro
    // Você pode adicionar verificações adicionais aqui conforme necessário
    // Por exemplo, verificar se existe alguma entrega vinculada a esta transportadora

    const deleteQuery = 'DELETE FROM dbtransp WHERE codtransp = $1 RETURNING *';
    const result = await client.query(deleteQuery, [id]);

    await client.query('COMMIT'); // Confirma a transação

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(result.rows[0]),
        message: `Transportadora ${transportadoraParaExcluir?.nome} excluída com sucesso.`,
      });
  } catch (error: any) {
    await client?.query('ROLLBACK'); // Reverte a transação em caso de erro
    console.error('Erro ao excluir transportadora:', error);

    // Verificar se é erro de violação de constraint de chave estrangeira
    if (error instanceof Error) {
      if (error.message.includes('violates foreign key constraint')) {
        return res.status(400).json({
          error:
            'Não é possível excluir esta transportadora pois ela está sendo utilizada em outros registros',
        });
      }
    }

    res
      .status(500)
      .json({ error: error.message || 'Erro ao excluir transportadora.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
