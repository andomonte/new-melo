import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { Tela } from '@/data/telas/telas';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { CODIGO_TELA, NOME_TELA, PATH_TELA }: Tela = req.body;
  let client;

  if (!CODIGO_TELA || !NOME_TELA || !PATH_TELA) {
    return res
      .status(400)
      .json({ error: 'Código, nome e caminho da tela são obrigatórios.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      UPDATE tb_telas
      SET "NOME_TELA" = $1, "PATH_TELA" = $2
      WHERE "CODIGO_TELA" = $3
      RETURNING "CODIGO_TELA", "NOME_TELA", "PATH_TELA";
    `;

    const values = [NOME_TELA, PATH_TELA, CODIGO_TELA];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      return res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json({ data: serializeBigInt(result.rows[0]) });
    } else {
      return res
        .status(404)
        .json({ error: 'Tela não encontrada ou não atualizada.' });
    }
  } catch (error) {
    console.error('Erro ao atualizar tela:', error);
    return res.status(500).json({ error: 'Erro ao atualizar tela.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
