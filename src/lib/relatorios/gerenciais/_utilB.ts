import { RelatorioValidacaoError, type ColunaDef, type Consultavel } from '../tipos';

/**
 * Apoio do lote B (faturamento / análises) dos Relatórios › Gerenciais.
 *
 * Fonte dos ITENS faturados ("itf"): no banco novo os itens das notas (dbprodfat) só existem a partir de
 * 08/2026 (o que o web emitiu). As vendas (dbvenda/dbitvenda) estão completas de 2024 a 06/2025, com o
 * vendedor (dbitvenda.codvend) e o operador de telemarketing (dbitvenda.codoperador) no item — que é o que
 * o Delphi tirava de dbvvend (operador N/S), tabela que não foi migrada.
 * Por isso os relatórios por item somam:
 *   1) itens das notas (dbprodfat × dbfatura, cancel='N', FATURA_CLIENTE), pela data da nota;
 *   2) itens das vendas faturadas (status 'F', não canceladas) que NÃO têm itens em dbprodfat, pela data da
 *      venda — no lugar dos itens de nota que não vieram do Oracle. Vendas para as filiais (dbclien_filial)
 *      ficam fora, como as notas tipodest<>'C' do legado.
 * Entre 07/2025 e 07/2026 não há item nem de venda nem de nota no banco novo: o resultado sai vazio/parcial.
 */

/** CFOPs de saída de venda (tabela dbcfop_saida do Oracle — 14 linhas, não migrada para o PG). */
export const CFOP_SAIDA = ['0', '5102', '5110', '5403', '5405', '5551', '5922', '6102', '6108', '6110', '6117', '6403', '6404', '7102'];

/** CFOPs fixos das procedures de "fatura sem título" / "notas sem cobrança" (FATURA_SEM_TITULO_REL, NOTASSEMCOBRANCA). */
export const CFOP_SEM_COBRANCA = ['5102', '5403', '5405', '6108', '6404', '6403', '6102', '0'];

/**
 * Fatura de venda para cliente, como o legado (tipodest='C', tipofat<>'2'). As notas emitidas pelo web
 * gravam tipodest/tipofat vazios e tipodoc='N': nelas, ficam fora as notas para as filiais (dbclien_filial).
 */
export const FATURA_CLIENTE = (f: string) =>
  `(${f}.tipodest = 'C' OR (${f}.tipodest IS NULL AND NOT EXISTS (SELECT 1 FROM dbclien_filial cf WHERE cf.codcli = ${f}.codcli)))` +
  ` AND COALESCE(${f}.tipofat, '') <> '2'`;

/** Tipo de documento da fatura: '3' = F.A.G.; o resto é N.F. */
export const DOC_FATURA = (f: string) => `CASE WHEN ${f}.tipofat = '3' THEN 'FAG' ELSE 'NF' END`;

/** Data local (Manaus) de um timestamptz — dbvenda.data é timestamptz. */
export const dataLocal = (col: string) => `(${col} AT TIME ZONE 'America/Manaus')::date`;

/**
 * timestamptz entre duas datas (inclusive), no fuso de Manaus — em faixa, para o planejador estimar bem
 * (com a expressão ::date a estimativa cai para ~1 linha e o plano vira laço aninhado).
 */
export const tsEntre = (col: string, de: string, ate: string) =>
  `${col} >= ((${de})::timestamp AT TIME ZONE 'America/Manaus') AND ${col} < (((${ate}) + 1)::timestamp AT TIME ZONE 'America/Manaus')`;

export const AVISO_ITENS =
  'Itens: até 06/2025 vêm das vendas faturadas (dbitvenda, pela data da venda); a partir de 08/2026, dos itens das notas (dbprodfat). Entre 07/2025 e 07/2026 o banco novo não tem itens.';

export const AVISO_DBPRODFAT =
  'Os itens das notas (dbprodfat) só existem no banco novo a partir de 08/2026 — notas anteriores aparecem sem itens.';

/** Exige o período (de/ate) e devolve. */
export function periodo(p: Record<string, any>): { de: string; ate: string } {
  if (!p.de || !p.ate) throw new RelatorioValidacaoError('Informe o período.');
  return { de: p.de, ate: p.ate };
}

/** Converte para número os campos informados (pg devolve numeric/bigint como string). */
export function numeros<T extends Record<string, any>>(rows: T[], campos: string[]): T[] {
  for (const r of rows) for (const c of campos) if (c in r) (r as any)[c] = r[c] == null ? null : Number(r[c]);
  return rows;
}

/** Converte para número todos os campos de colunas numéricas. */
export function numerosDasColunas(rows: Record<string, any>[], colunas: ColunaDef[]) {
  const campos = colunas.filter((c) => c.tipo && c.tipo !== 'texto' && c.tipo !== 'data').map((c) => c.campo);
  return numeros(rows, campos);
}

/** (valor / custo − 1) × 100, como a margem do legado (M.FATURADO do CMV). */
export const margem = (valor: number, custo: number) => (custo ? Math.round(((valor / custo) - 1) * 10000) / 100 : 0);
/** valor / base × 100 */
export const pct = (v: number, base: number) => (base ? Math.round((v / base) * 10000) / 100 : 0);

/**
 * CTE `itf` com os itens faturados no período (ver comentário do módulo). Empilha de/ate em `params`.
 * Colunas: origem ('NF'|'VENDA'), data, codfat, codvenda, codcli, codvend, codoperador, tele, codprod,
 * qtd, valor (qtd × preço), custo (qtd × custo gravado no item da venda; sem ele, prcompra atual),
 * tipofat, tipodoc, cfop.
 */
export function cteItensFaturados(params: any[], de: string, ate: string): string {
  params.push(de, ate);
  const a = `$${params.length - 1}::date`;
  const b = `$${params.length}::date`;
  return `itf AS MATERIALIZED (
      SELECT 'NF'::text AS origem, f.data::date AS data, f.codfat, pf.codvenda, f.codcli, f.codvend,
             NULLIF(iv.codoperador, '') AS codoperador, COALESCE(v.tele, 'N') AS tele, pf.codprod,
             COALESCE(pf.qtde, 0)::numeric AS qtd,
             COALESCE(pf.qtde, 0) * COALESCE(pf.prunit, 0) AS valor,
             COALESCE(pf.qtde, 0) * COALESCE(NULLIF(iv.prcompra, 0), pd.prcompra, 0) AS custo,
             f.tipofat, f.tipodoc, COALESCE(f.cfop1, '0') AS cfop
        FROM dbfatura f
        JOIN dbprodfat pf ON pf.codfat = f.codfat
        LEFT JOIN dbvenda v ON v.codvenda = pf.codvenda
        LEFT JOIN dbitvenda iv ON iv.codvenda = pf.codvenda AND iv.codprod = pf.codprod
        LEFT JOIN dbprod pd ON pd.codprod = pf.codprod
       WHERE f.data BETWEEN ${a} AND ${b}
         AND f.cancel = 'N' AND ${FATURA_CLIENTE('f')}
      UNION ALL
      SELECT 'VENDA'::text, ${dataLocal('v.data')}, NULL::varchar, v.codvenda, v.codcli,
             COALESCE(NULLIF(iv.codvend, ''), v.codvend), NULLIF(iv.codoperador, ''), COALESCE(v.tele, 'N'), iv.codprod,
             COALESCE(iv.qtd, 0)::numeric,
             COALESCE(iv.qtd, 0) * COALESCE(iv.prunit, 0),
             COALESCE(iv.qtd, 0) * COALESCE(NULLIF(iv.prcompra, 0), pd.prcompra, 0),
             NULL::varchar, 'V'::varchar, COALESCE(NULLIF(iv.cfop, ''), '0')
        FROM dbvenda v
        JOIN dbitvenda iv ON iv.codvenda = v.codvenda
        LEFT JOIN dbprod pd ON pd.codprod = iv.codprod
       WHERE ${tsEntre('v.data', a, b)}
         AND v.status = 'F' AND v.cancel = 'N'
         AND NOT EXISTS (SELECT 1 FROM dbprodfat x WHERE x.codvenda = v.codvenda)
         AND NOT EXISTS (SELECT 1 FROM dbclien_filial cf WHERE cf.codcli = v.codcli)
    )`;
}

/** Junções de cadastro para a CTE itf (alias i). */
export const JOINS_ITF = `
  LEFT JOIN dbprod pd ON pd.codprod = i.codprod
  LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
  LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
  LEFT JOIN dbclien c ON c.codcli = i.codcli
  LEFT JOIN dbvend vd ON vd.codvend = i.codvend
  LEFT JOIN dbvend op ON op.codvend = i.codoperador`;

/** Dimensões de agrupamento sobre itf + JOINS_ITF. */
export const DIMENSOES: Record<string, { codigo: string; descricao: string; rotulo: string }> = {
  grupo: { codigo: `pd.codgpp`, descricao: `COALESCE(g.descr, '(sem grupo)')`, rotulo: 'Grupo' },
  marca: { codigo: `pd.codmarca`, descricao: `COALESCE(m.descr, '(sem marca)')`, rotulo: 'Marca' },
  cliente: { codigo: `i.codcli`, descricao: `COALESCE(c.nome, '(sem cadastro)')`, rotulo: 'Cliente' },
  vendedor: { codigo: `i.codvend`, descricao: `COALESCE(vd.nome, '(sem vendedor)')`, rotulo: 'Vendedor' },
  operador: { codigo: `i.codoperador`, descricao: `COALESCE(op.nome, '(sem operador)')`, rotulo: 'Operador' },
  produto: { codigo: `i.codprod`, descricao: `trim(COALESCE(pd.ref, '') || ' - ' || COALESCE(pd.descr, ''))`, rotulo: 'Produto' },
};

export const OPCOES_AGRUPAR = (chaves: string[]) => chaves.map((k) => ({ valor: k, rotulo: DIMENSOES[k].rotulo }));

/** Filtros comuns de cadastro (marcas, grupos, clientes, vendedores) sobre itf + JOINS_ITF. */
export function filtrosCadastro(p: Record<string, any>, params: any[], onde: string[]) {
  if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
  if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
  if (p.clientes) { params.push(p.clientes); onde.push(`i.codcli = ANY($${params.length})`); }
  if (p.vendedores) { params.push(p.vendedores); onde.push(`i.codvend = ANY($${params.length})`); }
}

/** Acrescenta % do total e % acumulado (ranking) — linhas já ordenadas por `campo` desc. */
export function participacao(rows: Record<string, any>[], campo = 'total') {
  const tot = rows.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  let acc = 0;
  rows.forEach((r, k) => {
    acc += Number(r[campo]) || 0;
    r.posicao = k + 1;
    r.perc = pct(Number(r[campo]) || 0, tot);
    r.perc_acum = pct(acc, tot);
  });
  return tot;
}

/**
 * Executa e devolve linhas. As tabelas do db_manaus nunca passaram por ANALYZE (estatísticas de poucas
 * linhas): o planejador escolhe laço aninhado entre dbvenda e dbitvenda (o índice de dbitvenda começa por
 * codprod) e a consulta não termina. Por isso, só nesta transação (SET LOCAL — a API roda em BEGIN READ
 * ONLY) e só durante a consulta, desliga o laço aninhado: as junções viram hash, o certo para estes volumes.
 */
export async function consultar(db: Consultavel, sql: string, params: any[]) {
  await db.query('SET LOCAL enable_nestloop = off');
  try {
    return (await db.query(sql, params)).rows as Record<string, any>[];
  } finally {
    await db.query('SET LOCAL enable_nestloop = on').catch(() => undefined);
  }
}

/** Medidas usuais sobre itf (alias i) + JOINS_ITF (pd = produto). */
export const MEDIDAS = {
  qtd: `sum(i.qtd)`,
  total: `round(sum(i.valor), 2)`,
  custo: `round(sum(i.custo), 2)`,
  custo_atual: `round(sum(i.qtd * COALESCE(pd.prcustoatual, 0)), 2)`,
};

/**
 * Agrupa a CTE itf por uma dimensão (DIMENSOES) com as medidas pedidas. `cte` já deve ter empilhado
 * de/ate em `params`; `onde` usa os mesmos `params`. Devolve linhas com codigo, descricao e as medidas
 * (numéricas), ordenadas por total desc ou por descrição.
 */
export async function agruparItens(db: Consultavel, o: {
  cte: string; params: any[]; dim: string; onde?: string[]; medidas: Record<string, string>; ordenar?: 'total' | 'descricao';
}) {
  const d = DIMENSOES[o.dim];
  if (!d) throw new RelatorioValidacaoError('Agrupamento inválido.');
  const campos = Object.entries(o.medidas).map(([k, sql]) => `${sql} AS ${k}`);
  const ordem = o.ordenar === 'descricao' ? '2, 1' : `${'total' in o.medidas ? 'total' : '3'} DESC NULLS LAST, 2`;
  const rows = await consultar(db,
    `WITH ${o.cte}
     SELECT ${d.codigo} AS codigo, ${d.descricao} AS descricao, ${campos.join(', ')}
       FROM itf i ${JOINS_ITF}
      ${o.onde?.length ? `WHERE ${o.onde.join(' AND ')}` : ''}
      GROUP BY 1, 2
      ORDER BY ${ordem}`, o.params);
  return numeros(rows, Object.keys(o.medidas));
}

/** Margem s/ custo por linha e no total (campo `margem`). */
export function aplicarMargem(rows: Record<string, any>[], campoValor = 'total', campoCusto = 'custo') {
  for (const r of rows) r.margem = margem(Number(r[campoValor]) || 0, Number(r[campoCusto]) || 0);
  const v = rows.reduce((s, r) => s + (Number(r[campoValor]) || 0), 0);
  const c = rows.reduce((s, r) => s + (Number(r[campoCusto]) || 0), 0);
  return margem(v, c);
}
