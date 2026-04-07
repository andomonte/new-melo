import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.time('Latência de Conexão');

  let client;

  try {
    const pool = getPgPool();
    client = await pool.connect();
    console.timeEnd('Latência de Conexão');

    console.time('Execução da Query - SQL Puro');
    const query = `
      SELECT id_functions, descricao, sigla 
      FROM tb_login_functions;
    `;
    const result = await client.query(query);
    console.timeEnd('Execução da Query - SQL Puro');

    console.time('Serialização e Envio da Resposta');
    const responseData = {
      data: result.rows,
      meta: {
        total: result.rowCount,
      },
    };
    res.status(200).json(responseData);
    console.timeEnd('Serialização e Envio da Resposta');
  } catch (error) {
    console.error('Erro no endpoint (pg):', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
