// pages/api/cfop/[cfop].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// ✅ Padronizando o nome da tabela em uma constante para evitar erros
const TABLE_NAME = 'public."dbcfop_n"';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { cfop } = req.query;

  if (!cfop || typeof cfop !== 'string') {
    return res.status(400).json({ error: 'CFOP inválido na URL.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, cfop);
      break;
    case 'PUT':
      await handleUpdate(req, res, cfop);
      break;
    case 'DELETE':
      await handleDelete(req, res, cfop);
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
  cfop: string,
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

    // ✅ Usando o nome da tabela correto
    const query = `SELECT * FROM ${TABLE_NAME} WHERE "cfop" = $1`;
    const result = await client.query(query, [cfop]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'CFOP não encontrado.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter CFOP:', error);
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
  cfop: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const allowedFields = ['descr', 'cfopinverso', 'excecao'];

  const dataToUpdate: { [key: string]: any } = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      // Para cfopinverso, permite null se estiver vazio
      if (field === 'cfopinverso') {
        dataToUpdate[field] = req.body[field] || null;
      } else {
        dataToUpdate[field] = req.body[field];
      }
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

    // ✅ Usando o nome da tabela correto
    const query = `
      UPDATE ${TABLE_NAME}
      SET ${setClause}
      WHERE "cfop" = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await client.query(query, [...values, cfop]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'CFOP não encontrado para atualizar.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar CFOP:', error);
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
  cfop: string,
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

    // ✅ Usando o nome da tabela correto
    const query = `DELETE FROM ${TABLE_NAME} WHERE "cfop" = $1`;
    const result = await client.query(query, [cfop]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'CFOP não encontrado para deletar.' });
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Erro ao deletar CFOP:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
