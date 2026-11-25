import type { PoolClient } from 'pg';
import {
  calcularMargemPorPreco,
  calcularPrecoVenda,
  DBPRECO_COLUMNS,
  TIPOS_PRECO,
  type ComponentesPreco,
} from '@/lib/calcularPrecos';

/**
 * Política de preço de venda (Análise de Margem — porte do Delphi uniMargemPrecoVendasNovo /
 * POLITICA_PRECO_VENDA.ATUALIZAR_PRECO).
 *
 * MARGEM: informa a margem líquida → recalcula o preço (CALCULAR_POR_MARGEM).
 * PRECO:  informa o preço de venda  → recalcula a margem (CALCULAR_POR_PRECO).
 * Grava dbformacaoprvenda (fonte da venda), a coluna da faixa em dbpreco e, na ZFM (tipo 1),
 * dbprod.prvenda — igual à procedure do Oracle.
 */

export type ModoAtualizacao = 'MARGEM' | 'PRECO';

export const ROTULO_TIPO_PRECO: Record<number, string> = {
  0: 'Balcão',
  1: 'ZFM',
  2: 'Interior',
  3: 'ALC',
  4: 'Amazônia Ocidental',
  5: 'Fora do Estado',
  6: 'Fora do Estado Varejo',
  7: 'Roraima',
};

export class FaixaInexistenteError extends Error {}

const round2 = (x: number) => {
  const v = x * 100;
  const s = v >= 0 ? 1 : -1;
  return (s * Math.floor(Math.abs(v) + 0.5 + 1e-9)) / 100;
};

export interface ResultadoFaixa {
  tipoPreco: number;
  margemLiquida: number;
  precoVenda: number;
}

async function temDbpreco(client: PoolClient): Promise<boolean> {
  const r = await client.query(`SELECT to_regclass('dbpreco') IS NOT NULL AS ok`);
  return !!r.rows[0]?.ok;
}

/** Atualiza UMA faixa de UM produto. Roda dentro da transação do chamador. */
export async function atualizarFaixaPreco(
  client: PoolClient,
  codprod: string,
  tipoPreco: number,
  modo: ModoAtualizacao,
  valor: number,
): Promise<ResultadoFaixa> {
  const pRes = await client.query(
    `SELECT COALESCE(prcompra,0) AS prcompra, COALESCE(dolar,'N') AS dolar,
            COALESCE(txdolarcompra,0) AS txdolarcompra, codgpp, codmarca, strib
       FROM dbprod WHERE codprod = $1`,
    [codprod],
  );
  if (pRes.rows.length === 0) throw new Error(`Produto ${codprod} não encontrado`);
  const p = pRes.rows[0];
  const tx = Number(p.txdolarcompra);
  const base = round2(Number(p.prcompra) * (p.dolar === 'S' && tx > 0 ? tx : 1));

  const fRes = await client.query(
    `SELECT "ICMSDEVOL", "ICMS", "IPI", "PIS", "COFINS", "DCI", "COMISSAO", "TAXACARTAO"
       FROM dbformacaoprvenda WHERE "CODPROD" = $1 AND "TIPOPRECO" = $2`,
    [codprod, tipoPreco],
  );
  if (fRes.rows.length === 0) {
    throw new FaixaInexistenteError(`Produto ${codprod} sem a faixa ${ROTULO_TIPO_PRECO[tipoPreco] ?? tipoPreco}`);
  }
  const f = fRes.rows[0];
  const comp: Omit<ComponentesPreco, 'MARGEMLIQUIDA'> = {
    TIPOPRECO: tipoPreco,
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

  let margem: number;
  let preco: number;
  if (modo === 'MARGEM') {
    margem = valor;
    const calc = calcularPrecoVenda(base, { ...comp, MARGEMLIQUIDA: valor }, prodCtx);
    if (calc == null) throw new Error('Fator tributário zerado — não é possível calcular o preço.');
    preco = round2(calc);
  } else {
    if (!(valor > 0)) throw new Error('Preço de venda deve ser maior que zero.');
    preco = round2(valor);
    const m = calcularMargemPorPreco(base, comp, prodCtx, preco);
    if (m == null) throw new Error('Produto sem custo — não é possível calcular a margem pelo preço.');
    margem = m;
  }

  await client.query(
    `UPDATE dbformacaoprvenda SET "MARGEMLIQUIDA" = $1, "PRECOVENDA" = $2
      WHERE "CODPROD" = $3 AND "TIPOPRECO" = $4`,
    [margem, preco, codprod, tipoPreco],
  );
  // dbpreco (tabela antiga do Oracle) não foi migrada para o PG em 11/2026: só grava se existir.
  const col = DBPRECO_COLUMNS[tipoPreco];
  if (col && (await temDbpreco(client))) {
    await client.query(`UPDATE dbpreco SET ${col} = $1 WHERE codprod = $2`, [preco, codprod]);
  }
  if (tipoPreco === TIPOS_PRECO.ZFM && preco > 0) {
    await client.query(`UPDATE dbprod SET prvenda = $1 WHERE codprod = $2`, [preco, codprod]);
  }
  return { tipoPreco, margemLiquida: margem, precoVenda: preco };
}
