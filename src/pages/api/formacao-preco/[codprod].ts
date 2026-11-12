import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';

// Cada produto tem uma linha por tipo de preço (0 a 7) em dbformacaoprvenda.
// A URL aceita "CODPROD-TIPOPRECO" (ex.: 007453-1) para apontar uma linha só;
// só "CODPROD" mantém o comportamento antigo no GET (primeiro tipo) e no
// DELETE (todos os tipos). O PUT exige o tipo, senão gravaria os mesmos
// valores em todos os tipos do produto.
interface Chave {
  codprod: string;
  tipo: number | null;
}

const lerChave = (bruta: string): Chave | null => {
  const m = bruta.trim().match(/^([^-]+)(?:-(\d+))?$/);
  if (!m) return null;
  return { codprod: m[1], tipo: m[2] === undefined ? null : Number(m[2]) };
};

const filtroChave = (c: Chave) =>
  c.tipo === null
    ? { where: '"CODPROD" = $1', params: [c.codprod] as unknown[] }
    : { where: '"CODPROD" = $1 AND "TIPOPRECO" = $2', params: [c.codprod, c.tipo] as unknown[] };

const CHAVE_SQL = `"CODPROD" || '-' || "TIPOPRECO" AS "CHAVE"`;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { codprod } = req.query;

  const chave = typeof codprod === 'string' ? lerChave(codprod) : null;
  if (!chave) {
    return res.status(400).json({ error: 'Cód. do Produto inválido na URL.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, chave);
      break;
    case 'PUT':
      await handleUpdate(req, res, chave);
      break;
    case 'DELETE':
      await handleDelete(req, res, chave);
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
  chave: Chave,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();

    const { where, params } = filtroChave(chave);
    const query = `SELECT *, ${CHAVE_SQL} FROM dbformacaoprvenda
                    WHERE ${where} ORDER BY "TIPOPRECO" LIMIT 1`;
    const result = await client.query(query, params);

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
  chave: Chave,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // O tipo vem da URL ou do corpo; sem ele o UPDATE pegaria todos os tipos.
  const tipoBody = req.body?.TIPOPRECO;
  const tipo =
    chave.tipo ?? (tipoBody === undefined || tipoBody === null || tipoBody === '' ? null : Number(tipoBody));
  if (tipo === null || !Number.isInteger(tipo)) {
    return res.status(400).json({ error: 'Informe o tipo de preço da linha a alterar.' });
  }

  // CODPROD e TIPOPRECO formam a chave da linha: não são alteráveis aqui.
  const allowedFields = [
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
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();

    const query = `
      UPDATE dbformacaoprvenda
      SET ${setClause}
      WHERE "CODPROD" = $${fields.length + 1} AND "TIPOPRECO" = $${fields.length + 2}
      RETURNING *, ${CHAVE_SQL};
    `;
    const result = await client.query(query, [...values, chave.codprod, tipo]);

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
  chave: Chave,
) => {
  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();

    const { where, params } = filtroChave(chave);
    const result = await client.query(`DELETE FROM dbformacaoprvenda WHERE ${where}`, params);

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
