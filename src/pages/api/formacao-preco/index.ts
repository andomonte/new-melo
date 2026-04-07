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

// --- FUNÇÃO PARA LISTAR COM FILTROS (POST) ---
const handleGetListWithFilters = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const { page = 1, perPage = 10, filtros = [] } = req.body;
  const { filial_melo: filial } = parseCookies({ req });

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Mapeamento das colunas para evitar SQL injection
    const filtroParaColunaSQL: Record<string, string> = {
      CODPROD: '"CODPROD"',
      PRECOVENDA: '"PRECOVENDA"',
      MARGEMLIQUIDA: '"MARGEMLIQUIDA"',
      ICMS: '"ICMS"',
      IPI: '"IPI"',
      PIS: '"PIS"',
      COFINS: '"COFINS"',
      TIPOPRECO: '"TIPOPRECO"',
      ICMSDEVOL: '"ICMSDEVOL"',
      DCI: '"DCI"',
      COMISSAO: '"COMISSAO"',
      FATORDESPESAS: '"FATORDESPESAS"',
      TAXACARTAO: '"TAXACARTAO"',
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

    const totalQuery = `SELECT COUNT(*) FROM db_manaus."DBFORMACAOPRVENDA" ${whereClause}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM db_manaus."DBFORMACAOPRVENDA"
      ${whereClause}
      ORDER BY "CODPROD" ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      ...params,
      perPage,
      offset,
    ]);

    res.status(200).json({
      data: dataResult.rows,
      meta: {
        total,
        perPage,
        currentPage: page,
        lastPage: Math.ceil(total / perPage),
        firstPage: 1,
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar formações de preço com filtros:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA LISTAR (GET) ---
const handleGetList = async (req: NextApiRequest, res: NextApiResponse) => {
  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 10;
  const search = (req.query.search as string) || '';
  const { filial_melo: filial } = parseCookies({ req });

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Busca por Cód. do Produto
    const whereClause = search ? `WHERE "CODPROD" ILIKE $3` : '';
    const searchParam = search ? [`%${search}%`] : [];

    const totalQuery = `SELECT COUNT(*) FROM db_manaus."DBFORMACAOPRVENDA" ${whereClause}`;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM db_manaus."DBFORMACAOPRVENDA"
      ${whereClause}
      ORDER BY "CODPROD" ASC
      LIMIT $1 OFFSET $2;
    `;
    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      perPage,
      offset,
      ...searchParam,
    ]);

    res.status(200).json({
      data: dataResult.rows,
      meta: {
        total,
        perPage,
        currentPage: page,
        lastPage: Math.ceil(total / perPage),
        firstPage: 1,
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar formações de preço:', error);
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
    CODPROD,
    TIPOPRECO,
    MARGEMLIQUIDA,
    ICMSDEVOL,
    ICMS,
    IPI,
    PIS,
    COFINS,
    DCI,
    COMISSAO,
    FATORDESPESAS,
    PRECOVENDA,
    TAXACARTAO,
  } = req.body;

  const { filial_melo: filial } = parseCookies({ req });
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // Validações obrigatórias
  const errors: string[] = [];

  if (!CODPROD) {
    errors.push('O campo CODPROD é obrigatório.');
  }

  if (PRECOVENDA === undefined || PRECOVENDA === null || PRECOVENDA <= 0) {
    errors.push('O campo PRECOVENDA é obrigatório e deve ser maior que zero.');
  }

  if (MARGEMLIQUIDA === undefined || MARGEMLIQUIDA === null) {
    errors.push('O campo MARGEMLIQUIDA é obrigatório.');
  }

  if (TIPOPRECO === undefined || TIPOPRECO === null) {
    errors.push('O campo TIPOPRECO é obrigatório.');
  }

  if (ICMS === undefined || ICMS === null) {
    errors.push('O campo ICMS é obrigatório.');
  }

  if (IPI === undefined || IPI === null) {
    errors.push('O campo IPI é obrigatório.');
  }

  if (PIS === undefined || PIS === null) {
    errors.push('O campo PIS é obrigatório.');
  }

  if (COFINS === undefined || COFINS === null) {
    errors.push('O campo COFINS é obrigatório.');
  }

  if (ICMSDEVOL === undefined || ICMSDEVOL === null) {
    errors.push('O campo ICMSDEVOL é obrigatório.');
  }

  if (DCI === undefined || DCI === null) {
    errors.push('O campo DCI é obrigatório.');
  }

  if (COMISSAO === undefined || COMISSAO === null) {
    errors.push('O campo COMISSAO é obrigatório.');
  }

  if (FATORDESPESAS === undefined || FATORDESPESAS === null) {
    errors.push('O campo FATORDESPESAS é obrigatório.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: errors.join(' '),
      details: errors,
    });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      INSERT INTO db_manaus."DBFORMACAOPRVENDA" (
        "CODPROD", "TIPOPRECO", "MARGEMLIQUIDA", "ICMSDEVOL", "ICMS", "IPI", "PIS",
        "COFINS", "DCI", "COMISSAO", "FATORDESPESAS", "PRECOVENDA", "TAXACARTAO"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const values = [
      CODPROD,
      TIPOPRECO,
      MARGEMLIQUIDA,
      ICMSDEVOL,
      ICMS,
      IPI,
      PIS,
      COFINS,
      DCI,
      COMISSAO,
      FATORDESPESAS,
      PRECOVENDA,
      TAXACARTAO,
    ];

    const result = await client.query(query, values);
    res.status(201).json({
      success: true,
      message: 'Formação de preço criada com sucesso!',
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      // Código de erro para violação de chave única
      return res.status(409).json({
        error: 'Já existe uma formação de preço com este Cód. de Produto.',
      });
    }
    if (error.code === '23503') {
      // Código de erro para violação de chave estrangeira
      return res.status(400).json({
        error:
          'Código de produto não encontrado. Verifique se o produto existe.',
      });
    }
    console.error('Erro ao criar formação de preço:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
