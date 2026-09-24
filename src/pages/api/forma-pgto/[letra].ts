// pages/api/forma-pgto/[letra].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();
const TABLE = 'db_manaus.cad_forma_pgto';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const { letra } = req.query;
  if (!letra || typeof letra !== 'string') {
    return res.status(400).json({ error: 'Letra inválida na URL.' });
  }
  const key = letra.toUpperCase();

  switch (req.method) {
    case 'GET':
      return handleGetOne(res, key);
    case 'PUT':
      return handleUpdate(req, res, key);
    case 'DELETE':
      return handleDelete(res, key);
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGetOne = async (res: NextApiResponse, letra: string) => {
  try {
    const r = await pool.query(`SELECT * FROM ${TABLE} WHERE fpg_letra = $1`, [letra]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    return res.status(200).json(r.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleUpdate = async (req: NextApiRequest, res: NextApiResponse, letra: string) => {
  const allowed = ['fpg_descricao', 'fpg_ativo'];
  const data: Record<string, any> = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) {
      data[f] = f === 'fpg_descricao' ? String(req.body[f]).toUpperCase() : req.body[f];
    }
  });
  const fields = Object.keys(data);
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

  const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
  try {
    const r = await pool.query(
      `UPDATE ${TABLE} SET ${setClause} WHERE fpg_letra = $${fields.length + 1} RETURNING *`,
      [...Object.values(data), letra],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    return res.status(200).json(r.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleDelete = async (res: NextApiResponse, letra: string) => {
  try {
    const r = await pool.query(`DELETE FROM ${TABLE} WHERE fpg_letra = $1`, [letra]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    return res.status(204).end();
  } catch (error: any) {
    // FK em uso (dbfpgto) — não deixa excluir, orienta a inativar
    if (error.code === '23503') {
      return res.status(409).json({ error: 'Forma de pagamento em uso. Inative-a em vez de excluir.' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};
