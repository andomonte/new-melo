import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool, invalidarCacheFilial } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { Filial } from '@/data/filiais/filiais';
import { encrypt } from '@/utils/crypto';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const data: Filial = req.body;
  const dbConnRaw = (data as any).db_conn;
  const saveData = {
    nome_filial: data.nome_filial,
    timezone: (data as any).timezone || 'America/Manaus',
    codigo_acesso: (String((data as any).codigo_acesso ?? '').trim() || null),
    cidade: (String((data as any).cidade ?? '').trim() || null),
    uf: (String((data as any).uf ?? '').trim().toUpperCase().slice(0, 2) || null),
    schema_db: (String((data as any).schema_db ?? '').trim() || null),
    // conexão criptografada (AES) — null quando não informada (usa banco central)
    db_conn_enc:
      typeof dbConnRaw === 'string' && dbConnRaw.trim() !== ''
        ? await encrypt(dbConnRaw.trim())
        : null,
  };

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const insertQuery = `
      INSERT INTO tb_filial (nome_filial, timezone, codigo_acesso, cidade, uf, schema_db, db_conn_enc)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING codigo_filial, nome_filial, timezone, codigo_acesso, cidade, uf, schema_db, (db_conn_enc IS NOT NULL) AS tem_conn;
    `;

    const filialResult = await client.query(insertQuery, [
      saveData.nome_filial,
      saveData.timezone,
      saveData.codigo_acesso,
      saveData.cidade,
      saveData.uf,
      saveData.schema_db,
      saveData.db_conn_enc,
    ]);
    const filial = filialResult.rows[0];

    // Nova filial já entra no resolver sem esperar o TTL de 60s.
    invalidarCacheFilial();

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(filial),
      });
  } catch (error) {
    console.error('Erro ao criar filial:', error);
    return res.status(500).json({
      message: 'Erro interno ao criar filial.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
