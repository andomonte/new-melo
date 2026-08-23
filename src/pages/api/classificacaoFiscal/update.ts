import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });
  const id = req.body?.id;
  const ncm = String(req.body?.ncm ?? '').trim();
  if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });
  if (!ncm) return res.status(400).json({ error: 'NCM é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `UPDATE dbclassificacao_fiscal
          SET ncm=$2, ipi=$3, pis=$4, cofins=$5, agregado=$6, descricao=$7
        WHERE id=$1
        RETURNING id, ncm, ipi, pis, cofins, agregado, descricao`,
      [id, ncm, num(req.body?.ipi), num(req.body?.pis), num(req.body?.cofins), num(req.body?.agregado), String(req.body?.descricao ?? '').trim().toUpperCase() || null],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Classificação não encontrada.' });
    res.status(200).json({ data: serializeBigInt(r.rows[0]) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
