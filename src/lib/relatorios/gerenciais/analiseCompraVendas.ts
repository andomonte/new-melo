import type { ColunaDef, Relatorio } from '../tipos';
import { exigirPeriodo, fmtNum, limitarPeriodo, numeros, semNestedLoop, somar } from './_utilC';

/**
 * Relatórios › Gerenciais › Análise de Compra e Vendas (Delphi: frmAnaliseCompraVendas,
 * Prepara_Geral / ANALISE.OBTER_PROD_FATURADOS, OBTER_PROD_D1, OBTER_PROD_COMPRADO e *_DETALHADO).
 * Por grupo (ou marca): total vendido (itens faturados + vendas tipo 1/2 "D1", como no legado)
 * contra o total comprado a custo final, e o coeficiente venda/compra.
 * Custo final do item (mesma ordem do Delphi): valor − desconto % da entrada (só quando o item
 * não tem IPI) + custo financeiro % + IPI % + frete rateado pelo conhecimento
 * (totalcon / totaltransp, se não for CIF).
 * Diferenças deliberadas: o Delphi multiplicava o valor do item pelo dólar (DLRCOM) quando o
 * produto é "em dólar", mas dbitent.prunit já vem em reais (conferido no Oracle e no PG: 360,62
 * no item × prcompra US$ 34,93) — aqui não converte; sem a parte "não estocados" (dbentradane*
 * não existe no PG e parou em 2010); filtro de grupo/marca no SQL (o Delphi apagava linhas no
 * cliente); cálculos no SQL (sem laço por item); fatura com tipodest vazio conta como cliente
 * (o faturamento web não grava tipodest).
 */
const colunasPara = (visao: string, porMarca: boolean): ColunaDef[] => {
  const cod = { campo: 'codigo', titulo: porMarca ? 'Cód. marca' : 'Cód. grupo' };
  const desc = { campo: 'descricao', titulo: porMarca ? 'Marca' : 'Grupo' };
  if (visao === 'compras') return [
    cod, desc,
    { campo: 'ref', titulo: 'Referência' }, { campo: 'codent', titulo: 'Entrada' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'quant', titulo: 'Quant.', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Pr. unit.', tipo: 'moeda' },
    { campo: 'comprado', titulo: 'Pr. × qtd.', tipo: 'moeda', total: true },
    { campo: 'desconto', titulo: 'Desc. %', tipo: 'numero' },
    { campo: 'custo_desconto', titulo: 'Desconto', tipo: 'moeda', total: true },
    { campo: 'fin', titulo: 'Fin. %', tipo: 'numero' },
    { campo: 'custo_fin', titulo: 'Custo fin.', tipo: 'moeda', total: true },
    { campo: 'ipi', titulo: 'IPI %', tipo: 'numero' },
    { campo: 'custo_ipi', titulo: 'Custo IPI', tipo: 'moeda', total: true },
    { campo: 'custo_frete', titulo: 'Custo frete', tipo: 'moeda', total: true },
    { campo: 'custo_final', titulo: 'Custo final', tipo: 'moeda', total: true },
  ];
  if (visao === 'vendas') return [
    cod, desc,
    { campo: 'ref', titulo: 'Referência' }, { campo: 'produto', titulo: 'Descrição' },
    { campo: 'quant', titulo: 'Quant.', tipo: 'numero', total: true },
    { campo: 'faturado', titulo: 'Faturado (NF)', tipo: 'moeda', total: true },
    { campo: 'vendido_d1', titulo: 'Vendas D1', tipo: 'moeda', total: true },
    { campo: 'total_venda', titulo: 'Total vendido', tipo: 'moeda', total: true },
  ];
  return [
    cod, desc,
    { campo: 'total_venda', titulo: 'Total venda', tipo: 'moeda', total: true },
    { campo: 'total_compra', titulo: 'Total compra', tipo: 'moeda', total: true },
    { campo: 'coeficiente', titulo: 'Coeficiente (venda/compra)', tipo: 'numero' },
  ];
};

export const relatorio: Relatorio = {
  slug: 'analiseCompraVendas',
  titulo: 'Análise de Compra e Vendas',
  descricao:
    'Confronta, por grupo de produto ou marca, o total vendido (itens de nota fiscal de venda + vendas tipo 1/2 "D1") com o total comprado a custo final ' +
    '(valor da nota − desconto + custo financeiro + IPI + frete do conhecimento), e mostra o coeficiente venda/compra. ' +
    'Atenção: no sistema novo os itens de nota de venda só existem a partir de 08/2026 e as entradas a partir de 2025; compras de não estocados (entrada NE) não entram.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true },
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', padrao: 'G',
      opcoes: [{ valor: 'G', rotulo: 'Grupo de produto' }, { valor: 'M', rotulo: 'Marca' }] },
    { campo: 'visao', rotulo: 'Visão', tipo: 'select', padrao: 'geral',
      opcoes: [
        { valor: 'geral', rotulo: 'Geral (venda × compra)' },
        { valor: 'compras', rotulo: 'Compras detalhadas' },
        { valor: 'vendas', rotulo: 'Vendas detalhadas' },
      ] },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'incluir_d1', rotulo: 'Somar vendas D1 (tipo 1/2)', tipo: 'checkbox', padrao: true,
      ajuda: 'Regra do Delphi. Se a venda D1 também tiver nota fiscal, ela é contada duas vezes.' },
  ],
  colunas: colunasPara('geral', false),
  async executar(db, p) {
    exigirPeriodo(p);
    limitarPeriodo(p, 732);
    const porMarca = p.agrupar === 'M';
    const visao = ['compras', 'vendas'].includes(p.visao) ? p.visao : 'geral';
    // $1/$2 = período, compartilhados por todas as partes (cada visão usa todos os parâmetros)
    const params: any[] = [p.de, p.ate];
    const per = (col: string) => `${col} >= $1::date AND ${col} < ($2::date + 1)`;
    const filtroProd: string[] = [];
    if (p.grupos) { params.push(p.grupos); filtroProd.push(`pd.codgpp = ANY($${params.length})`); }
    if (p.marcas) { params.push(p.marcas); filtroProd.push(`pd.codmarca = ANY($${params.length})`); }
    const fp = filtroProd.length ? ` AND ${filtroProd.join(' AND ')}` : '';
    const perF = per('f.data');
    const perV = per('v.data');
    const perE = per('e.dtent');
    const codigo = porMarca ? 'pd.codmarca' : 'pd.codgpp';
    const descricao = porMarca ? 'm.descr' : 'g.descr';
    const juncao = porMarca ? 'LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca' : 'LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp';

    const vendasSQL = `
      SELECT ${codigo} AS codigo, ${descricao} AS descricao, pd.codprod, pd.ref, pd.descr AS produto,
             sum(x.qtd) AS quant, sum(x.fat) AS faturado, sum(x.d1) AS vendido_d1
        FROM (SELECT pf.codprod, pf.qtde AS qtd, pf.qtde * pf.prunit AS fat, 0 AS d1
                FROM dbfatura f
                JOIN dbprodfat pf ON pf.codfat = f.codfat
                JOIN dbvenda vv ON vv.codvenda = pf.codvenda
               WHERE ${perF} AND COALESCE(f.tipofat, '') <> '2' AND COALESCE(f.tipodest, 'C') = 'C' AND COALESCE(f.cancel, 'N') = 'N'
              UNION ALL
              SELECT iv.codprod, iv.qtd, 0, iv.qtd * iv.prunit
                FROM dbvenda v JOIN dbitvenda iv ON iv.codvenda = v.codvenda
               WHERE ${perV} AND COALESCE(v.cancel, 'N') = 'N' AND v.tipo IN ('1', '2')${p.incluir_d1 ? '' : ' AND false'}) x
        JOIN dbprod pd ON pd.codprod = x.codprod
        ${juncao}
       WHERE true${fp}
       GROUP BY 1, 2, 3, 4, 5`;

    const comprasSQL = `
      SELECT ${codigo} AS codigo, ${descricao} AS descricao, pd.ref, e.codent, to_char(e.dtent, 'YYYY-MM-DD') AS data,
             ie.quant, ie.prunit, COALESCE(ie.ipi, 0) AS ipi, COALESCE(e.custofin, 0) AS fin, COALESCE(e.desconto, 0) AS desconto,
             (ie.quant * ie.prunit) AS comprado,
             (ie.quant * ie.prunit) AS base,
             CASE WHEN COALESCE(con.totaltransp, 0) > 0 AND con.cif = 'N' THEN con.totalcon / con.totaltransp ELSE 0 END AS coef_frete
        FROM dbent e
        JOIN dbitent ie ON ie.codent = e.codent
        JOIN dbprod pd ON pd.codprod = ie.codprod
        ${juncao}
        LEFT JOIN dbconhecimentoent con ON con.nrocon = e.nrocon AND con.codtransp = e.codtransp
       WHERE ${perE} AND COALESCE(e.status, '') <> 'C' AND e.temcusto = 'S'${fp}`;
    // custo em cascata: desconto → financeiro → IPI → frete (Prepara_Geral)
    const custoSQL = `
      SELECT c.*, d.custo_desconto, f.custo_fin, i.custo_ipi,
             (c.base - d.custo_desconto + f.custo_fin + i.custo_ipi) * c.coef_frete AS custo_frete,
             (c.base - d.custo_desconto + f.custo_fin + i.custo_ipi) * (1 + c.coef_frete) AS custo_final
        FROM (${comprasSQL}) c
        CROSS JOIN LATERAL (SELECT CASE WHEN c.ipi > 0 THEN 0 ELSE c.base * c.desconto / 100 END AS custo_desconto) d
        CROSS JOIN LATERAL (SELECT (c.base - d.custo_desconto) * c.fin / 100 AS custo_fin) f
        CROSS JOIN LATERAL (SELECT (c.base - d.custo_desconto + f.custo_fin) * c.ipi / 100 AS custo_ipi) i`;

    const r2 = (v: any) => Math.round(Number(v || 0) * 100) / 100;
    if (visao === 'compras') {
      const rows = (await semNestedLoop(db, () => db.query(`${custoSQL} ORDER BY c.descricao, c.codigo, c.codent, c.ref`, params))).rows;
      numeros(rows, ['quant', 'prunit', 'ipi', 'fin', 'desconto', 'comprado', 'custo_desconto', 'custo_fin', 'custo_ipi', 'custo_frete', 'custo_final']);
      for (const r of rows) for (const k of ['comprado', 'custo_desconto', 'custo_fin', 'custo_ipi', 'custo_frete', 'custo_final']) r[k] = r2(r[k]);
      return { linhas: rows, colunas: colunasPara(visao, porMarca), quebra: 'descricao' };
    }
    if (visao === 'vendas') {
      const rows = (await semNestedLoop(db, () => db.query(`${vendasSQL} ORDER BY 2, 1, 4`, params))).rows;
      numeros(rows, ['quant', 'faturado', 'vendido_d1']);
      for (const r of rows) { r.faturado = r2(r.faturado); r.vendido_d1 = r2(r.vendido_d1); r.total_venda = r2(r.faturado + r.vendido_d1); }
      return { linhas: rows, colunas: colunasPara(visao, porMarca), quebra: 'descricao' };
    }

    const rows = (await semNestedLoop(db, () => db.query(
      `WITH ve AS (${vendasSQL}), co AS (${custoSQL}),
            g AS (SELECT codigo, max(descricao) AS descricao, sum(faturado + vendido_d1) AS venda, 0 AS compra, count(DISTINCT codprod) AS refs FROM ve GROUP BY codigo
                  UNION ALL
                  SELECT codigo, max(descricao), 0, sum(custo_final), 0 FROM co GROUP BY codigo)
       SELECT codigo, max(descricao) AS descricao, round(sum(venda)::numeric, 2) AS total_venda,
              round(sum(compra)::numeric, 2) AS total_compra, sum(refs) AS refs
         FROM g GROUP BY codigo ORDER BY 2, 1`, params))).rows;
    numeros(rows, ['total_venda', 'total_compra', 'refs']);
    for (const r of rows) r.coeficiente = r.total_compra > 0 ? Math.round((r.total_venda / r.total_compra) * 10000) / 10000 : 0;
    const tv = somar(rows, 'total_venda');
    const tc = somar(rows, 'total_compra');
    return {
      linhas: rows,
      colunas: colunasPara(visao, porMarca),
      resumo: [`Total vendido: R$ ${fmtNum(tv, 2)} · Total comprado: R$ ${fmtNum(tc, 2)} · Coeficiente geral: ${tc > 0 ? fmtNum(tv / tc, 4) : '0'} · Referências vendidas: ${fmtNum(somar(rows, 'refs'))}`],
      totais: { coeficiente: tc > 0 ? Math.round((tv / tc) * 10000) / 10000 : 0 },
    };
  },
};
