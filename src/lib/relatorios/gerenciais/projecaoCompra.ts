import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { exigirPeriodo, limitarPeriodo, numeros, semNestedLoop } from './_utilC';

/**
 * Relatórios › Gerenciais › Análise de Projeção de Compra (Delphi: FrmRelatorioProjecao — sem fonte
 * do form; package RELATORIO_PROJECAO: PROJECAO_COMPRA, DIAS_COBERTURA, EXTRATO_ITEM).
 * Por marca/grupo: dias de cobertura (dias do período com estoque), volume vendido, venda por dia,
 * estoque mínimo sugerido e projeção de cobertura para N dias, ao lado do estoque mínimo atual.
 * Diferenças deliberadas:
 *  - SOMENTE LEITURA: o Delphi permitia gravar o novo estoque mínimo (ESTMINIMO_ALTERAR → UPDATE
 *    dbprod.qtestmin); aqui não grava nada. A Sugestão de Compras do web (compras/sugestoes) tem
 *    outra fórmula (demanda 30/60 dias, curva, fator de segurança) e gera requisição; este relatório
 *    fica como análise de cobertura, sem substituir aquela tela;
 *  - dias de cobertura calculados num SQL só (o legado chamava DIAS_COBERTURA produto a produto e
 *    reconstruía o saldo com cursor): saldo de cada dia = estoque atual − movimentos posteriores;
 *    dia em falta = saldo ≤ 0 no fim do dia;
 *  - sem acertos de estoque (dbacerto não existe no PG). Filtros parametrizados (o legado montava
 *    o SQL concatenando marca/grupo/curva).
 */
export const relatorio: Relatorio = {
  slug: 'projecaoCompra',
  titulo: 'Análise de Projeção de Compra',
  descricao:
    'Para os produtos estocados da marca ou grupo: dias de cobertura no período (dias com estoque), volume vendido (vendas finalizadas, sem as filiais), venda por dia de cobertura, ' +
    'estoque mínimo sugerido (venda/dia × dias da projeção ou × dias de reposição do grupo) e projeção para N dias, comparados com o estoque mínimo atual. ' +
    'Só consulta: não altera o estoque mínimo. O saldo diário é reconstruído a partir do estoque atual; com o histórico parcial (vendas até meados de 2025 e poucas depois) os números de períodos antigos ficam imprecisos.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período de vendas', tipo: 'periodo', obrigatorio: true, padrao: { de: '-90d', ate: 'hoje' } },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'curva', rotulo: 'Curva', tipo: 'select',
      opcoes: [{ valor: 'A', rotulo: 'A' }, { valor: 'B', rotulo: 'B' }, { valor: 'C', rotulo: 'C' }, { valor: 'D', rotulo: 'D' }] },
    { campo: 'dias_projecao', rotulo: 'Dias de projeção', tipo: 'numero', padrao: 30 },
    { campo: 'base_minimo', rotulo: 'Estoque mínimo por', tipo: 'select', padrao: 'P',
      opcoes: [{ valor: 'P', rotulo: 'Dias de projeção' }, { valor: 'R', rotulo: 'Dias de reposição do grupo' }] },
    { campo: 'somente_vendidos', rotulo: 'Só produtos com venda no período', tipo: 'checkbox', padrao: false },
  ],
  colunas: [
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'descr', titulo: 'Descrição' },
    { campo: 'curva', titulo: 'Curva' },
    { campo: 'dias_cobertura', titulo: 'Dias de cobertura', tipo: 'inteiro' },
    { campo: 'volume_vendas', titulo: 'Volume de vendas', tipo: 'inteiro', total: true },
    { campo: 'venda_dia', titulo: 'Vendas × cobertura (por dia)', tipo: 'numero' },
    { campo: 'estoque_atual', titulo: 'Estoque atual', tipo: 'inteiro', total: true },
    { campo: 'dias_reposicao', titulo: 'Dias p/ reposição', tipo: 'inteiro' },
    { campo: 'estoque_minimo', titulo: 'Estoque mínimo sugerido', tipo: 'inteiro', total: true },
    { campo: 'projecao', titulo: 'Projeção de cobertura', tipo: 'inteiro', total: true },
    { campo: 'est_minimo_atual', titulo: 'Est. mínimo atual', tipo: 'inteiro', total: true },
  ],
  async executar(db, p) {
    exigirPeriodo(p);
    limitarPeriodo(p, 400);
    if (!p.marcas && !p.grupos) throw new RelatorioValidacaoError('Informe ao menos uma marca ou um grupo de produto.');
    const dias = p.dias_projecao == null ? 30 : Math.round(Number(p.dias_projecao));
    if (!(dias > 0 && dias <= 3650)) throw new RelatorioValidacaoError('Dias de projeção deve ser entre 1 e 3650.');

    const params: any[] = [p.de, p.ate, dias, p.base_minimo === 'R' ? 'R' : 'P'];
    const onde = [`pd.est = 'S'`, `COALESCE(pd.excluido, 0) <> 1`];
    if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
    if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
    if (p.curva) { params.push(p.curva); onde.push(`upper(trim(pd.curva)) = $${params.length}`); }

    const rows = (await semNestedLoop(db, () => db.query(
      `WITH prod AS MATERIALIZED (
         SELECT pd.codprod, pd.ref, pd.descr, pd.curva, COALESCE(pd.qtest, 0) AS qtest,
                COALESCE(pd.qtestmin, 0) AS qtestmin, gp.diasreposicao
           FROM dbprod pd LEFT JOIN dbgpprod gp ON gp.codgpp = pd.codgpp
          WHERE ${onde.join(' AND ')}
       ), vendas AS (
         SELECT iv.codprod, v.data::date AS dia, iv.qtd,
                (v.status = 'F' AND v.data < ($2::date + 1)
                 AND NOT EXISTS (SELECT 1 FROM dbclien_filial cf WHERE cf.codcli = v.codcli)) AS conta_volume
           FROM dbitvenda iv
           JOIN prod ON prod.codprod = iv.codprod
           JOIN dbvenda v ON v.codvenda = iv.codvenda
          WHERE v.data >= $1::date AND COALESCE(v.cancel, 'N') = 'N' AND COALESCE(v.estoque_virtual, 'N') = 'N'
       ), mov AS (
         SELECT codprod, dia, sum(q) AS net FROM (
           SELECT codprod, dia, -qtd AS q FROM vendas
           UNION ALL
           SELECT ie.codprod, e.dtent::date, ie.quant - COALESCE(ie.quant_filial, 0)
             FROM dbitent ie JOIN prod ON prod.codprod = ie.codprod JOIN dbent e ON e.codent = ie.codent
            WHERE e.dtent >= $1::date AND COALESCE(e.status, '') <> 'C'
           UNION ALL
           SELECT i.codprod, g.dt_gar::date, -i.qtde
             FROM dbitgarantiaprod i JOIN prod ON prod.codprod = i.codprod JOIN dbgarantiaprod g ON g.codgar = i.codgar
            WHERE g.dt_gar >= $1::date AND COALESCE(g.cancel, 'N') = 'N'
         ) x GROUP BY 1, 2
       ), seg AS (
         -- nível no início do período e depois de cada dia com movimento
         SELECT prod.codprod, $1::date AS inicio, 0 AS ord,
                prod.qtest - COALESCE(t.net, 0) AS nivel
           FROM prod LEFT JOIN (SELECT codprod, sum(net) AS net FROM mov GROUP BY codprod) t ON t.codprod = prod.codprod
         UNION ALL
         SELECT m.codprod, m.dia, 1,
                prod.qtest - COALESCE(sum(m.net) OVER (PARTITION BY m.codprod ORDER BY m.dia DESC
                                                       ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
           FROM mov m JOIN prod ON prod.codprod = m.codprod
       ), seg2 AS (
         SELECT codprod, inicio, nivel,
                COALESCE(lead(inicio) OVER (PARTITION BY codprod ORDER BY inicio, ord), $2::date + 1) AS fim
           FROM seg
       ), falta AS (
         SELECT codprod, sum(GREATEST(0, LEAST(fim, $2::date + 1) - GREATEST(inicio, $1::date))) AS dias_falta
           FROM seg2 WHERE nivel <= 0 GROUP BY codprod
       ), vol AS (
         SELECT codprod, sum(qtd) AS venda FROM vendas WHERE conta_volume GROUP BY codprod
       ), base AS (
         SELECT prod.*, ($2::date - $1::date + 1) - COALESCE(falta.dias_falta, 0) AS cobertura,
                COALESCE(vol.venda, 0) AS venda
           FROM prod LEFT JOIN falta ON falta.codprod = prod.codprod LEFT JOIN vol ON vol.codprod = prod.codprod
       )
       SELECT ref, descr, curva, cobertura AS dias_cobertura, venda AS volume_vendas,
              CASE WHEN cobertura <= 0 THEN 0 ELSE round(venda::numeric / cobertura, 2) END AS venda_dia,
              qtest AS estoque_atual, diasreposicao AS dias_reposicao,
              CASE WHEN cobertura <= 0 THEN 0
                   WHEN $4::text = 'P' THEN round(venda::numeric / cobertura * $3::int)
                   ELSE round(venda::numeric / cobertura * COALESCE(diasreposicao, 0)) END AS estoque_minimo,
              CASE WHEN cobertura <= 0 THEN 0 ELSE round(venda::numeric / cobertura * $3::int) END AS projecao,
              qtestmin AS est_minimo_atual
         FROM base
        ${p.somente_vendidos ? 'WHERE venda > 0' : ''}
        ORDER BY curva NULLS LAST, ref`, params))).rows;
    numeros(rows, ['dias_cobertura', 'volume_vendas', 'venda_dia', 'estoque_atual', 'dias_reposicao', 'estoque_minimo', 'projecao', 'est_minimo_atual']);
    const acima = rows.filter((r) => r.estoque_minimo > r.est_minimo_atual).length;
    const abaixo = rows.filter((r) => r.estoque_minimo < r.est_minimo_atual).length;
    return {
      linhas: rows,
      resumo: [`${rows.length} produtos · mínimo sugerido maior que o atual em ${acima} · menor em ${abaixo}`],
    };
  },
};
