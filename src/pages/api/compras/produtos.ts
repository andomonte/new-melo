import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface Produto {
  codprod: string;
  descr: string;
  marca: string;
  ref?: string;
  inf?: string | null;
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
  const codCredor = (req.query.codCredor as string) ?? '';
  // Quando true, a busca `search` casa SOMENTE pela referência (p.ref).
  const somenteRef = String(req.query.somenteRef ?? '') === 'true';
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
    
    // Busca multi-termo (mesma regra do produto): ESPAÇO = E (todas as
    // palavras), ';' = OU (qualquer grupo). Ex.: "pneu 15;correia" =>
    // (contém "pneu" E "15") OU (contém "correia"). Cada termo casa em
    // qualquer um dos campos (código/descrição/ref/MARCA) — ou só na ref
    // quando "Somente referência" está ligado. Incluir a marca (m.descr)
    // permite "pneu original" = pneu E marca original.
    if (search && !codprod) {
      if (somenteRef) {
        // "Somente referência": match EXATO em p.ref (preserva espaços internos —
        // ex.: "MB 482" é uma referência real, não um filtro fuzzy). O caractere
        // "/" separa referência / marca:
        //   "MB 482"          => p.ref = 'MB 482'
        //   "MB 482 / bosch"  => p.ref = 'MB 482' E marca casa "bosch" (nome ou código)
        const barra = String(search).indexOf('/');
        const refParte = (barra >= 0 ? String(search).slice(0, barra) : String(search)).trim();
        const marcaParte = (barra >= 0 ? String(search).slice(barra + 1) : '').trim();

        if (refParte) {
          whereConditions.push(`UPPER(TRIM(p.ref)) = UPPER($${paramCounter})`);
          params.push(refParte);
          paramCounter++;
        }
        if (marcaParte) {
          const idx = paramCounter;
          whereConditions.push(`(m.descr ILIKE $${idx} OR p.codmarca ILIKE $${idx})`);
          params.push(`%${marcaParte}%`);
          paramCounter++;
        }
      } else {
        // Fuzzy multi-termo: ESPAÇO = E (todas as palavras), ';' = OU (qualquer
        // grupo). Cada termo casa em código/descrição/ref/MARCA (m.descr).
        const campos = ['p.codprod', 'p.descr', 'p.ref', 'm.descr'];
        const grupos = String(search)
          .split(';')
          .map((g) =>
            g
              .trim()
              .split(/\s+/)
              .map((t) => t.replace(/^%+|%+$/g, '').trim())
              .filter(Boolean),
          )
          .filter((g) => g.length > 0);

        if (grupos.length > 0) {
          const orConds = grupos.map((termos) => {
            const andConds = termos.map((t) => {
              const idx = paramCounter;
              params.push(`%${t}%`);
              paramCounter++;
              const campoConds = campos.map((c) => `${c} ILIKE $${idx}`);
              return campoConds.length > 1 ? `(${campoConds.join(' OR ')})` : campoConds[0];
            });
            return andConds.length > 1 ? `(${andConds.join(' AND ')})` : andConds[0];
          });
          whereConditions.push(orConds.length > 1 ? `(${orConds.join(' OR ')})` : orConds[0]);
        }
      }
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

    // Filtro pela MARCA do fornecedor (codCredor) — derivada da referência de
    // fábrica (dbref_fabrica). Se o fornecedor não tem marca cadastrada, não filtra.
    if (codCredor) {
      const idx = paramCounter;
      whereConditions.push(`(
        NOT EXISTS (
          SELECT 1 FROM dbref_fabrica rf
          WHERE lpad(trim(rf.codcredor), 5, '0') = lpad(trim($${idx}), 5, '0')
            AND rf.codmarca IS NOT NULL AND trim(rf.codmarca) <> ''
        )
        OR trim(p.codmarca) IN (
          SELECT trim(rf.codmarca) FROM dbref_fabrica rf
          WHERE lpad(trim(rf.codcredor), 5, '0') = lpad(trim($${idx}), 5, '0')
        )
      )`);
      params.push(codCredor);
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
        p.inf,
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
      FROM dbprod p
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      ${whereSQL}
      ${whereConditions.length > 0 ? 'AND' : 'WHERE'} LENGTH(p.codprod) = 6
      ORDER BY p.descr
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;

    // Query para contar total (mesmo JOIN da principal — a busca pode filtrar
    // por m.descr, o nome da marca).
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbprod p
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
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