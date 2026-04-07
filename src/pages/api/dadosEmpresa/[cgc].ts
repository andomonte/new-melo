import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ✅ ADAPTADO: Parâmetro da URL agora é 'cgc'
  const { cgc } = req.query;

  if (!cgc || typeof cgc !== 'string') {
    return res.status(400).json({ error: 'CGC (CNPJ) inválido na URL.' });
  }

  // O CGC já é uma string, então não precisamos converter para número.

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, cgc);
      break;
    case 'PUT':
      await handleUpdate(req, res, cgc);
      break;
    case 'DELETE':
      await handleDelete(req, res, cgc);
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- FUNÇÃO PARA OBTER UMA EMPRESA (GET) ---
const handleGetOne = async (
  req: NextApiRequest,
  res: NextApiResponse,
  cgc: string,
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

    // ✅ ADAPTADO: Query para buscar uma empresa pelo CGC
    const query = 'SELECT * FROM db_manaus."dadosempresa" WHERE "cgc" = $1';
    const result = await client.query(query, [cgc]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter empresa:', error);
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
  cgc: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // ✅ ADAPTADO: Lista de campos permitidos para atualização. O CGC não pode ser alterado.
  const allowedFields = [
    'inscricaoestadual',
    'nomecontribuinte',
    'municipio',
    'uf',
    'fax',
    'codigoconvenio',
    'codigonatureza',
    'codigofinalidade',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cep',
    'contato',
    'telefone',
    'suframa',
    'email',
    'inscricaoestadual_07',
    'inscricaomunicipal',
    'id_token',
    'token',
    'certificado',
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

    // ✅ ADAPTADO: Query de atualização para a tabela dadosempresa
    const query = `
      UPDATE db_manaus."dadosempresa"
      SET ${setClause}
      WHERE "cgc" = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await client.query(query, [...values, cgc]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Empresa não encontrada para atualizar.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar empresa:', error);
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
  cgc: string,
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

    // ✅ ADAPTADO: Query de deleção para a tabela dadosempresa
    const query = 'DELETE FROM db_manaus."dadosempresa" WHERE "cgc" = $1';
    const result = await client.query(query, [cgc]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Empresa não encontrada para deletar.' });
    }

    res.status(204).end(); // Sucesso, sem conteúdo para retornar
  } catch (error: any) {
    console.error('Erro ao deletar empresa:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
