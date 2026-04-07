// pages/api/cfop/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// ✅ Padronizando o nome da tabela em uma constante para evitar erros
const TABLE_NAME = 'public."dbcfop_n"';

// Mapeamento das colunas para filtros
const filtroParaColunaSQL: Record<string, string> = {
  cfop: '"cfop"',
  descr: '"descr"',
  cfopinverso: '"cfopinverso"',
  excecao: '"excecao"',
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  switch (req.method) {
    case 'GET':
      await handleGetList(req, res);
      break;
    case 'POST':
      // Verifica se é listagem com filtros (tem page/filtros) ou criação (tem cfop/descr)
      if ('page' in req.body || 'filtros' in req.body || 'search' in req.body) {
        await handleGetList(req, res);
      } else {
        await handleCreate(req, res);
      }
      break;
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- FUNÇÃO PARA LISTAR (GET/POST) ---
const handleGetList = async (req: NextApiRequest, res: NextApiResponse) => {
  // Suporta tanto GET quanto POST
  const isPost = req.method === 'POST';
  const source = isPost ? req.body : req.query;

  const page = Number(source.page) || 1;
  const perPage = Number(source.perPage) || 10;
  const search = (source.search as string) || '';
  const filtros = source.filtros || [];

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const params: any[] = [];
    const whereGroups: string[] = [];

    // Processar filtros avançados (se houver)
    if (Array.isArray(filtros) && filtros.length > 0) {
      console.log('🔍 Processando filtros avançados:', filtros);

      // Agrupa filtros pelo campo
      const filtrosAgrupados: Record<
        string,
        { tipo: string; valor: string }[]
      > = {};

      filtros.forEach(
        (filtro: { campo: string; tipo: string; valor: string }) => {
          if (!filtrosAgrupados[filtro.campo]) {
            filtrosAgrupados[filtro.campo] = [];
          }
          filtrosAgrupados[filtro.campo].push({
            tipo: filtro.tipo,
            valor: filtro.valor,
          });
        },
      );

      // Para cada campo agrupado
      Object.entries(filtrosAgrupados).forEach(([campo, filtrosDoCampo]) => {
        const coluna = filtroParaColunaSQL[campo];
        if (!coluna) {
          console.log(`⚠️ Campo ${campo} não encontrado no mapeamento`);
          return;
        }

        const filtrosCampoSQL: string[] = [];

        filtrosDoCampo.forEach((filtro) => {
          let operador = 'ILIKE';
          let valor = '';

          switch (filtro.tipo) {
            case 'igual':
              operador = '=';
              valor = String(filtro.valor);
              break;
            case 'diferente':
              operador = '<>';
              valor = String(filtro.valor);
              break;
            case 'maior':
              operador = '>';
              valor = String(filtro.valor);
              break;
            case 'maior_igual':
              operador = '>=';
              valor = String(filtro.valor);
              break;
            case 'menor':
              operador = '<';
              valor = String(filtro.valor);
              break;
            case 'menor_igual':
              operador = '<=';
              valor = String(filtro.valor);
              break;
            case 'contém':
              operador = 'ILIKE';
              valor = `%${String(filtro.valor)}%`;
              break;
            case 'começa':
              operador = 'ILIKE';
              valor = `${String(filtro.valor)}%`;
              break;
            case 'termina':
              operador = 'ILIKE';
              valor = `%${String(filtro.valor)}`;
              break;
            case 'nulo':
              filtrosCampoSQL.push(`${coluna} IS NULL`);
              return;
            case 'nao_nulo':
              filtrosCampoSQL.push(`${coluna} IS NOT NULL`);
              return;
            default:
              return;
          }

          filtrosCampoSQL.push(`${coluna} ${operador} $${params.length + 1}`);
          params.push(valor);
        });

        // Junta todos os filtros do mesmo campo com OR
        if (filtrosCampoSQL.length > 0) {
          whereGroups.push(`(${filtrosCampoSQL.join(' OR ')})`);
        }
      });
    }

    // Processar busca global (se houver e não houver filtros)
    if (search && whereGroups.length === 0) {
      console.log('🔍 Processando busca global:', search);
      whereGroups.push(
        `("cfop" ILIKE $${params.length + 1} OR "descr" ILIKE $${
          params.length + 2
        })`,
      );
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereString =
      whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

    console.log('📊 Query WHERE:', whereString);
    console.log('📊 Params:', params);

    // Query de contagem total
    const totalQuery = `SELECT COUNT(*) FROM ${TABLE_NAME} ${whereString}`;
    const totalResult = await client.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    // Query de dados
    const offset = (page - 1) * perPage;
    const dataQuery = `
      SELECT * FROM ${TABLE_NAME}
      ${whereString}
      ORDER BY "cfop" ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const dataResult = await client.query(dataQuery, [
      ...params,
      perPage,
      offset,
    ]);

    const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;

    console.log(
      `✅ Retornando ${dataResult.rows.length} registros de ${total} total`,
    );

    res.status(200).json({
      data: dataResult.rows,
      meta: {
        total,
        perPage,
        currentPage: total > 0 ? page : 1,
        lastPage,
        firstPage: 1,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar CFOPs:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA CRIAR (POST) ---
const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { cfop, descr, cfopinverso, excecao } = req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }
  if (!cfop) {
    return res.status(400).json({ error: 'O campo CFOP é obrigatório.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      INSERT INTO ${TABLE_NAME} (
        "cfop", "descr", "cfopinverso", "excecao"
      ) VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [
      cfop,
      descr,
      cfopinverso || null, // Permite null se estiver vazio
      excecao || 'N',
    ];

    const result = await client.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Já existe um registro com este CFOP.' });
    }
    console.error('Erro ao criar CFOP:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
