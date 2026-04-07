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

  // Calcular custo base
  const custoOriginal = produto.prcustoatual || produto.prcompra || 0;
  if (custoOriginal === 0) {
    console.log(`Produto ${produto.codprod}: custo base = 0, nada a recalcular`);
    return;
  }

  let custoBase = custoOriginal;
  if (produto.dolar === 'S' && produto.txdolarcompra && produto.txdolarcompra > 0) {
    custoBase = custoOriginal * produto.txdolarcompra;
  }

  // 2. Para cada registro existente, recalcular preço mantendo a margem
  const formacoesAtualizadas: FormacaoPreco[] = [];

  for (const reg of existentes.rows) {
    const tipopreco = parseInt(reg.TIPOPRECO, 10);
    const margemLiquida = parseFloat(reg.MARGEMLIQUIDA || 0);
    const icms = parseFloat(reg.ICMS || 0);
    const pis = parseFloat(reg.PIS || 0);
    const cofins = parseFloat(reg.COFINS || 0);
    const comissao = parseFloat(reg.COMISSAO || 0);
    const taxaCartao = parseFloat(reg.TAXACARTAO || 0);
    const ipi = parseFloat(reg.IPI || 0);

    // Fórmula legada:
    // precoComMargem = custoBase * (1 + margemliquida / 100)
    // fatorDespesas = 100 - (ICMS + PIS + COFINS + comissao + taxaCartao)
    // precoFinal = precoComMargem / (fatorDespesas / 100) + IPI
    const precoComMargem = custoBase * (1 + margemLiquida / 100);
    const fatorDespesasPct = 100 - (icms + pis + cofins + comissao + taxaCartao);
    let precoFinal: number;
    if (fatorDespesasPct > 0) {
      precoFinal = precoComMargem / (fatorDespesasPct / 100) + ipi;
    } else {
      precoFinal = precoComMargem + ipi;
    }

    precoFinal = Number(precoFinal.toFixed(2));

    const formacao: FormacaoPreco = {
      CODPROD: produto.codprod,
      TIPOPRECO: tipopreco,
      PRECOVENDA: precoFinal,
      MARGEMLIQUIDA: margemLiquida,
      ICMSDEVOL: parseFloat(reg.ICMSDEVOL || 0),
      ICMS: icms,
      IPI: ipi,
      PIS: pis,
      COFINS: cofins,
      DCI: parseFloat(reg.DCI || 0),
      COMISSAO: comissao,
      FATORDESPESAS: Number((fatorDespesasPct / 100).toFixed(4)),
      TAXACARTAO: taxaCartao,
    };

    formacoesAtualizadas.push(formacao);

    // Atualizar o registro existente
    await client.query(
      `UPDATE ${tableName}
       SET "PRECOVENDA" = $1, "FATORDESPESAS" = $2
       WHERE "CODPROD" = $3 AND "TIPOPRECO" = $4`,
      [formacao.PRECOVENDA, formacao.FATORDESPESAS, produto.codprod, tipopreco]
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
