// pages/api/tipoOperacaoFiscal/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { queryWithRelease } from '@/lib/pg';

const TABLE = 'db_manaus."cad_tipo_operacao_fiscal"';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'ID inválido na URL.' });
  }
  switch (req.method) {
    case 'GET':
      await handleGetOne(res, id);
      break;
    case 'PUT':
      await handleUpdate(req, res, id);
      break;
    case 'DELETE':
      await handleDelete(res, id);
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGetOne = async (res: NextApiResponse, id: string) => {
  try {
    const result = await queryWithRelease(`SELECT * FROM ${TABLE} WHERE "id" = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleUpdate = async (req: NextApiRequest, res: NextApiResponse, id: string) => {
  const allowed = ['codigo', 'descricao', 'tipo_movimentacao', 'ordem', 'ativo'];
  const data: Record<string, any> = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) {
      if (f === 'codigo') data[f] = String(req.body[f]).toUpperCase().trim();
      else if (f === 'ordem') data[f] = Number(req.body[f]) || 0;
      else if (f === 'ativo') data[f] = !(req.body[f] === false || req.body[f] === 'N' || req.body[f] === 'false');
      else data[f] = req.body[f];
    }
  });
  const fields = Object.keys(data);
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

  const setClause = fields.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const values = Object.values(data);
  try {
    const result = await queryWithRelease(
      `UPDATE ${TABLE} SET ${setClause}, "atualizado_em" = now() WHERE "id" = $${fields.length + 1} RETURNING *`,
      [...values, id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe esta operação para esta movimentação.' });
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleDelete = async (res: NextApiResponse, id: string) => {
  try {
    const result = await queryWithRelease(`DELETE FROM ${TABLE} WHERE "id" = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};
