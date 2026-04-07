import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codprod } = req.query;

  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({ error: 'Cód. do Produto inválido na URL.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, codprod);
      break;
    case 'PUT':
      await handleUpdate(req, res, codprod);
      break;
    case 'DELETE':
      await handleDelete(req, res, codprod);
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
  codprod: string,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query =
      'SELECT * FROM db_manaus."DBFORMACAOPRVENDA" WHERE "CODPROD" = $1';
    const result = await client.query(query, [codprod]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Formação de preço não encontrada.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter formação de preço:', error);
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
  codprod: string,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const allowedFields = [
    'TIPOPRECO',
    'MARGEMLIQUIDA',
    'ICMSDEVOL',
    'ICMS',
    'IPI',
    'PIS',
    'COFINS',
    'DCI',
    'COMISSAO',
    'FATORDESPESAS',
    'PRECOVENDA',
    'TAXACARTAO',
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

  // Validações para campos obrigatórios na atualização
  const errors: string[] = [];

  if (
    dataToUpdate.PRECOVENDA !== undefined &&
    (dataToUpdate.PRECOVENDA === null || dataToUpdate.PRECOVENDA <= 0)
  ) {
    errors.push('O campo PRECOVENDA deve ser maior que zero.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: errors.join(' '),
      details: errors,
    });
  }

  const setClause = fields
    .map((key, index) => `"${key}" = $${index + 1}`)
    .join(', ');
  const values = Object.values(dataToUpdate);

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      UPDATE db_manaus."DBFORMACAOPRVENDA"
      SET ${setClause}
      WHERE "CODPROD" = $${fields.length + 1}
      RETURNING *;
    `;
    const result = await client.query(query, [...values, codprod]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Formação de preço não encontrada para atualizar.' });
    }

    res.status(200).json({
      success: true,
      message: 'Formação de preço atualizada com sucesso!',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Erro ao atualizar formação de preço:', error);
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
  codprod: string,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query =
      'DELETE FROM db_manaus."DBFORMACAOPRVENDA" WHERE "CODPROD" = $1';
    const result = await client.query(query, [codprod]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Formação de preço não encontrada para deletar.' });
    }

    res.status(200).json({
      success: true,
      message: 'Formação de preço deletada com sucesso!',
    });
  } catch (error: any) {
    console.error('Erro ao deletar formação de preço:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
