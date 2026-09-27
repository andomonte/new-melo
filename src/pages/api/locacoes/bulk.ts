// POST /api/locacoes/bulk — aplica UMA locação a vários produtos de um armazém.
// Body: { arm_id, codprods: string[], descricao }
// Para cada produto: se já existir a MESMA descrição, ignora (idempotente);
// senão insere com apl_id = MAX+1 (permite múltiplas locações, como o Delphi).
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();
const TABLE = 'db_manaus.cad_armazem_produto_locacao';
const MAX_DESC = 15;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const armId = parseInt(String(req.body.arm_id ?? ''), 10);
  const codprods: string[] = Array.isArray(req.body.codprods)
    ? req.body.codprods.map((c: any) => String(c).trim()).filter(Boolean)
    : [];
  const descricao = String(req.body.descricao ?? '').trim().toUpperCase();

  if (!armId || isNaN(armId)) return res.status(400).json({ error: 'Armazém é obrigatório.' });
  if (codprods.length === 0) return res.status(400).json({ error: 'Selecione ao menos um produto.' });
  if (!descricao) return res.status(400).json({ error: 'Informe a descrição da locação.' });
  if (descricao.length > MAX_DESC) {
    return res.status(400).json({ error: `A locação deve ter no máximo ${MAX_DESC} caracteres.` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let aplicados = 0;
    let ignorados = 0;
    for (const codprod of codprods) {
      const existe = await client.query(
        `SELECT 1 FROM ${TABLE} WHERE apl_arm_id = $1 AND apl_codprod = $2 AND UPPER(apl_descricao) = $3 LIMIT 1`,
        [armId, codprod, descricao],
      );
      if (existe.rowCount && existe.rowCount > 0) {
        ignorados++;
        continue;
      }
      const nextRes = await client.query(
        `SELECT COALESCE(MAX(apl_id), 0) + 1 as next_id FROM ${TABLE} WHERE apl_arm_id = $1 AND apl_codprod = $2`,
        [armId, codprod],
      );
      await client.query(
        `INSERT INTO ${TABLE} (apl_arm_id, apl_codprod, apl_id, apl_descricao) VALUES ($1, $2, $3, $4)`,
        [armId, codprod, nextRes.rows[0].next_id, descricao],
      );
      aplicados++;
    }
    await client.query('COMMIT');
    return res.status(200).json({ sucesso: true, aplicados, ignorados });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro no bulk de locações:', error);
    return res.status(500).json({ error: 'Erro ao aplicar locações', message: error.message });
  } finally {
    client.release();
  }
}
