// pages/api/cadastro-operadoras/index.ts
// CRUD de Operadora de Cartão (dbopera). Catálogo CENTRAL (db_manaus) — mesma fonte
// que o Caixa lê em /api/operadoras. codopera é gerado automaticamente (MAX+1, 3 díg).
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';

const TABLE = 'dbopera';

const filtroParaColunaSQL: Record<string, string> = {
  codopera: 'o.codopera',
  descr: 'o.descr',
  txopera: 'o.txopera',
  pzopera: 'o.pzopera',
  cond_pagto: 'o.cond_pagto',
  desativado: 'o.desativado',
};

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleList(req, res);
    case 'POST':
      if ('page' in req.body || 'filtros' in req.body || 'search' in req.body) {
        return handleList(req, res);
      }
      return handleCreate(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleList = async (req: NextApiRequest, res: NextApiResponse) => {
  const isPost = req.method === 'POST';
  const source: any = isPost ? req.body : req.query;
  const page = Number(source.page) || 1;
  const perPage = Number(source.perPage) || 10;
  const search = (source.search as string) || '';
  const filtros = source.filtros || [];
  const status = (source.status as string) || 'todos'; // ativos | inativos | todos

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    const params: any[] = [];
    const where: string[] = [];

    if (Array.isArray(filtros)) {
      for (const f of filtros) {
        const col = filtroParaColunaSQL[f.campo];
        if (!col || f.valor == null || f.valor === '') continue;
        params.push(`%${f.valor}%`);
        where.push(`${col}::text ILIKE $${params.length}`);
      }
    }
    // Busca combina (AND) com os filtros ativos (ex.: filtro de situação).
    if (search && String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      where.push(`(o.codopera ILIKE $${params.length} OR o.descr ILIKE $${params.length})`);
    }
    if (status === 'ativos') where.push(`COALESCE(o.desativado,0) = 0`);
    else if (status === 'inativos') where.push(`COALESCE(o.desativado,0) <> 0`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = parseInt(
      (await client.query(`SELECT COUNT(*) FROM ${TABLE} o ${whereSql}`, params)).rows[0].count,
      10,
    );
    const offset = (page - 1) * perPage;
    const dataRes = await client.query(
      `SELECT o.codopera, o.descr, o.txopera, o.pzopera, o.cond_pagto, o.desativado, o.codcli,
              c.nome AS nome_cliente
         FROM ${TABLE} o
         LEFT JOIN dbclien c ON c.codcli = o.codcli
         ${whereSql}
        ORDER BY o.codopera ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset],
    );
    const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;
    return res.status(200).json({
      data: dataRes.rows,
      meta: { total, perPage, currentPage: total > 0 ? page : 1, lastPage, firstPage: 1 },
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar operadoras:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { descr, txopera, pzopera, cond_pagto, codcli, desativado } = req.body;
  if (!descr || !String(descr).trim()) {
    return res.status(400).json({ error: 'A descrição é obrigatória.' });
  }

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();
    // codopera automático: MAX numérico + 1, com 3 dígitos (ex.: '042').
    const mx = await client.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(codopera,'[^0-9]','','g'),'')::int),0) + 1 AS prox FROM ${TABLE}`,
    );
    const codopera = String(mx.rows[0].prox).padStart(3, '0');

    const result = await client.query(
      `INSERT INTO ${TABLE} (codopera, descr, txopera, pzopera, cond_pagto, codcli, desativado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        codopera,
        String(descr).trim(),
        txopera != null && txopera !== '' ? Number(txopera) : 0,
        pzopera != null && pzopera !== '' ? parseInt(pzopera) : 0,
        cond_pagto || null,
        codcli || null,
        desativado != null ? parseInt(desativado) || 0 : 0,
      ],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao criar operadora:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
