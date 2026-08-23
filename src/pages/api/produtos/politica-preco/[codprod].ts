import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

/**
 * GET /api/produtos/politica-preco/[codprod]
 *
 * Política de preço de venda de UM produto (grade detalhe da "Análise de
 * Margem", porte do Delphi uniMargemPrecoVendasNovo). Retorna uma linha por
 * tipo de preço (DBFORMACAOPRVENDA) com custo base, tributos, margem e preço.
 */

// TIPOPRECO -> rótulo (igual ao legado Oracle).
const ROTULO_TIPO_PRECO: Record<number, string> = {
  0: 'Balcão',
  1: 'ZFM',
  2: 'Interior',
  3: 'ALC',
  4: 'Amazônia Ocidental',
  5: 'Fora do Estado',
  6: 'Fora do Estado Varejo',
  7: 'Roraima',
};

const round2 = (x: number) => {
  const v = x * 100;
  const s = v >= 0 ? 1 : -1;
  return (s * Math.floor(Math.abs(v) + 0.5 + 1e-9)) / 100;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { codprod } = req.query;
  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({ error: 'codprod é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    // Produto (custo base + atributos p/ o divisor "fora do estado")
    const prodRes = await client.query(
      `SELECT codprod, descr, COALESCE(prcompra,0) AS prcompra, COALESCE(dolar,'N') AS dolar,
              COALESCE(txdolarcompra,0) AS txdolarcompra, codgpp, codmarca, strib
         FROM dbprod WHERE codprod = $1`,
      [codprod],
    );
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    const p = prodRes.rows[0];
    const dolarS = p.dolar === 'S';
    const tx = Number(p.txdolarcompra);
    const base = round2(Number(p.prcompra) * (dolarS && tx > 0 ? tx : 1));

    // Política por tipo de preço
    const polRes = await client.query(
      `SELECT "TIPOPRECO", "MARGEMLIQUIDA", "ICMSDEVOL", "ICMS", "IPI", "PIS",
              "COFINS", "DCI", "COMISSAO", "FATORDESPESAS", "TAXACARTAO", "PRECOVENDA"
         FROM "DBFORMACAOPRVENDA"
        WHERE "CODPROD" = $1
        ORDER BY "TIPOPRECO"`,
      [codprod],
    );

    const linhas = polRes.rows.map((r: any) => {
      const tp = parseInt(r.TIPOPRECO, 10);
      return {
        tipoPreco: tp,
        tipoPrecoLabel: ROTULO_TIPO_PRECO[tp] ?? `Tipo ${tp}`,
        prcompra: base,
        margemLiquida: Number(r.MARGEMLIQUIDA || 0),
        icmsDevol: Number(r.ICMSDEVOL || 0),
        icms: Number(r.ICMS || 0),
        ipi: Number(r.IPI || 0),
        pis: Number(r.PIS || 0),
        cofins: Number(r.COFINS || 0),
        dci: Number(r.DCI || 0),
        comissao: Number(r.COMISSAO || 0),
        fatorDespesas: Number(r.FATORDESPESAS || 0),
        taxaCartao: Number(r.TAXACARTAO || 0),
        precoVenda: Number(r.PRECOVENDA || 0),
      };
    });

    return res.status(200).json({
      success: true,
      produto: {
        codprod: p.codprod,
        descr: p.descr,
        prcompra: base,
        dolar: p.dolar,
      },
      politica: linhas,
    });
  } catch (error) {
    console.error('Erro ao buscar política de preço:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    });
  } finally {
    if (client) client.release();
  }
}
