import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const labelTotal = 'Tempo Total do Endpoint - SQL Puro';
  const labelQuery = 'Execução da Query - SQL Puro';
  const labelResponse = 'Envio da Resposta';

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    console.time(labelTotal);

    client = await pool.connect();

    // ✅ Medir apenas a execução da query
    console.time(labelQuery);
    const funcoesResult = await client.query(`
      SELECT id_functions, descricao, sigla, usadoEm
      FROM db_manaus.tb_login_functions;
    `);
    console.timeEnd(labelQuery);

    // ✅ Medir o envio da resposta
    console.time(labelResponse);
    res.status(200).json({ data: serializeBigInt(funcoesResult.rows) });
    console.timeEnd(labelResponse);

    console.timeEnd(labelTotal);
  } catch (error) {
    console.error('Erro no endpoint:', error);
    res.status(500).json({ error: 'Erro ao buscar funções.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
