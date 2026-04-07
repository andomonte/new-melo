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

    // ✅ ADAPTADO: Busca por NCM
    const whereClause = search ? `WHERE "LIN_NCM" ILIKE $3` : '';
    const searchParam = search ? [`%${search}%`] : [];

    // ✅ ADAPTADO:
    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_ICMSST_NCM" ${whereClause}`;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    // ✅ ADAPTADO:
    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_ICMSST_NCM"
      ${whereClause}
      ORDER BY "LIN_ID" DESC
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
    console.error('Erro ao listar NCMs da legislação:', error);
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
      LIN_ID: '"LIN_ID"',
      LIN_LEI_ID: '"LIN_LEI_ID"',
      LIN_NCM: '"LIN_NCM"',
      LIN_STATUS: '"LIN_STATUS"',
      LIN_MVA_ST_ORIGINAL: '"LIN_MVA_ST_ORIGINAL"',
      LIN_CEST: '"LIN_CEST"',
      LIN_DATA_CADASTRO: '"LIN_DATA_CADASTRO"',
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

    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_ICMSST_NCM" ${whereClause}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_ICMSST_NCM"
      ${whereClause}
      ORDER BY "LIN_ID" DESC
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
    console.error('Erro ao listar NCMs da legislação com filtros:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  // ✅ ADAPTADO: Removido LIN_ID do body
  const { LIN_LEI_ID, LIN_NCM, LIN_STATUS, LIN_MVA_ST_ORIGINAL, LIN_CEST } =
    req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // ✅ ADAPTADO: Validação dos campos obrigatórios
  if (!LIN_LEI_ID || !LIN_NCM || !LIN_STATUS) {
    return res.status(400).json({
      error: 'Os campos LIN_LEI_ID, LIN_NCM e LIN_STATUS são obrigatórios.',
    });
  }

  if (
    LIN_MVA_ST_ORIGINAL === undefined ||
    LIN_MVA_ST_ORIGINAL === '' ||
    LIN_MVA_ST_ORIGINAL === null
  ) {
    return res
      .status(400)
      .json({ error: 'O campo MVA ST Original é obrigatório.' });
  }

  // ✅ NOVA VALIDAÇÃO: Verificar se MVA está no intervalo correto
  const mvaValue = parseFloat(LIN_MVA_ST_ORIGINAL);
  if (isNaN(mvaValue)) {
    return res
      .status(400)
      .json({ error: 'MVA ST Original deve ser um número válido.' });
  }

  if (mvaValue < 0) {
    return res
      .status(400)
      .json({
        error: 'MVA ST Original não pode ser negativo. Valor mínimo: 0%',
      });
  }

  if (mvaValue > 100) {
    return res
      .status(400)
      .json({
        error:
          'MVA ST Original não pode ser maior que 100%. Valor máximo: 100.00%',
      });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ ADAPTADO: Obtendo o próximo ID automaticamente
    const nextIdQuery = `SELECT COALESCE(MAX("LIN_ID"), 0) + 1 as next_id FROM db_manaus."CAD_LEGISLACAO_ICMSST_NCM"`;
    const nextIdResult = await client.query(nextIdQuery);
    const nextId = nextIdResult.rows[0].next_id;

    const query = `
      INSERT INTO db_manaus."CAD_LEGISLACAO_ICMSST_NCM" (
        "LIN_ID", "LIN_LEI_ID", "LIN_NCM", "LIN_STATUS", "LIN_MVA_ST_ORIGINAL", "LIN_CEST"
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      nextId,
      LIN_LEI_ID,
      LIN_NCM,
      LIN_STATUS,
      mvaValue, // Usar o valor já validado
      LIN_CEST || null, // Se CEST não for fornecido, inserir NULL
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      // ✅ ADAPTADO:
      return res
        .status(409)
        .json({ error: 'Já existe um NCM da legislação com estes dados.' });
    }
    console.error('Erro ao criar NCM da legislação:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
