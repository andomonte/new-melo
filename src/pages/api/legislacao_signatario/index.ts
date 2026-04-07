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

    // ✅ ADAPTADO: Busca por UF
    const whereClause = search ? `WHERE "LES_UF" ILIKE $3` : '';
    const searchParam = search ? [`%${search}%`] : [];

    // ✅ ADAPTADO:
    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO" ${whereClause}`;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    // ✅ ADAPTADO:
    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO"
      ${whereClause}
      ORDER BY "LES_ID" DESC
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
    console.error('Erro ao listar signatários:', error);
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
      LES_ID: '"LES_ID"',
      LES_LEI_ID: '"LES_LEI_ID"',
      LES_UF: '"LES_UF"',
      LES_MVA_ST_ORIGINAL: '"LES_MVA_ST_ORIGINAL"',
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

    const totalQuery = `SELECT COUNT(*) FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO" ${whereClause}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO"
      ${whereClause}
      ORDER BY "LES_ID" DESC
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
    console.error('Erro ao listar signatários com filtros:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  // ✅ ADAPTADO: Removido LES_ID do body
  const { LES_LEI_ID, LES_UF, LES_MVA_ST_ORIGINAL } = req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // ✅ ADAPTADO: Validação dos campos obrigatórios
  if (!LES_LEI_ID || !LES_UF) {
    return res
      .status(400)
      .json({ error: 'Os campos LES_LEI_ID e LES_UF são obrigatórios.' });
  }

  if (
    LES_MVA_ST_ORIGINAL === undefined ||
    LES_MVA_ST_ORIGINAL === '' ||
    LES_MVA_ST_ORIGINAL === null
  ) {
    return res
      .status(400)
      .json({ error: 'O campo MVA ST Original é obrigatório.' });
  }

  // ✅ NOVA VALIDAÇÃO: Verificar se MVA está no intervalo correto
  const mvaValue = parseFloat(LES_MVA_ST_ORIGINAL);
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
    const nextIdQuery = `SELECT COALESCE(MAX("LES_ID"), 0) + 1 as next_id FROM db_manaus."CAD_LEGISLACAO_SIGNATARIO"`;
    const nextIdResult = await client.query(nextIdQuery);
    const nextId = nextIdResult.rows[0].next_id;

    const query = `
      INSERT INTO db_manaus."CAD_LEGISLACAO_SIGNATARIO" (
        "LES_ID", "LES_LEI_ID", "LES_UF", "LES_MVA_ST_ORIGINAL"
      ) VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [
      nextId,
      LES_LEI_ID,
      LES_UF,
      mvaValue, // Usar o valor já validado
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      // ✅ ADAPTADO:
      return res
        .status(409)
        .json({ error: 'Já existe um signatário com estes dados.' });
    }
    console.error('Erro ao criar signatário:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
