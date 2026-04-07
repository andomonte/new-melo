// pages/api/legislacao-icmsst/[lei_id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { lei_id } = req.query;

  if (!lei_id || typeof lei_id !== 'string') {
    return res.status(400).json({ error: 'ID da legislação inválido na URL.' });
  }

  const id = Number(lei_id);
  if (isNaN(id)) {
    return res
      .status(400)
      .json({ error: 'ID da legislação deve ser um número.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, id);
      break;
    case 'PUT':
      await handleUpdate(req, res, id);
      break;
    case 'DELETE':
      await handleDelete(req, res, id);
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- FUNÇÃO PARA OBTER UM (GET) ---
const handleGetOne = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: number,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO:
    const query =
      'SELECT * FROM db_manaus."CAD_LEGISLACAO_ICMSST" WHERE "LEI_ID" = $1';
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Legislação não encontrada.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter legislação:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA ATUALIZAR (PUT) ---
const handleUpdate = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: number,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const allowedFields = [
    'LEI_PROTOCOLO',
    'LEI_STATUS',
    'LEI_DATA_VIGENCIA',
    'LEI_DATA_PUBLICACAO',
    'LEI_MVA_AJUSTADA',
    'LEI_TIPO',
  ];

  const dataToUpdate: { [key: string]: any } = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      dataToUpdate[field] = req.body[field];
    }
  });

  const fields = Object.keys(dataToUpdate);
  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum campo para atualizar foi fornecido.' });
  }

  const setClause = fields
    .map((key, index) => `"${key}" = $${index + 1}`)
    .join(', ');
  const values = Object.values(dataToUpdate);

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO:
    const query = `
      UPDATE db_manaus."CAD_LEGISLACAO_ICMSST"
      SET ${setClause}
      WHERE "LEI_ID" = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await client.query(query, [...values, id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Legislação não encontrada para atualizar.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar legislação:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA DELETAR (DELETE) ---
const handleDelete = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: number,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO:
    const query =
      'DELETE FROM db_manaus."CAD_LEGISLACAO_ICMSST" WHERE "LEI_ID" = $1';
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Legislação não encontrada para deletar.' });
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Erro ao deletar legislação:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
