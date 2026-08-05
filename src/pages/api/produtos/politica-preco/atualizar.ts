import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { calcularPrecoVenda, TIPOS_PRECO, type ComponentesPreco } from '@/lib/calcularPrecos';

/**
 * POST /api/produtos/politica-preco/atualizar
 * Body: { codprod, tipoPreco, margem }
 *
 * Edita a MARGEM LÍQUIDA de UMA faixa (tipo de preço) e recalcula o PREÇO DE
 * VENDA com o motor validado (calcularPrecoVenda). Grava na hora em
 * DBFORMACAOPRVENDA (+ dbprod.prvenda quando ZFM). Modelo Delphi
 * ATUALIZAR_PRECO(pTipoAtualizacao='MARGEM'). Fase 1: só edição de margem.
 */
const round2 = (x: number) => {
  const v = x * 100;
  const s = v >= 0 ? 1 : -1;
  return (s * Math.floor(Math.abs(v) + 0.5 + 1e-9)) / 100;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { codprod, tipoPreco, margem } = req.body || {};
  if (!codprod || tipoPreco === undefined || tipoPreco === null || margem === undefined) {
    return res.status(400).json({ error: 'codprod, tipoPreco e margem são obrigatórios' });
  }
  const tp = Number(tipoPreco);
  const novaMargem = Number(margem);
  if (Number.isNaN(tp) || Number.isNaN(novaMargem)) {
    return res.status(400).json({ error: 'tipoPreco/margem inválidos' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO db_manaus, public');

    // Atributos fiscais do produto (custo base + divisor "fora do estado")
    const pRes = await client.query(
      `SELECT COALESCE(prcompra,0) AS prcompra, COALESCE(dolar,'N') AS dolar,
              COALESCE(txdolarcompra,0) AS txdolarcompra, codgpp, codmarca, strib
         FROM dbprod WHERE codprod = $1`,
      [codprod],
    );
    if (pRes.rows.length === 0) throw new Error('Produto não encontrado');
    const p = pRes.rows[0];
    const dolarS = p.dolar === 'S';
    const tx = Number(p.txdolarcompra);
    const base = round2(Number(p.prcompra) * (dolarS && tx > 0 ? tx : 1));

    // Linha da política (tributos vigentes desta faixa)
    const fRes = await client.query(
      `SELECT "ICMSDEVOL", "ICMS", "IPI", "PIS", "COFINS", "DCI", "COMISSAO", "TAXACARTAO"
         FROM "DBFORMACAOPRVENDA" WHERE "CODPROD" = $1 AND "TIPOPRECO" = $2`,
      [codprod, tp],
    );
    if (fRes.rows.length === 0) throw new Error('Faixa de preço não encontrada para este produto');
    const f = fRes.rows[0];

    const form: ComponentesPreco = {
      TIPOPRECO: tp,
      MARGEMLIQUIDA: novaMargem,
      IPI: Number(f.IPI || 0),
      DCI: Number(f.DCI || 0),
      ICMS: Number(f.ICMS || 0),
      PIS: Number(f.PIS || 0),
      COFINS: Number(f.COFINS || 0),
      COMISSAO: Number(f.COMISSAO || 0),
      TAXACARTAO: Number(f.TAXACARTAO || 0),
      ICMSDEVOL: Number(f.ICMSDEVOL || 0),
    };
    const prodCtx = { dolar: p.dolar, codgpp: p.codgpp, codmarca: p.codmarca, strib: p.strib };

    const preco = calcularPrecoVenda(base, form, prodCtx);
    if (preco == null) {
      throw new Error('Fator tributário zerado — não é possível calcular o preço.');
    }
    const precoFinal = round2(preco);

    await client.query(
      `UPDATE "DBFORMACAOPRVENDA"
          SET "MARGEMLIQUIDA" = $1, "PRECOVENDA" = $2
        WHERE "CODPROD" = $3 AND "TIPOPRECO" = $4`,
      [novaMargem, precoFinal, codprod, tp],
    );

    // ZFM (tipo 1) reflete em dbprod.prvenda (igual ao legado)
    if (tp === TIPOS_PRECO.ZFM && precoFinal > 0) {
      await client.query(`UPDATE dbprod SET prvenda = $1 WHERE codprod = $2`, [precoFinal, codprod]);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      tipoPreco: tp,
      margemLiquida: novaMargem,
      precoVenda: precoFinal,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao atualizar margem:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.',
    });
  } finally {
    if (client) client.release();
  }
}
