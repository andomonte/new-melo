import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

/**
 * POST /api/compras/produtos/por-referencias
 * Body: { refs: string[], codCredor?: string }
 *
 * Resolve REFERÊNCIAS (da planilha) para produtos do cadastro, priorizando o
 * FORNECEDOR (codCredor) da requisição:
 *   1) casa a ref com a "referência de fábrica" (dbref_fabrica) daquele fornecedor
 *      → dbprod_ref_fabrica → produto (mais preciso; cobre ref do fornecedor ≠ ref Melo);
 *   2) casa a ref com dbprod.ref, filtrando pelas MARCAS que o fornecedor fornece
 *      (derivadas do dbref_fabrica). Sem fornecedor/sem marcas → não filtra por marca.
 * Retorna { data: [{ ref_busca, ...produto }] } — ref_busca é a referência de entrada
 * que casou, para o front mapear a quantidade correta.
 */
interface ProdutoRef {
  ref_busca: string;
  codprod: string;
  descr: string;
  marca: string;
  ref: string;
  inf: string | null;
  estoque: number;
  prcompra: number;
  prvenda: number;
  multiplo: number;
  multiplocompra: number;
  grupoproduto: string | null;
  unimed: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ data: ProdutoRef[] } | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const refs: string[] = Array.isArray(req.body?.refs) ? req.body.refs : [];
  const codCredor: string | null = req.body?.codCredor ? String(req.body.codCredor) : null;
  const refsNorm = Array.from(
    new Set(refs.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean)),
  );
  if (refsNorm.length === 0) {
    return res.status(200).json({ data: [] });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query<ProdutoRef>(
      `
      WITH cred AS (
        SELECT CASE WHEN $2::text IS NULL THEN NULL ELSE lpad(trim($2), 5, '0') END AS c
      ),
      marcas AS (
        SELECT DISTINCT trim(rf.codmarca) AS codmarca
        FROM dbref_fabrica rf, cred
        WHERE cred.c IS NOT NULL
          AND lpad(trim(rf.codcredor), 5, '0') = cred.c
          AND rf.codmarca IS NOT NULL AND trim(rf.codmarca) <> ''
      ),
      matches AS (
        -- 1) referência de fábrica do fornecedor
        SELECT lower(trim(rf.referencia)) AS ref_busca, prf.codprod, 1 AS prioridade
        FROM dbref_fabrica rf
        JOIN dbprod_ref_fabrica prf ON prf.cod_id = rf.cod_id, cred
        WHERE cred.c IS NOT NULL
          AND lpad(trim(rf.codcredor), 5, '0') = cred.c
          AND lower(trim(rf.referencia)) = ANY($1::text[])
        UNION ALL
        -- 2) referência do próprio produto (dbprod.ref), filtrada pela marca do fornecedor
        SELECT lower(trim(p.ref)) AS ref_busca, p.codprod, 2 AS prioridade
        FROM dbprod p
        WHERE lower(trim(p.ref)) = ANY($1::text[])
          AND ( NOT EXISTS (SELECT 1 FROM marcas)
                OR trim(p.codmarca) = ANY (SELECT codmarca FROM marcas) )
      )
      SELECT DISTINCT ON (mt.ref_busca)
        mt.ref_busca,
        p.codprod,
        p.descr,
        COALESCE(m.descr, p.codmarca) AS marca,
        p.ref,
        p.inf,
        COALESCE(p.qtest, 0) AS estoque,
        ROUND(
          COALESCE(p.prcompra, 0) *
          CASE WHEN p.dolar = 'S' THEN COALESCE(p.txdolarcompra, 1) ELSE 1 END,
          2
        ) AS prcompra,
        COALESCE(p.prvenda, 0) AS prvenda,
        COALESCE(p.multiplo, 1) AS multiplo,
        COALESCE(p.multiplocompra, p.multiplo, 1) AS multiplocompra,
        p.codgpp AS grupoproduto,
        p.unimed
      FROM matches mt
      JOIN dbprod p ON p.codprod = mt.codprod
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      WHERE LENGTH(p.codprod) = 6
      ORDER BY mt.ref_busca, mt.prioridade, CASE WHEN p.inf = 'D' THEN 1 ELSE 0 END, p.codprod
      `,
      [refsNorm, codCredor],
    );

    return res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error('Erro ao resolver produtos por referências:', err);
    return res.status(500).json({ error: 'Falha ao resolver produtos por referências.' });
  } finally {
    if (client) client.release();
  }
}
