import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { Tela } from '@/data/telas/telas';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const data: Omit<Tela, 'CODIGO_TELA'> = req.body;
  let client;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // 1. Obter o último CODIGO_TELA existente
    const ultimoCodigoResult = await client.query(`
      SELECT MAX("CODIGO_TELA") AS ultimo_codigo
      FROM tb_telas;
    `);

    const ultimoCodigo = ultimoCodigoResult.rows[0]?.ultimo_codigo || 0;
    const novoCodigo = ultimoCodigo + 1;

    // 2. Preparar os dados para inserção
    const saveData = {
      CODIGO_TELA: novoCodigo,
      NOME_TELA: data.NOME_TELA,
      PATH_TELA: data.PATH_TELA,
    };

    // 3. Inserir a nova tela
    const query = `
      INSERT INTO tb_telas ("CODIGO_TELA", "NOME_TELA", "PATH_TELA")
      VALUES ($1, $2, $3)
      RETURNING "CODIGO_TELA", "NOME_TELA", "PATH_TELA";
    `;

    const values = [
      saveData.CODIGO_TELA,
      saveData.NOME_TELA,
      saveData.PATH_TELA,
    ];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      return res.status(201).json({
        data: serializeBigInt(result.rows[0]),
      });
    } else {
      return res.status(500).json({
        message: 'Erro ao criar tela.',
      });
    }
  } catch (error) {
    console.error('Erro ao criar tela:', error);
    return res.status(500).json({
      message: 'Erro interno ao criar tela.',
      error: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
