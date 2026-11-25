import type { ColunaDef, Relatorio } from '../tipos';
import { AVISO_ITENS, CFOP_SAIDA, consultar, cteItensFaturados, margem, numerosDasColunas, periodo, tsEntre } from './_utilB';

/**
 * Relatórios › Gerenciais › Custo de Mercadoria Vendida (Delphi: frmCMV — package RELATORIOS: CMV_FATURAMENTO,
 * CMV_FATURAMENTO_NVENDA, ENTRADAS, INVENTARIO, CMV_VENDA_NFATURADA e os *_PRODUTO do detalhamento).
 * Por marca, grupo ou produto (o "zoom" do Delphi): compras, faturado, custo do faturado e margem,
 * inventário, faturado em outros CFOPs e pré-pedidos, em R$ ou em quantidade.
 * Diferenças:
 *  - o legado recebia um pedaço de WHERE pronto (vFiltro) e montava SQL dinâmico; aqui são filtros
 *    parametrizados, combinados com E (o construtor do Delphi juntava as condições com OU);
 *  - dbcfop_saida não existe no PG: a lista dos 14 CFOPs de saída foi copiada do Oracle (CFOP_SAIDA);
 *  - itens faturados: ver _utilB (dbprodfat + itens das vendas faturadas até 06/2025). Custo = custo gravado
 *    no item da venda (regra do legado desde 17/08/2016), ou o pr. compra atual quando o item não tem custo;
 *  - compras (dbent/dbitent: (quant − quant_filial) × prunit, convertido pelo dólar) só existem no banco
 *    novo de 07/2025 em diante; inventário é sempre o estoque atual (qtest × prcompra), como no legado;
 *  - pré-pedido: vendas em aberto (status <> 'F') do PERÍODO (o legado somava todas, sem data);
 *  - filtro de cliente vale só para faturado / outros CFOPs / pré-pedido; "Informativo" (dbinfprod, ausente
 *    no PG) não foi incluído.
 */
const colunasPara = (agrupar: string, qtd: boolean): ColunaDef[] => {
  const t = qtd ? 'inteiro' : 'moeda';
  return [
    { campo: 'codigo', titulo: 'Código' },
    { campo: 'descricao', titulo: agrupar === 'P' ? 'Produto' : agrupar === 'G' ? 'Grupo de produto' : 'Marca' },
    { campo: 'compras', titulo: qtd ? 'Compras (qtd)' : 'C. compras', tipo: t, total: true },
    { campo: 'faturado', titulo: qtd ? 'Faturado (qtd)' : 'Faturado', tipo: t, total: true },
    ...(qtd ? [] : [
      { campo: 'c_faturado', titulo: 'C. faturado', tipo: 'moeda' as const, total: true },
      { campo: 'margem', titulo: 'M. faturado (%)', tipo: 'percentual' as const },
    ]),
    { campo: 'inventario', titulo: qtd ? 'Inventário (qtd)' : 'Inventário', tipo: t, total: true },
    { campo: 'faturado_outros', titulo: 'Faturado outros CFOP', tipo: t, total: true },
    { campo: 'pre_pedido', titulo: 'Pré-pedido', tipo: t, total: true },
  ];
};

export const relatorio: Relatorio = {
  slug: 'cmv',
  titulo: 'Custo de Mercadoria Vendida',
  descricao:
    'Por marca, grupo de produto ou produto: compras do período, faturado, custo do faturado e margem ((faturado ÷ custo − 1) × 100), inventário atual, faturado em outros CFOPs e pré-pedidos em aberto, em R$ ou em quantidade. ' +
    AVISO_ITENS + ' Compras (entradas) existem no banco novo só a partir de 07/2025; o inventário é o estoque de hoje.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', obrigatorio: true, padrao: 'M',
      opcoes: [{ valor: 'M', rotulo: 'Marca' }, { valor: 'G', rotulo: 'Grupo de produto' }, { valor: 'P', rotulo: 'Produto (detalhamento)' }] },
    { campo: 'tipo', rotulo: 'Visualizar', tipo: 'select', obrigatorio: true, padrao: 'REAL',
      opcoes: [{ valor: 'REAL', rotulo: 'Real (R$)' }, { valor: 'QUANTIDADE', rotulo: 'Quantidade' }] },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'grupos_func', rotulo: 'Grupos funcionais', tipo: 'lookup', lookup: 'grupofunc', multiplo: true },
    { campo: 'compradores', rotulo: 'Compradores (do grupo)', tipo: 'lookup', lookup: 'comprador', multiplo: true },
    { campo: 'segmentos', rotulo: 'Segmentos (do grupo)', tipo: 'lookup', lookup: 'segmento', multiplo: true },
    { campo: 'clientes', rotulo: 'Clientes (faturado e pré-pedido)', tipo: 'lookup', lookup: 'cliente', multiplo: true },
  ],
  colunas: colunasPara('M', false),
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const agrupar = p.agrupar === 'G' || p.agrupar === 'P' ? p.agrupar : 'M';
    const qtd = p.tipo === 'QUANTIDADE';
    const params: any[] = [];
    const cte = cteItensFaturados(params, de, ate); // $1, $2
    params.push(CFOP_SAIDA);
    const pCfop = params.length;

    // filtros de produto (valem para todas as colunas)
    const fProd: string[] = [`COALESCE(pd.excluido, 0) <> 1`];
    const add = (v: any, sql: (n: number) => string) => { if (v) { params.push(v); fProd.push(sql(params.length)); } };
    add(p.marcas, (n) => `pd.codmarca = ANY($${n})`);
    add(p.grupos, (n) => `pd.codgpp = ANY($${n})`);
    add(p.grupos_func, (n) => `pd.codgpf = ANY($${n})`);
    add(p.compradores, (n) => `g.codcomprador = ANY($${n})`);
    add(p.segmentos, (n) => `g.codseg = ANY($${n})`);
    let fCli = '';
    if (p.clientes) { params.push(p.clientes); fCli = `AND codcli = ANY($${params.length})`; }

    const dolar = `CASE WHEN pd.dolar = 'S' THEN COALESCE(NULLIF(pd.txdolarcompra, 0), 1) ELSE 1 END`;
    const chave = agrupar === 'P' ? 'pd.codprod' : agrupar === 'G' ? 'pd.codgpp' : 'pd.codmarca';
    const descr = agrupar === 'P' ? `trim(COALESCE(pd.ref, '') || ' - ' || COALESCE(pd.descr, ''))`
      : agrupar === 'G' ? `COALESCE(g.descr, '(sem grupo)')` : `COALESCE(m.descr, '(sem marca)')`;
    const v = (val: string, q: string) => (qtd ? q : val);

    const linhas = await consultar(db,
      `WITH ${cte},
       fat AS (
         SELECT codprod,
                sum(${v('valor', 'qtd')}) FILTER (WHERE cfop = ANY($${pCfop})) AS faturado,
                sum(custo) FILTER (WHERE cfop = ANY($${pCfop})) AS c_faturado,
                sum(${v('valor', 'qtd')}) FILTER (WHERE NOT (cfop = ANY($${pCfop}))) AS faturado_outros
           FROM itf WHERE COALESCE(tipodoc, 'V') IN ('V', 'N') ${fCli} GROUP BY 1),
       ent AS (
         SELECT it.codprod, sum(GREATEST(COALESCE(it.quant, 0) - COALESCE(it.quant_filial, 0), 0)) AS qt,
                sum(GREATEST(COALESCE(it.quant, 0) - COALESCE(it.quant_filial, 0), 0) * COALESCE(it.prunit, 0)) AS valor
           FROM dbent e JOIN dbitent it ON it.codent = e.codent
          WHERE e.dtent >= $1::date AND e.dtent < $2::date + 1
            AND COALESCE(e.status, '') <> 'C'
            AND COALESCE(NULLIF(e.cfop, ''), '0') IN ('1403', '1102', '1409', '1152', '2403', '2102', '2409', '2152', '0')
          GROUP BY 1),
       pre AS (
         SELECT iv.codprod, sum(COALESCE(iv.qtd, 0)) AS qt, sum(COALESCE(iv.qtd, 0) * COALESCE(iv.prunit, 0)) AS valor
           FROM dbvenda vv JOIN dbitvenda iv ON iv.codvenda = vv.codvenda
          WHERE ${tsEntre('vv.data', '$1::date', '$2::date')} AND vv.cancel = 'N' AND COALESCE(vv.status, '') <> 'F'
            ${fCli.replace('codcli', 'vv.codcli')}
          GROUP BY 1),
       base AS (
         SELECT codprod FROM fat UNION SELECT codprod FROM ent UNION SELECT codprod FROM pre
         UNION SELECT codprod FROM dbprod WHERE qtest > 0)
       SELECT ${chave} AS codigo, ${descr} AS descricao,
              round(COALESCE(sum(${v(`ent.valor * ${dolar}`, 'ent.qt')}), 0), 2) AS compras,
              round(COALESCE(sum(fat.faturado), 0), 2) AS faturado,
              round(COALESCE(sum(fat.c_faturado), 0), 2) AS c_faturado,
              round(COALESCE(sum(${v(`GREATEST(pd.qtest, 0) * COALESCE(pd.prcompra, 0) * ${dolar}`, 'GREATEST(pd.qtest, 0)')}), 0), 2) AS inventario,
              round(COALESCE(sum(fat.faturado_outros), 0), 2) AS faturado_outros,
              round(COALESCE(sum(${v('pre.valor', 'pre.qt')}), 0), 2) AS pre_pedido
         FROM base b
         JOIN dbprod pd ON pd.codprod = b.codprod
         LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN fat ON fat.codprod = b.codprod
         LEFT JOIN ent ON ent.codprod = b.codprod
         LEFT JOIN pre ON pre.codprod = b.codprod
        WHERE ${fProd.join(' AND ')}
        GROUP BY 1, 2
       HAVING COALESCE(sum(fat.faturado), 0) <> 0 OR COALESCE(sum(ent.qt), 0) <> 0 OR COALESCE(sum(pre.qt), 0) <> 0
           OR COALESCE(sum(fat.faturado_outros), 0) <> 0 ${agrupar === 'P' ? '' : 'OR COALESCE(sum(pd.qtest), 0) > 0'}
        ORDER BY 2, 1`, params);
    const colunas = colunasPara(agrupar, qtd);
    numerosDasColunas(linhas, [...colunas, { campo: 'c_faturado', titulo: '', tipo: 'moeda' }]);
    for (const l of linhas) l.margem = margem(l.faturado, l.c_faturado);
    const tf = linhas.reduce((s, l) => s + l.faturado, 0);
    const tc = linhas.reduce((s, l) => s + l.c_faturado, 0);
    const tCompra = linhas.reduce((s, l) => s + l.compras, 0);
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const resumo = qtd ? [] : [
      `Total de compra: R$ ${fmt(tCompra)} · Total de faturamento: R$ ${fmt(tf)} · Total de custo faturado: R$ ${fmt(tc)} · Margem faturamento × custo: ${fmt(margem(tf, tc))}%`,
    ];
    if (qtd) for (const l of linhas) { delete l.c_faturado; delete l.margem; }
    const avisos = de <= '2026-07-31' && ate >= '2025-07-01' ? [AVISO_ITENS] : [];
    const totais: Record<string, number> = qtd ? {} : { margem: margem(tf, tc) };
    return { linhas, colunas, resumo, totais, avisos };
  },
};
