/**
 * Biblioteca para cálculo automático de preços por categoria (TIPOPRECO)
 *
 * Replica a lógica da procedure Oracle ATUALIZAR_PRECO_MARGEM:
 * - Lê registros existentes da DBFORMACAOPRVENDA
 * - Recalcula PRECOVENDA usando a MARGEMLIQUIDA já salva + novo custo base
 * - Preserva MARGEMLIQUIDA e demais campos
 */

import { PoolClient } from 'pg';

// --- TIPOS ---

export interface DadosProduto {
  codprod: string;
  prcompra?: number;
  prcustoatual?: number;
  dolar?: string;
  txdolarcompra?: number;
  // Atributos fiscais para o divisor "fora do estado" (tipopreco 3/4/5).
  // Se omitidos, são buscados de dbprod dentro de recalcularPrecosProduto.
  codgpp?: string;
  codmarca?: string;
  strib?: string;
}

export interface FormacaoPreco {
  CODPROD: string;
  TIPOPRECO: number;
  PRECOVENDA: number;
  MARGEMLIQUIDA: number;
  ICMSDEVOL: number;
  ICMS: number;
  IPI: number;
  PIS: number;
  COFINS: number;
  DCI: number;
  COMISSAO: number;
  FATORDESPESAS: number;
  TAXACARTAO: number | null;
}

// --- CONSTANTES ---

/**
 * Os 8 tipos de preço (TIPOPRECO) - IGUAL AO LEGADO ORACLE
 *
 * 0 = Balcão
 * 1 = Zona Franca de Manaus (ZFM) - atualiza dbprod.prvenda
 * 2 = Interior do Estado
 * 3 = Area de Livre Comercio (ALC)
 * 4 = Amazonia Ocidental
 * 5 = Fora do Estado
 * 6 = Fora do Estado Varejo
 * 7 = Roraima (Boa Vista)
 */
export const TIPOS_PRECO = {
  BALCAO: 0,
  ZFM: 1,
  INTERIOR: 2,
  ALC: 3,
  AMAZONIA_OCIDENTAL: 4,
  FORA_ESTADO: 5,
  FORA_ESTADO_VAREJO: 6,
  RORAIMA: 7,
} as const;

/**
 * Mapeamento TIPOPRECO -> coluna em DBPRECO (se existir)
 */
const DBPRECO_COLUMNS: Record<number, string> = {
  0: 'prbalcao',
  1: 'prrev30',
  2: 'prrev45',
  3: 'prrev60',
  4: 'prrv30',
  5: 'prrv45',
  6: 'prrv60',
  7: 'prbv30',
};

// --- NÚCLEO DE CÁLCULO (porte fiel de CALCULAR_POR_MARGEM) ---

/** ROUND do Oracle: half-away-from-zero. */
function roundHalfAway(x: number, n = 2): number {
  const f = Math.pow(10, n);
  const v = x * f;
  const s = v >= 0 ? 1 : -1;
  return (s * Math.floor(Math.abs(v) + 0.5 + 1e-9)) / f;
}

export interface ComponentesPreco {
  TIPOPRECO: number;
  MARGEMLIQUIDA: number;
  IPI: number; // alíquota
  DCI: number; // alíquota II
  ICMS: number;
  PIS: number;
  COFINS: number;
  COMISSAO: number;
  TAXACARTAO: number;
  ICMSDEVOL: number;
}

/**
 * Preço de venda de uma faixa (tipopreco) a partir do custo base e dos componentes
 * tributários já formados. Porte fiel de POLITICA_PRECO_VENDA.CALCULAR_POR_MARGEM,
 * validado 100% (640 faixas) contra a procedure viva do Oracle:
 *   preço = round(precoMargem / (fator/100), 2) + IPI + II
 * onde fator = 100 − (icmsdevol+icms+pis+cofins+comissão+taxaCartão),
 * com divisor "fora do estado" (tp 3/4/5, não-dólar) e zeragem de IPI/II por faixa.
 */
export function calcularPrecoVenda(
  base: number,
  form: ComponentesPreco,
  prod: { dolar?: string; codgpp?: string; codmarca?: string; strib?: string }
): number | null {
  const tp = form.TIPOPRECO;
  const margMult = 1 + (form.MARGEMLIQUIDA || 0) / 100;
  const s1 = (prod.strib || '').charAt(0);
  const foraEstado = [3, 4, 5].includes(tp) && prod.dolar !== 'S';

  let precoMargem: number;
  let ipiVal: number;
  let iiVal: number;
  if (foraEstado) {
    const gpp = ['00302', '00524', '01763', '01743', '01750', '01762', '00008', '01436'];
    let div: number;
    if (gpp.includes(prod.codgpp || '')) div = 1.19;
    else if (prod.codmarca === '02543') div = 1.17;
    else if (['1', '2', '3', '8'].includes(s1)) div = 1.30;
    else div = 1.21;
    precoMargem = roundHalfAway((base / div) * margMult, 2);
    ipiVal = 0;
    iiVal = 0;
  } else {
    precoMargem = roundHalfAway(base * margMult, 2);
    ipiVal = tp === 7 ? 0 : roundHalfAway((base * (form.IPI || 0)) / 100, 2);
    iiVal = [0, 1, 2, 7].includes(tp) ? 0 : roundHalfAway((base * (form.DCI || 0)) / 100, 2);
  }

  const fator = 100 - ((form.ICMSDEVOL || 0) + (form.ICMS || 0) + (form.PIS || 0) +
    (form.COFINS || 0) + (form.COMISSAO || 0) + (form.TAXACARTAO || 0));
  if (fator === 0) return null;
  return roundHalfAway(precoMargem / (fator / 100), 2) + ipiVal + iiVal;
}

// --- FUNÇÕES PRINCIPAIS ---

/**
 * Recalcula preços de venda para um produto baseado nas formações existentes.
 * Replica a lógica legada ATUALIZAR_PRECO_MARGEM:
 * 1. Lê registros existentes da DBFORMACAOPRVENDA
 * 2. Para cada registro, recalcula PRECOVENDA usando MARGEMLIQUIDA existente + novo custo
 * 3. Preserva MARGEMLIQUIDA e demais campos (ICMS, PIS, COFINS, etc.)
 * 4. Se não existir registro, NÃO cria (manter comportamento legado)
 */
export async function recalcularPrecosProduto(
  client: PoolClient,
  produto: DadosProduto,
  schema?: string
): Promise<void> {
  const tableName = schema ? `${schema}."DBFORMACAOPRVENDA"` : '"DBFORMACAOPRVENDA"';

  // 1. Ler registros existentes
  const existentes = await client.query(
    `SELECT "CODPROD", "TIPOPRECO", "PRECOVENDA", "MARGEMLIQUIDA",
            "ICMSDEVOL", "ICMS", "IPI", "PIS", "COFINS",
            "DCI", "COMISSAO", "FATORDESPESAS", "TAXACARTAO"
     FROM ${tableName}
     WHERE "CODPROD" = $1`,
    [produto.codprod]
  );

  if (existentes.rows.length === 0) {
    console.log(`Produto ${produto.codprod}: sem registros em DBFORMACAOPRVENDA, nada a recalcular`);
    return;
  }

  // Atributos fiscais do produto (custo/dólar/divisor "fora do estado")
  const pfRes = await client.query(
    `SELECT prcompra, dolar, txdolarcompra, codgpp, codmarca, strib FROM dbprod WHERE codprod = $1`,
    [produto.codprod]
  );
  const pf = pfRes.rows[0] || {};
  const dolarS = (produto.dolar ?? pf.dolar) === 'S';
  const txdolar = Number(produto.txdolarcompra ?? pf.txdolarcompra ?? 0);
  // Base de custo = PRCOMPRA (como o Oracle), aplicando dólar quando importado
  const custoOriginal = Number(produto.prcompra ?? pf.prcompra ?? 0);
  if (!custoOriginal) {
    console.log(`Produto ${produto.codprod}: custo base = 0, nada a recalcular`);
    return;
  }
  const base = roundHalfAway(custoOriginal * (dolarS && txdolar > 0 ? txdolar : 1), 2);
  const prodCtx = {
    dolar: (produto.dolar ?? pf.dolar) || 'N',
    codgpp: produto.codgpp ?? pf.codgpp,
    codmarca: produto.codmarca ?? pf.codmarca,
    strib: produto.strib ?? pf.strib,
  };

  // 2. Recalcular o preço de cada faixa reusando margem + alíquotas gravadas
  const formacoesAtualizadas: FormacaoPreco[] = [];

  for (const reg of existentes.rows) {
    const form: ComponentesPreco = {
      TIPOPRECO: parseInt(reg.TIPOPRECO, 10),
      MARGEMLIQUIDA: parseFloat(reg.MARGEMLIQUIDA || 0),
      IPI: parseFloat(reg.IPI || 0),
      DCI: parseFloat(reg.DCI || 0),
      ICMS: parseFloat(reg.ICMS || 0),
      PIS: parseFloat(reg.PIS || 0),
      COFINS: parseFloat(reg.COFINS || 0),
      COMISSAO: parseFloat(reg.COMISSAO || 0),
      TAXACARTAO: parseFloat(reg.TAXACARTAO || 0),
      ICMSDEVOL: parseFloat(reg.ICMSDEVOL || 0),
    };

    const preco = calcularPrecoVenda(base, form, prodCtx);
    if (preco == null) continue;
    const precoFinal = Number(preco.toFixed(2));

    formacoesAtualizadas.push({
      CODPROD: produto.codprod,
      TIPOPRECO: form.TIPOPRECO,
      PRECOVENDA: precoFinal,
      MARGEMLIQUIDA: form.MARGEMLIQUIDA,
      ICMSDEVOL: form.ICMSDEVOL,
      ICMS: form.ICMS,
      IPI: form.IPI,
      PIS: form.PIS,
      COFINS: form.COFINS,
      DCI: form.DCI,
      COMISSAO: form.COMISSAO,
      FATORDESPESAS: parseFloat(reg.FATORDESPESAS || 0),
      TAXACARTAO: form.TAXACARTAO,
    });

    // Atualiza só o PRECOVENDA (FATORDESPESAS gravado é preservado)
    await client.query(
      `UPDATE ${tableName}
       SET "PRECOVENDA" = $1
       WHERE "CODPROD" = $2 AND "TIPOPRECO" = $3`,
      [precoFinal, produto.codprod, form.TIPOPRECO]
    );
  }

  // 3. Atualizar DBPRECO se existir
  await atualizarDbpreco(client, produto.codprod, formacoesAtualizadas);

  // 4. Se tipo 1 (ZFM), atualizar dbprod.prvenda
  const precoZfm = formacoesAtualizadas.find((f) => f.TIPOPRECO === TIPOS_PRECO.ZFM);
  if (precoZfm && precoZfm.PRECOVENDA > 0) {
    await client.query(
      `UPDATE dbprod SET prvenda = $1 WHERE codprod = $2`,
      [precoZfm.PRECOVENDA, produto.codprod]
    );
  }

  console.log(
    `Precos recalculados para produto ${produto.codprod}: ${formacoesAtualizadas.length} tipos atualizados` +
      (produto.dolar === 'S' ? ` (dolar: ${produto.txdolarcompra})` : '')
  );
}

/**
 * Atualiza DBPRECO se a tabela existir (compatibilidade com legado)
 */
async function atualizarDbpreco(
  client: PoolClient,
  codprod: string,
  formacoes: FormacaoPreco[]
): Promise<void> {
  try {
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'dbpreco'
      ) as exists
    `);

    if (!checkTable.rows[0]?.exists) {
      return;
    }

    const checkProd = await client.query(
      `SELECT 1 FROM dbpreco WHERE codprod = $1`,
      [codprod]
    );

    if (checkProd.rows.length === 0) {
      const insertCols = ['codprod'];
      const insertVals = ['$1'];
      const params: (string | number)[] = [codprod];
      let paramIdx = 2;

      for (const formacao of formacoes) {
        const col = DBPRECO_COLUMNS[formacao.TIPOPRECO];
        if (col) {
          insertCols.push(col);
          insertVals.push(`$${paramIdx}`);
          params.push(formacao.PRECOVENDA);
          paramIdx++;
        }
      }

      await client.query(
        `INSERT INTO dbpreco (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        params
      );
    } else {
      const setClauses: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      for (const formacao of formacoes) {
        const col = DBPRECO_COLUMNS[formacao.TIPOPRECO];
        if (col) {
          setClauses.push(`${col} = $${paramIdx}`);
          params.push(formacao.PRECOVENDA);
          paramIdx++;
        }
      }

      params.push(codprod);

      await client.query(
        `UPDATE dbpreco SET ${setClauses.join(', ')} WHERE codprod = $${paramIdx}`,
        params
      );
    }
  } catch (err) {
    console.warn(`Aviso: Nao foi possivel atualizar DBPRECO para ${codprod}:`, err);
  }
}

/**
 * Deleta todas as formações de preço de um produto
 */
export async function deletarPrecosProduto(
  client: PoolClient,
  codprod: string,
  schema: string = 'public'
): Promise<void> {
  const tableName = schema ? `${schema}."DBFORMACAOPRVENDA"` : '"DBFORMACAOPRVENDA"';

  await client.query(`DELETE FROM ${tableName} WHERE "CODPROD" = $1`, [codprod]);

  try {
    await client.query(`DELETE FROM dbpreco WHERE codprod = $1`, [codprod]);
  } catch {
    // Ignorar se DBPRECO não existir
  }
}
