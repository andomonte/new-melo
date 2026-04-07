import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { localPecaSchema } from '@/data/locaisPecas/locaisPecasSchema';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  switch (req.method) {
    case 'GET':
      await handleGetList(req, res);
      break;
    case 'POST':
      if (req.body.action === 'create') {
        await handleCreate(req, res);
      } else {
        await handleGetListWithFilters(req, res);
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

    // Construir filtro de busca
    const whereClause = search
      ? `WHERE (
      l.id_local ILIKE $3 OR 
      l.descricao ILIKE $3 OR 
      l.tipo_local ILIKE $3 OR 
      a.nome ILIKE $3
    )`
      : '';
    const searchParam = search ? [`%${search}%`] : [];

    // Query para contar total
    const totalQuery = `
      SELECT COUNT(*) 
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      ${whereClause}
    `;
    const totalResult = await client.query(totalQuery, searchParam);
    const total = parseInt(totalResult.rows[0].count, 10);

    // Query para buscar dados com paginação
    const dataQuery = `
      SELECT 
        l.id_local,
        l.id_armazem,
        l.descricao,
        l.tipo_local,
        l.capacidade,
        l.unidade,
        a.id_armazem as armazem_id,
        a.nome as armazem_nome,
        a.filial as armazem_filial,
        a.ativo as armazem_ativo
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      ${whereClause}
      ORDER BY l.id_local ASC
      LIMIT $1 OFFSET $2;
    `;

    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      perPage,
      offset,
      ...searchParam,
    ]);

    // Formatação dos dados
    const formattedData = dataResult.rows.map((row) => ({
      id_local: row.id_local,
      id_armazem: row.id_armazem,
      descricao: row.descricao,
      tipo_local: row.tipo_local,
      capacidade: row.capacidade ? parseFloat(row.capacidade.toString()) : null,
      unidade: row.unidade,
      armazem: {
        id_armazem: row.armazem_id,
        nome: row.armazem_nome,
        filial: row.armazem_filial,
        ativo: row.armazem_ativo,
      },
    }));

    const lastPage = Math.ceil(total / perPage);
    const meta = {
      total: total,
      perPage: perPage,
      currentPage: page,
      lastPage: lastPage,
      firstPage: 1,
    };

    res.status(200).json({ data: formattedData, meta });
  } catch (error: any) {
    console.error('Erro ao listar locais das peças:', error);
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
      id_local: 'l.id_local',
      id_armazem: 'l.id_armazem',
      descricao: 'l.descricao',
      tipo_local: 'l.tipo_local',
      capacidade: 'l.capacidade',
      unidade: 'l.unidade',
      armazem_nome: 'a.nome',
    };

    const params: any[] = [];
    const whereGroups: string[] = [];

    // Processar filtros
    filtros.forEach((filtro: any) => {
      if (filtro.campo && filtro.operador && filtro.valor !== undefined) {
        const colunaSQL = filtroParaColunaSQL[filtro.campo];
        if (!colunaSQL) return;

        const paramIndex = params.length + 1;

        switch (filtro.operador) {
          case 'igual':
            whereGroups.push(`${colunaSQL} = $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'diferente':
            whereGroups.push(`${colunaSQL} != $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'contem':
            whereGroups.push(`${colunaSQL} ILIKE $${paramIndex}`);
            params.push(`%${filtro.valor}%`);
            break;
          case 'nao_contem':
            whereGroups.push(`${colunaSQL} NOT ILIKE $${paramIndex}`);
            params.push(`%${filtro.valor}%`);
            break;
          case 'comeca_com':
            whereGroups.push(`${colunaSQL} ILIKE $${paramIndex}`);
            params.push(`${filtro.valor}%`);
            break;
          case 'termina_com':
            whereGroups.push(`${colunaSQL} ILIKE $${paramIndex}`);
            params.push(`%${filtro.valor}`);
            break;
          case 'maior_que':
            whereGroups.push(`${colunaSQL} > $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'menor_que':
            whereGroups.push(`${colunaSQL} < $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'maior_igual':
            whereGroups.push(`${colunaSQL} >= $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'menor_igual':
            whereGroups.push(`${colunaSQL} <= $${paramIndex}`);
            params.push(filtro.valor);
            break;
          case 'nulo':
            whereGroups.push(`${colunaSQL} IS NULL`);
            break;
          case 'nao_nulo':
            whereGroups.push(`${colunaSQL} IS NOT NULL`);
            break;
        }
      }
    });

    const whereClause =
      whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

    const totalQuery = `
      SELECT COUNT(*) 
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      ${whereClause}
    `;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const dataQuery = `
      SELECT 
        l.id_local,
        l.id_armazem,
        l.descricao,
        l.tipo_local,
        l.capacidade,
        l.unidade,
        a.id_armazem as armazem_id,
        a.nome as armazem_nome,
        a.filial as armazem_filial,
        a.ativo as armazem_ativo
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      ${whereClause}
      ORDER BY l.id_local ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const offset = (page - 1) * perPage;
    const dataResult = await client.query(dataQuery, [
      ...params,
      perPage,
      offset,
    ]);

    // Formatação dos dados
    const formattedData = dataResult.rows.map((row) => ({
      id_local: row.id_local,
      id_armazem: row.id_armazem,
      descricao: row.descricao,
      tipo_local: row.tipo_local,
      capacidade: row.capacidade ? parseFloat(row.capacidade.toString()) : null,
      unidade: row.unidade,
      armazem: {
        id_armazem: row.armazem_id,
        nome: row.armazem_nome,
        filial: row.armazem_filial,
        ativo: row.armazem_ativo,
      },
    }));

    const lastPage = Math.ceil(total / perPage);
    const meta = {
      total: total,
      perPage: perPage,
      currentPage: page,
      lastPage: lastPage,
      firstPage: 1,
    };

    res.status(200).json({ data: formattedData, meta });
  } catch (error: any) {
    console.error('Erro ao listar locais das peças com filtros:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // Validar dados com Zod
  const validationResult = localPecaSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: validationResult.error.errors,
    });
  }

  const { id_local, id_armazem, descricao, tipo_local, capacidade, unidade } =
    validationResult.data;

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Verificar se o ID já existe
    const existingQuery = 'SELECT id_local FROM dblocal WHERE id_local = $1';
    const existingResult = await client.query(existingQuery, [id_local]);

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      return res.status(409).json({
        error: 'ID do local já existe. Escolha outro ID.',
      });
    }

    // Verificar se o armazém existe
    const armazemQuery =
      'SELECT id_armazem, nome, filial, ativo FROM dbarmazem WHERE id_armazem = $1';
    const armazemResult = await client.query(armazemQuery, [id_armazem]);

    if (!armazemResult.rowCount || armazemResult.rowCount === 0) {
      return res.status(400).json({
        error: 'Armazém não encontrado',
      });
    }

    // Criar o local
    const insertQuery = `
      INSERT INTO dblocal (
        id_local, 
        id_armazem, 
        descricao, 
        tipo_local, 
        capacidade, 
        unidade
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const insertResult = await client.query(insertQuery, [
      id_local,
      id_armazem,
      descricao || null,
      tipo_local || null,
      capacidade ? capacidade.toString() : null,
      unidade || null,
    ]);

    const novoLocal = insertResult.rows[0];
    const armazemData = armazemResult.rows[0];

    const response = {
      data: {
        id_local: novoLocal.id_local,
        id_armazem: novoLocal.id_armazem,
        descricao: novoLocal.descricao,
        tipo_local: novoLocal.tipo_local,
        capacidade: novoLocal.capacidade
          ? parseFloat(novoLocal.capacidade.toString())
          : null,
        unidade: novoLocal.unidade,
        armazem: {
          id_armazem: armazemData.id_armazem,
          nome: armazemData.nome,
          filial: armazemData.filial,
          ativo: armazemData.ativo,
        },
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Erro ao criar local da peça:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
