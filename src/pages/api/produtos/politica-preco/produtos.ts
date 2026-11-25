import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';

/**
 * POST /api/produtos/politica-preco/produtos
 * Body: { codprods: string[] }
 *
 * Lista mestre da Análise de Margem quando aberta com produtos escolhidos na listagem
 * (selecionados ou a linha atual — Ctrl+M), como o Delphi, que carrega a grade com os
 * produtos da tela de produtos. Devolve também o preço de venda de cada faixa, usado pela
 * exportação da tabela de preço (Delphi rxExportarTabela / rxExportarTabelaTodos).
 */
const MAX_PRODUTOS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const codprods: string[] = Array.isArray(req.body?.codprods)
    ? Array.from(new Set(req.body.codprods.map((c: any) => String(c).trim()).filter(Boolean)))
    : [];
  if (codprods.length === 0) return res.status(200).json({ success: true, data: [] });
  if (codprods.length > MAX_PRODUTOS) {
    return res.status(400).json({ error: `Máximo de ${MAX_PRODUTOS} produtos por vez — refine a seleção.` });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();
    const r = await client.query(
      `SELECT p.codprod, p.descr, p.ref, m.descr AS marca, gp.descr AS grupo,
              COALESCE(p.qtest, 0) AS estoque, p.aplic_extendida,
              COALESCE(
                (SELECT json_object_agg(f."TIPOPRECO"::int, f."PRECOVENDA")
                   FROM dbformacaoprvenda f WHERE f."CODPROD" = p.codprod), '{}'::json) AS precos
         FROM dbprod p
         LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
         LEFT JOIN dbgpprod gp ON gp.codgpp = p.codgpp
        WHERE p.codprod = ANY($1)
        ORDER BY p.descr`,
      [codprods],
    );
    return res.status(200).json({
      success: true,
      data: r.rows.map((x: any) => ({
        codprod: x.codprod,
        descr: x.descr,
        ref: x.ref,
        marca: x.marca,
        grupoproduto: x.grupo,
        estoque: Number(x.estoque || 0),
        aplic_extendida: x.aplic_extendida,
        precos: Object.fromEntries(Object.entries(x.precos || {}).map(([k, v]) => [k, Number(v || 0)])),
      })),
    });
  } catch (error) {
    console.error('Erro ao carregar produtos da análise de margem:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Erro interno' });
  } finally {
    if (client) client.release();
  }
}
