import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { consultar, tsEntre, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Análise de Vendas (Delphi: frmAnaliseVendas — ANALISE.PRODUTO_NAO_VENDIDOS_PARTE1/
 * PARTE2, ANALISE.PRODUTOS_VENDIDOS e ANALISE.PROD_SEM_VENDAS_CUSTOS). Três análises sobre a VENDA (dbvenda/
 * dbitvenda, não a nota), escolhidas no filtro "Análise":
 *  - Não vendidos: produtos das marcas/grupos (estoque = 0 ou > 0) sem venda no período;
 *  - Vendidos: ranking por quantidade vendida no período;
 *  - Não vendidos (custos): produtos com estoque que tiveram entrada com custo no período de entrada e não
 *    venderam no período de venda, com o valor parado (pr. compra × estoque).
 * Diferenças: o laço por produto do legado (PARTE2 chamada para cada produto, N+1) virou um anti-join; aceita
 * várias marcas/grupos; os clientes fixos excluídos do ranking (04487, 03341, 00002, 05634 — filiais) viraram
 * a tabela dbclien_filial; produtos excluídos do cadastro ficam fora.
 */
const COLUNAS: Record<string, ColunaDef[]> = {
  nao_vendidos: [
    { campo: 'ref', titulo: 'Referência' }, { campo: 'produto', titulo: 'Produto' }, { campo: 'marca', titulo: 'Marca' },
    { campo: 'grupo', titulo: 'Grupo' }, { campo: 'qtest', titulo: 'Estoque', tipo: 'inteiro', total: true },
    { campo: 'local', titulo: 'Locação' }, { campo: 'prcompra', titulo: 'Pr. compra', tipo: 'moeda' },
    { campo: 'prcustoatual', titulo: 'Custo atual', tipo: 'moeda' },
  ],
  vendidos: [
    { campo: 'ref', titulo: 'Referência' }, { campo: 'produto', titulo: 'Produto' }, { campo: 'aplicacao', titulo: 'Aplicação estendida' },
    { campo: 'marca', titulo: 'Marca' }, { campo: 'grupo', titulo: 'Grupo' },
    { campo: 'qtd', titulo: 'Quant.', tipo: 'inteiro', total: true }, { campo: 'total', titulo: 'Valor vendido', tipo: 'moeda', total: true },
    { campo: 'local', titulo: 'Locação' }, { campo: 'prcompra', titulo: 'Pr. compra', tipo: 'moeda' },
    { campo: 'prcustoatual', titulo: 'Custo atual', tipo: 'moeda' },
  ],
  sem_venda_custo: [
    { campo: 'ref', titulo: 'Referência' }, { campo: 'produto', titulo: 'Produto' }, { campo: 'marca', titulo: 'Marca' },
    { campo: 'prcompra', titulo: 'Pr. compra', tipo: 'moeda' }, { campo: 'prcustoatual', titulo: 'Custo atual', tipo: 'moeda' },
    { campo: 'prmedio', titulo: 'Pr. médio', tipo: 'moeda' }, { campo: 'qtest', titulo: 'Quant.', tipo: 'inteiro', total: true },
    { campo: 'custo', titulo: 'Pr. compra × quant.', tipo: 'moeda', total: true },
    { campo: 'ultima_entrada', titulo: 'Última entrada', tipo: 'data' },
  ],
};

export const relatorio: Relatorio = {
  slug: 'analiseVendas',
  titulo: 'Análise de Vendas',
  descricao:
    'Três análises de produto sobre as vendas: produtos não vendidos no período (por marca/grupo, com estoque zero ou maior que zero), produtos vendidos (ranking por quantidade, sem as vendas para as filiais) e produtos parados com custo (tiveram entrada com custo e não venderam, com o valor em estoque). ' +
    'Observação: as vendas no banco novo vão até 06/2025 (mais as feitas pelo web) e as entradas existem de 07/2025 em diante.',
  paisagem: true,
  filtros: [
    { campo: 'analise', rotulo: 'Análise', tipo: 'select', obrigatorio: true, padrao: 'nao_vendidos',
      opcoes: [{ valor: 'nao_vendidos', rotulo: 'Produtos não vendidos' }, { valor: 'vendidos', rotulo: 'Produtos vendidos' }, { valor: 'sem_venda_custo', rotulo: 'Não vendidos (custos)' }] },
    { campo: 'periodo', rotulo: 'Período de venda', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_ano', ate: 'hoje' } },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'estoque', rotulo: 'Estoque (não vendidos)', tipo: 'select', padrao: '=',
      opcoes: [{ valor: '=', rotulo: 'Igual a zero' }, { valor: '>', rotulo: 'Maior que zero' }, { valor: 'T', rotulo: 'Qualquer' }] },
    { campo: 'ent_de', rotulo: 'Entrada de (custos)', tipo: 'data' },
    { campo: 'ent_ate', rotulo: 'Entrada até (custos)', tipo: 'data' },
  ],
  colunas: COLUNAS.nao_vendidos,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const analise = String(p.analise || 'nao_vendidos');
    const params: any[] = [de, ate];
    const ondeProd = [`COALESCE(pd.excluido, 0) <> 1`];
    if (p.marcas) { params.push(p.marcas); ondeProd.push(`pd.codmarca = ANY($${params.length})`); }
    if (p.grupos) { params.push(p.grupos); ondeProd.push(`pd.codgpp = ANY($${params.length})`); }
    const exigeMG = () => { if (!p.marcas && !p.grupos) throw new RelatorioValidacaoError('Escolha ao menos uma marca ou um grupo de produto.'); };
    const vendaNoPeriodo = tsEntre('v.data', '$1::date', '$2::date');
    const joins = `LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp`;

    if (analise === 'vendidos') {
      const linhas = await consultar(db,
        `WITH vend AS (
           SELECT iv.codprod, sum(COALESCE(iv.qtd, 0)) AS qtd, sum(COALESCE(iv.qtd, 0) * COALESCE(iv.prunit, 0)) AS total
             FROM dbvenda v JOIN dbitvenda iv ON iv.codvenda = v.codvenda
            WHERE ${vendaNoPeriodo} AND COALESCE(v.cancel, 'N') <> 'S'
              AND NOT EXISTS (SELECT 1 FROM dbclien_filial cf WHERE cf.codcli = v.codcli)
            GROUP BY 1)
         SELECT pd.ref, pd.descr AS produto, pd.aplic_extendida AS aplicacao, m.descr AS marca, g.descr AS grupo,
                vend.qtd, round(vend.total, 2) AS total, pd.local, pd.prcompra, pd.prcustoatual
           FROM vend JOIN dbprod pd ON pd.codprod = vend.codprod ${joins}
          WHERE ${ondeProd.join(' AND ')}
          ORDER BY vend.qtd DESC, pd.ref`, params);
      return { linhas: numerosDasColunas(linhas, COLUNAS.vendidos), colunas: COLUNAS.vendidos };
    }

    exigeMG();
    // produtos vendidos no período (anti-join no lugar do N+1 do legado)
    const vendidos = `vendidos AS (
        SELECT DISTINCT iv.codprod FROM dbvenda v JOIN dbitvenda iv ON iv.codvenda = v.codvenda
         WHERE ${vendaNoPeriodo} AND COALESCE(v.cancel, 'N') = 'N')`;

    if (analise === 'sem_venda_custo') {
      if (!p.ent_de || !p.ent_ate) throw new RelatorioValidacaoError('Informe o período de entrada (de / até).');
      if (p.ent_de > p.ent_ate) throw new RelatorioValidacaoError('A data inicial da entrada é maior que a final.');
      params.push(p.ent_de, p.ent_ate);
      const [e1, e2] = [params.length - 1, params.length];
      const linhas = await consultar(db,
        `WITH ${vendidos},
         ent AS (
           SELECT it.codprod, max(e.dtent)::date AS ultima FROM dbent e JOIN dbitent it ON it.codent = e.codent
            WHERE e.temcusto = 'S' AND e.dtent::date BETWEEN $${e1}::date AND $${e2}::date AND COALESCE(e.status, '') <> 'C'
            GROUP BY 1)
         SELECT pd.ref, pd.descr AS produto, m.descr AS marca, pd.prcompra, pd.prcustoatual, pd.prmedio, pd.qtest,
                round(COALESCE(pd.prcompra, 0) * pd.qtest, 2) AS custo, to_char(ent.ultima, 'YYYY-MM-DD') AS ultima_entrada
           FROM dbprod pd
           JOIN ent ON ent.codprod = pd.codprod
           LEFT JOIN vendidos vv ON vv.codprod = pd.codprod
           ${joins}
          WHERE ${ondeProd.join(' AND ')} AND pd.qtest > 0 AND vv.codprod IS NULL
          ORDER BY pd.ref`, params);
      return { linhas: numerosDasColunas(linhas, COLUNAS.sem_venda_custo), colunas: COLUNAS.sem_venda_custo };
    }

    const est = p.estoque === '>' ? `AND COALESCE(pd.qtest, 0) > 0` : p.estoque === 'T' ? '' : `AND COALESCE(pd.qtest, 0) = 0`;
    const linhas = await consultar(db,
      `WITH ${vendidos},
       prods AS (SELECT pd.* FROM dbprod pd WHERE ${ondeProd.join(' AND ')} ${est})
       SELECT pd.ref, pd.descr AS produto, m.descr AS marca, g.descr AS grupo, pd.qtest, pd.local, pd.prcompra, pd.prcustoatual,
              (SELECT count(*) FROM prods) AS n_prods
         FROM prods pd
         LEFT JOIN vendidos vv ON vv.codprod = pd.codprod
         ${joins}
        WHERE vv.codprod IS NULL
        ORDER BY pd.ref`, params);
    const nProds = linhas.length ? Number(linhas[0].n_prods) : 0;
    for (const l of linhas) delete l.n_prods;
    const resumo = linhas.length
      ? [`Produtos da seleção (com o filtro de estoque): ${nProds.toLocaleString('pt-BR')} · não vendidos no período: ${linhas.length.toLocaleString('pt-BR')}`]
      : [];
    return { linhas: numerosDasColunas(linhas, COLUNAS.nao_vendidos), colunas: COLUNAS.nao_vendidos, resumo };
  },
};
