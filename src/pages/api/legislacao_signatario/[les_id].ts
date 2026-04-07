import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ✅ ADAPTADO:
  const { les_id } = req.query;

  if (!les_id || typeof les_id !== 'string') {
    return res.status(400).json({ error: 'ID do signatário inválido na URL.' });
  }

  const id = Number(les_id);
  if (isNaN(id)) {
    return res
      .status(400)
      .json({ error: 'ID do signatário deve ser um número.' });
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
      'SELECT * FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO" WHERE "LES_ID" = $1';
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      // ✅ ADAPTADO:
      return res.status(404).json({ error: 'Signatário não encontrado.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter signatário:', error);
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

  // ✅ ADAPTADO:
  const allowedFields = ['LES_LEI_ID', 'LES_UF', 'LES_MVA_ST_ORIGINAL'];

  const dataToUpdate: { [key: string]: any } = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      // Tratar valores específicos para campos numéricos
      if (field === 'LES_MVA_ST_ORIGINAL') {
        if (req.body[field] === '' || req.body[field] === null) {
          dataToUpdate[field] = null;
        } else {
          const mvaValue = parseFloat(req.body[field]);
          if (isNaN(mvaValue)) {
            return res.status(400).json({
              error: 'MVA ST Original deve ser um número válido.',
            });
          }
          if (mvaValue < 0) {
            return res.status(400).json({
              error: 'MVA ST Original não pode ser negativo. Valor mínimo: 0%',
            });
          }
          if (mvaValue > 100) {
            return res.status(400).json({
              error:
                'MVA ST Original não pode ser maior que 100%. Valor máximo: 100.00%',
            });
          }
          dataToUpdate[field] = mvaValue;
        }
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

    // ✅ ADAPTADO:
    const query = `
      UPDATE db_manaus."CAD_LEGISLACAO_SIGNATARIO"
      SET ${setClause}
      WHERE "LES_ID" = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await client.query(query, [...values, id]);

    if (result.rowCount === 0) {
      // ✅ ADAPTADO:
      return res
        .status(404)
        .json({ error: 'Signatário não encontrado para atualizar.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar signatário:', error);
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
      'DELETE FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO" WHERE "LES_ID" = $1';
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      // ✅ ADAPTADO:
      return res
        .status(404)
        .json({ error: 'Signatário não encontrado para deletar.' });
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Erro ao deletar signatário:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
