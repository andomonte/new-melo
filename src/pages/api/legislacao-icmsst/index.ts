// pages/api/legislacao-icmsst/index.ts

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
      if (req.body.filtros !== undefined) {
        // Se tem filtros no body, é uma busca com filtros
        await handleGetListWithFilters(req, res);
      } else {
        // Senão é criação
        await handleCreate(req, res);
      }
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

    const whereClause = search
      ? `WHERE CAST("LEI_PROTOCOLO" AS TEXT) ILIKE $3`
      : '';
    const searchParam = search ? [`%${search}%`] : [];

    // ✅ ADAPTADO:
    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_ICMSST" ${whereClause}`;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    // ✅ ADAPTADO:
    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_ICMSST"
      ${whereClause}
      ORDER BY "LEI_ID" DESC
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
    console.error('Erro ao listar legislações:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA LISTAR COM FILTROS (POST) ---
const handleGetListWithFilters = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const { page = 1, perPage = 10, filtros = [] } = req.body;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Mapeamento das colunas para evitar SQL injection
    const filtroParaColunaSQL: Record<string, string> = {
      LEI_ID: '"LEI_ID"',
      LEI_PROTOCOLO: '"LEI_PROTOCOLO"',
      LEI_STATUS: '"LEI_STATUS"',
      LEI_DATA_VIGENCIA: '"LEI_DATA_VIGENCIA"',
      LEI_DATA_PUBLICACAO: '"LEI_DATA_PUBLICACAO"',
      LEI_MVA_AJUSTADA: '"LEI_MVA_AJUSTADA"',
      LEI_TIPO: '"LEI_TIPO"',
      LEI_DATA_CADASTRO: '"LEI_DATA_CADASTRO"',
    };

    const params: any[] = [];
    const whereGroups: string[] = [];

    // Processar filtros
    filtros.forEach((filtro: any) => {
      const { campo, tipo, valor } = filtro;
      const coluna = filtroParaColunaSQL[campo];

      if (!coluna) return; // Ignorar campos não mapeados

      let condicao = '';
      params.push(valor);
      const paramIndex = params.length;

      switch (tipo) {
        case 'igual':
          condicao = `${coluna} = $${paramIndex}`;
          break;
        case 'contém':
          condicao = `${coluna}::text ILIKE $${paramIndex}`;
          params[paramIndex - 1] = `%${valor}%`;
          break;
        case 'começa':
          condicao = `${coluna}::text ILIKE $${paramIndex}`;
          params[paramIndex - 1] = `${valor}%`;
          break;
        case 'termina':
          condicao = `${coluna}::text ILIKE $${paramIndex}`;
          params[paramIndex - 1] = `%${valor}`;
          break;
        case 'diferente':
          condicao = `${coluna} != $${paramIndex}`;
          break;
        case 'maior':
          condicao = `${coluna} > $${paramIndex}`;
          break;
        case 'menor':
          condicao = `${coluna} < $${paramIndex}`;
          break;
        case 'maior_igual':
          condicao = `${coluna} >= $${paramIndex}`;
          break;
        case 'menor_igual':
          condicao = `${coluna} <= $${paramIndex}`;
          break;
        case 'nulo':
          condicao = `${coluna} IS NULL`;
          params.pop(); // Remove o parâmetro desnecessário
          break;
        case 'nao_nulo':
          condicao = `${coluna} IS NOT NULL`;
          params.pop(); // Remove o parâmetro desnecessário
          break;
        default:
          params.pop(); // Remove o parâmetro se o tipo não for reconhecido
          return;
      }

      if (condicao) {
        whereGroups.push(condicao);
      }
    });

    const whereClause =
      whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_ICMSST" ${whereClause}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_ICMSST"
      ${whereClause}
      ORDER BY "LEI_ID" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      ...params,
      perPage,
      offset,
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
    console.error('Erro ao listar legislações ICMS ST com filtros:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    LEI_ID,
    LEI_PROTOCOLO,
    LEI_STATUS,
    LEI_DATA_VIGENCIA,
    LEI_DATA_PUBLICACAO,
    LEI_MVA_AJUSTADA,
    LEI_TIPO,
  } = req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }
  if (!LEI_ID) {
    return res.status(400).json({ error: 'O campo LEI_ID é obrigatório.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO:
    const query = `
      INSERT INTO db_manaus."CAD_LEGISLACAO_ICMSST" (
        "LEI_ID", "LEI_PROTOCOLO", "LEI_DATA_CADASTRO", "LEI_STATUS", "LEI_DATA_VIGENCIA",
        "LEI_DATA_PUBLICACAO", "LEI_MVA_AJUSTADA", "LEI_TIPO"
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      LEI_ID,
      LEI_PROTOCOLO,
      LEI_STATUS,
      LEI_DATA_VIGENCIA,
      LEI_DATA_PUBLICACAO,
      LEI_MVA_AJUSTADA,
      LEI_TIPO,
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Já existe uma legislação com este ID.' });
    }
    console.error('Erro ao criar legislação:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
