import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  switch (req.method) {
    case 'GET':
      await handleGetList(req, res);
      break;
    case 'POST':
      await handleCreate(req, res);
      break;
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- FUNÇÃO PARA LISTAR (GET) ---
const handleGetList = async (req: NextApiRequest, res: NextApiResponse) => {
  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 10;
  const search = (req.query.search as string) || '';
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO: Busca pelo nome do contribuinte ou CGC
    const whereClause = search
      ? `WHERE "nomecontribuinte" ILIKE $3 OR "cgc" ILIKE $3`
      : '';
    const searchParam = search ? [`%${search}%`] : [];

    // ✅ ADAPTADO: Contagem total de empresas
    const totalQuery = `SELECT COUNT(*) FROM db_manaus."dadosempresa" ${whereClause}`;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    // ✅ ADAPTADO: Busca paginada de empresas
    const dataQuery = `
      SELECT * FROM db_manaus."dadosempresa"
      ${whereClause}
      ORDER BY "nomecontribuinte" ASC
      LIMIT $1 OFFSET $2;
    `;
    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      perPage,
      offset,
      ...searchParam,
    ]);

    const lastPage = Math.ceil(total / perPage);
    const meta = {
      total: total,
      perPage: perPage,
      currentPage: page,
      lastPage: lastPage,
      firstPage: 1,
    };
    res.status(200).json({ data: dataResult.rows, meta });
  } catch (error: any) {
    console.error('Erro ao listar empresas:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  // ✅ ADAPTADO: Lista de todos os campos da tabela dadosempresa
  const {
    cgc,
    inscricaoestadual,
    nomecontribuinte,
    municipio,
    uf,
    fax,
    codigoconvenio,
    codigonatureza,
    codigofinalidade,
    logradouro,
    numero,
    complemento,
    bairro,
    cep,
    contato,
    telefone,
    suframa,
    email,
    inscricaoestadual_07,
    inscricaomunicipal,
    id_token,
    token,
    certificado,
  } = req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // ✅ ADAPTADO: Validação do campo obrigatório (CGC/CNPJ)
  if (!cgc) {
    return res.status(400).json({ error: 'O campo CGC (CNPJ) é obrigatório.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO: Query de inserção para a tabela dadosempresa
    const query = `
      INSERT INTO db_manaus."dadosempresa" (
        "cgc", "inscricaoestadual", "nomecontribuinte", "municipio", "uf", "fax",
        "codigoconvenio", "codigonatureza", "codigofinalidade", "logradouro",
        "numero", "complemento", "bairro", "cep", "contato", "telefone", "suframa", "email",
        "inscricaoestadual_07", "inscricaomunicipal", "id_token", "token", "certificado"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *;
    `;
    const values = [
      cgc,
      inscricaoestadual,
      nomecontribuinte,
      municipio,
      uf,
      fax,
      codigoconvenio,
      codigonatureza,
      codigofinalidade,
      logradouro,
      numero,
      complemento,
      bairro,
      cep,
      contato,
      telefone,
      suframa,
      email,
      inscricaoestadual_07,
      inscricaomunicipal,
      id_token,
      token,
      certificado,
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // ✅ ADAPTADO: Tratamento de erro para chave primária duplicada
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Já existe uma empresa com este CGC (CNPJ).' });
    }
    console.error('Erro ao criar empresa:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
