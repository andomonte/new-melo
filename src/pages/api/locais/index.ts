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
  // Documentação: Captura parâmetros da URL para paginação, busca e filtros.
  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 10;
  const search = (req.query.search as string) || '';
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  // Parse dos filtros avançados
  let filtros: Array<{ campo: string; tipo: string; valor: string }> = [];
  if (req.query.filtros) {
    try {
      filtros = JSON.parse(req.query.filtros as string);
    } catch (error) {
      console.error('Erro ao fazer parse dos filtros:', error);
    }
  }

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Construir cláusula WHERE dinâmica
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Busca geral (pesquisa por ID ou descrição)
    if (search) {
      whereClauses.push(
        `(id_local ILIKE $${paramIndex} OR descricao ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filtros avançados por coluna
    if (filtros && filtros.length > 0) {
      for (const filtro of filtros) {
        const { campo, tipo, valor } = filtro;

        // Ignorar filtros sem valor (exceto para 'nulo' e 'nao_nulo')
        if (!valor && tipo !== 'nulo' && tipo !== 'nao_nulo') continue;

        switch (tipo) {
          case 'contém':
            whereClauses.push(`${campo} ILIKE $${paramIndex}`);
            params.push(`%${valor}%`);
            paramIndex++;
            break;
          case 'começa':
            whereClauses.push(`${campo} ILIKE $${paramIndex}`);
            params.push(`${valor}%`);
            paramIndex++;
            break;
          case 'termina':
            whereClauses.push(`${campo} ILIKE $${paramIndex}`);
            params.push(`%${valor}`);
            paramIndex++;
            break;
          case 'igual':
            whereClauses.push(`${campo} = $${paramIndex}`);
            params.push(valor);
            paramIndex++;
            break;
          case 'diferente':
            whereClauses.push(`${campo} != $${paramIndex}`);
            params.push(valor);
            paramIndex++;
            break;
          case 'maior':
            whereClauses.push(`${campo}::numeric > $${paramIndex}::numeric`);
            params.push(valor);
            paramIndex++;
            break;
          case 'maior_igual':
            whereClauses.push(`${campo}::numeric >= $${paramIndex}::numeric`);
            params.push(valor);
            paramIndex++;
            break;
          case 'menor':
            whereClauses.push(`${campo}::numeric < $${paramIndex}::numeric`);
            params.push(valor);
            paramIndex++;
            break;
          case 'menor_igual':
            whereClauses.push(`${campo}::numeric <= $${paramIndex}::numeric`);
            params.push(valor);
            paramIndex++;
            break;
          case 'nulo':
            whereClauses.push(`${campo} IS NULL`);
            break;
          case 'nao_nulo':
            whereClauses.push(`${campo} IS NOT NULL`);
            break;
        }
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Documentação: Query para contar o número total de registros.
    const totalQuery = `SELECT COUNT(*) FROM dblocal ${whereClause}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    // Documentação: Query para buscar os dados com paginação e ordenação.
    const offset = (page - 1) * perPage;
    const dataQuery = `
      SELECT * FROM dblocal
      ${whereClause}
      ORDER BY id_local ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    const dataResult = await client.query(dataQuery, [
      ...params,
      perPage,
      offset,
    ]);

    // Documentação: Monta o objeto de metadados para a paginação.
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
    console.error('Erro ao listar locais:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  // Documentação: Extrai os campos do corpo da requisição.
  const { id_local, id_armazem, descricao, tipo_local, capacidade, unidade } =
    req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // Documentação: Validação dos campos obrigatórios.
  if (!id_local || !id_armazem) {
    return res
      .status(400)
      .json({ error: 'Os campos id_local e id_armazem são obrigatórios.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Documentação: Verifica se o armazém existe antes de criar o local
    const armazemQuery =
      'SELECT id_armazem FROM dbarmazem WHERE id_armazem = $1';
    const armazemResult = await client.query(armazemQuery, [id_armazem]);

    if (armazemResult.rowCount === 0) {
      return res.status(400).json({
        error: `Armazém com ID ${id_armazem} não encontrado. Verifique se o armazém existe.`,
      });
    }

    // Documentação: Verifica se já existe um local com este ID
    const localExistenteQuery =
      'SELECT id_local FROM dblocal WHERE id_local = $1';
    const localExistenteResult = await client.query(localExistenteQuery, [
      id_local,
    ]);

    if (localExistenteResult.rowCount && localExistenteResult.rowCount > 0) {
      return res.status(409).json({
        error: `Já existe um local com o ID '${id_local}'. Escolha outro ID.`,
      });
    }

    // Documentação: Query para inserir um novo registro na tabela "dblocal".
    const query = `
      INSERT INTO dblocal (
        id_local, id_armazem, descricao, tipo_local, capacidade, unidade
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      id_local,
      id_armazem,
      descricao,
      tipo_local,
      capacidade,
      unidade,
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // Documentação: Trata erros específicos do banco de dados.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe um local com este ID.' });
    } else if (error.code === '23503') {
      return res.status(400).json({
        error: 'Erro de referência: O armazém especificado não existe.',
        detail: error.detail,
      });
    }
    console.error('Erro ao criar local:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
