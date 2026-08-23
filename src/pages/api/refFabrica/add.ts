import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const referencia = String(req.body?.referencia ?? '').trim().toUpperCase();
  const codmarca = String(req.body?.codmarca ?? '').trim();
  const codcredor = String(req.body?.codcredor ?? '').trim();
  if (!referencia) return res.status(400).json({ error: 'Referência é obrigatória.' });
  if (!codmarca) return res.status(400).json({ error: 'Marca é obrigatória.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query(
      `SELECT cod_id FROM dbref_fabrica WHERE referencia=$1 AND codmarca=$2 AND COALESCE(codcredor,'')=$3 LIMIT 1`,
      [referencia, codmarca, codcredor],
    );
    if (dup.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Já existe essa referência para essa marca/fornecedor.' });
    }
    const maxRes = await client.query('SELECT COALESCE(MAX(cod_id),0)+1 AS next_id FROM dbref_fabrica');
    const codId = maxRes.rows[0].next_id;
    const r = await client.query(
      `INSERT INTO dbref_fabrica (cod_id, codmarca, referencia, codcredor)
       VALUES ($1,$2,$3,$4) RETURNING cod_id, referencia, codmarca, codcredor`,
      [codId, codmarca, referencia, codcredor],
    );
    await client.query('COMMIT');
    res.status(201).json({ data: serializeBigInt(r.rows[0]) });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
