import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface Produto {
  codprod: string;
  descr: string;
  marca: string;
  ref?: string;
  aplicacao?: string;
  estoque: number;
  prcompra: number;
  prvenda: number;
  multiplo?: number;
  multiplocompra?: number;
  grupoproduto?: string;
  unimed?: string;
}

interface ProdutoResponse {
  data: Produto[];
  meta: {
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProdutoResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const page = parseInt((req.query.page as string) ?? '1', 10);
  const perPage = parseInt((req.query.perPage as string) ?? '20', 10);
  const search = (req.query.search as string) ?? '';
  const codprod = (req.query.codprod as string) ?? '';
  const marca = (req.query.marca as string) ?? '';
  const grupoproduto = (req.query.grupoproduto as string) ?? '';
  const offset = (page - 1) * perPage;

  let client;
  
  try {
    client = await pool.connect();
    
    const whereConditions: string[] = [];
    const params: Array<string | number> = [];
    let paramCounter = 1;

    // Busca por código específico
    if (codprod) {
      whereConditions.push(`p.codprod = $${paramCounter}`);
      params.push(codprod);
      paramCounter++;
    }
    
    // Busca geral
    if (search && !codprod) {
      whereConditions.push(`(
        p.codprod ILIKE $${paramCounter} OR 
        p.descr ILIKE $${paramCounter} OR 
        p.ref ILIKE $${paramCounter}
      )`);
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Filtro por marca
    if (marca) {
      whereConditions.push(`p.codmarca ILIKE $${paramCounter}`);
      params.push(`%${marca}%`);
      paramCounter++;
    }

    // Filtro por grupo
    if (grupoproduto) {
      whereConditions.push(`p.codgpp ILIKE $${paramCounter}`);
      params.push(`%${grupoproduto}%`);
      paramCounter++;
    }

    const whereSQL = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Query principal - só retornar produtos com códigos de 6 caracteres
    const produtosQuery = `
      SELECT
        p.codprod,
        p.descr,
        COALESCE(m.descr, p.codmarca) as marca,
        p.ref,
        '' as aplicacao,
        COALESCE(p.qtest, 0) as estoque,
        ROUND(
          COALESCE(p.prcompra, 0) *
          CASE
            WHEN p.dolar = 'S' THEN COALESCE(p.txdolarcompra, 1)
            ELSE 1
          END,
          2
        ) as prcompra,
        COALESCE(p.prvenda, 0) as prvenda,
        COALESCE(p.prmedio, 0) as prmedio,
        COALESCE(p.primp, 0) as primp,
        COALESCE(p.prfabr, 0) as prfabr,
        COALESCE(p.multiplo, 1) as multiplo,
        COALESCE(p.multiplocompra, p.multiplo, 1) as multiplocompra,
        p.codgpp as grupoproduto,
        p.unimed
      FROM db_manaus.dbprod p
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      ${whereSQL}
      ${whereConditions.length > 0 ? 'AND' : 'WHERE'} LENGTH(p.codprod) = 6
      ORDER BY p.descr
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM db_manaus.dbprod p
      ${whereSQL}
      ${whereConditions.length > 0 ? 'AND' : 'WHERE'} LENGTH(p.codprod) = 6
    `;

    // Adicionar limit e offset
    const queryParams = [...params, perPage, offset];
    const countParams = params;

    // Executar queries
    const [produtosResult, countResult] = await Promise.all([
      client.query<Produto>(produtosQuery, queryParams),
      client.query<{ total: string }>(countQuery, countParams)
    ]);
    
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      data: produtosResult.rows,
      meta: {
        total,
        currentPage: page,
        lastPage: Math.ceil(total / perPage),
        perPage
      }
    });
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    res.status(500).json({ 
      error: 'Falha ao buscar produtos.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}