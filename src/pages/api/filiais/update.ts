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

  const { codigo_filial, nome_filial } = req.body as Filial;
  const timezone = (req.body as any).timezone;

  if (!codigo_filial || !nome_filial) {
    res
      .status(400)
      .json({ error: 'Nome filial e código filial são obrigatórios.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // SET dinâmico: só atualiza codigo_acesso quando o campo é enviado
    // (evita apagar o código ao editar sem tocar nele).
    const temCodigo = Object.prototype.hasOwnProperty.call(req.body, 'codigo_acesso');
    const codigoAcesso = temCodigo
      ? String((req.body as any).codigo_acesso ?? '').trim() || null
      : null;

    const sets: string[] = ['nome_filial = $1'];
    const params: (string | number | null)[] = [nome_filial];
    let i = 2;
    if (timezone) { sets.push(`timezone = $${i++}`); params.push(timezone); }
    if (temCodigo) { sets.push(`codigo_acesso = $${i++}`); params.push(codigoAcesso); }

    // Cidade / UF da filial. Enviados → atualiza (vazio vira NULL). UF normalizada p/ 2 letras.
    if (Object.prototype.hasOwnProperty.call(req.body, 'cidade')) {
      const cidade = String((req.body as any).cidade ?? '').trim() || null;
      sets.push(`cidade = $${i++}`);
      params.push(cidade);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'uf')) {
      const uf = String((req.body as any).uf ?? '').trim().toUpperCase().slice(0, 2) || null;
      sets.push(`uf = $${i++}`);
      params.push(uf);
    }

    // schema_db (search_path da filial). Enviado → atualiza (vazio vira NULL = usa central).
    if (Object.prototype.hasOwnProperty.call(req.body, 'schema_db')) {
      const schemaDb = String((req.body as any).schema_db ?? '').trim() || null;
      sets.push(`schema_db = $${i++}`);
      params.push(schemaDb);
    }

    // db_conn (string de conexão completa). Só atualiza quando vem PREENCHIDA
    // (vazio = manter atual, para não exigir redigitar a senha a cada edição).
    // Guardada CRIPTOGRAFADA (AES, utils/crypto) — nunca em texto puro.
    const dbConnRaw = (req.body as any).db_conn;
    if (typeof dbConnRaw === 'string' && dbConnRaw.trim() !== '') {
      const enc = await encrypt(dbConnRaw.trim());
      sets.push(`db_conn_enc = $${i++}`);
      params.push(enc);
    }

    params.push(codigo_filial);
    const updateQuery = `UPDATE tb_filial SET ${sets.join(', ')} WHERE codigo_filial = $${i}
      RETURNING codigo_filial, nome_filial, timezone, codigo_acesso, cidade, uf, schema_db, (db_conn_enc IS NOT NULL) AS tem_conn`;

    const result = await client.query(updateQuery, params);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Filial não encontrada.' });
      return;
    }

    const updatedFilial = result.rows[0];

    // Reflete a mudança de schema/conexão imediatamente (mata o cache de 60s).
    invalidarCacheFilial();

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(updatedFilial),
      });
  } catch (error) {
    console.log('Erro ao atualizar filial:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
