import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  const cod_id = req.body?.cod_id;
  const referencia = String(req.body?.referencia ?? '').trim().toUpperCase();
  const codmarca = String(req.body?.codmarca ?? '').trim();
  const codcredor = String(req.body?.codcredor ?? '').trim();
  if (!cod_id) return res.status(400).json({ error: 'Código é obrigatório.' });
  if (!referencia || !codmarca) return res.status(400).json({ error: 'Referência e Marca são obrigatórias.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `UPDATE dbref_fabrica SET referencia=$2, codmarca=$3, codcredor=$4 WHERE cod_id=$1
       RETURNING cod_id, referencia, codmarca, codcredor`,
      [cod_id, referencia, codmarca, codcredor],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Referência não encontrada.' });
    res.status(200).json({ data: serializeBigInt(r.rows[0]) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
