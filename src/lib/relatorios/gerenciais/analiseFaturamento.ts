import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import {
  AVISO_ITENS, MEDIDAS, OPCOES_AGRUPAR, agruparItens, aplicarMargem, cteItensFaturados, filtrosCadastro, participacao, periodo,
} from './_utilB';

/**
 * Relatórios › Gerenciais › Análise de Faturamento (Delphi: frmAnaliseFaturamento — 5 abas; SQL dinâmico via
 * FILTRO e package ANALISE_FATURAMENTO: VENDEDOR/VENDEDOR_OPERADOR, CLIENTE_GRUPO_MARCA, GRUPO_MARCA,
 * RANKING_CLIENTE/MARCA, ANALISE.OBTER_PROD_FATURADOS…).
 * No web as abas viram o filtro "Visão" (cada uma com suas colunas) sobre uma única fonte de itens
 * faturados (ver _utilB: dbprodfat + itens das vendas faturadas), com filtros parametrizados.
 *  - Vendedor: faturamento como vendedor da nota + "como operador" de telemarketing (dbitvenda.codoperador,
 *    no lugar de dbvvend), por grupo/marca/cliente/produto, com custo atual e custo de compra e margem.
 *  - Cliente: grupos/marcas/produtos comprados por um cliente.
 *  - Grupo/Marca: clientes, vendedores ou produtos de grupos/marcas.
 *  - Ranking: clientes, marcas, grupos, vendedores ou produtos, com % e % acumulado.
 * Fora: sub-abas "volume de compras" (telefone em dbfncli, que não existe no PG), "por usuário" e o detalhe
 * de itens por venda; ramos D1/D2 (sem movimento desde 2009). Custo: o gravado no item da venda (custo de
 * compra) e o custo atual do cadastro (prcustoatual), como o legado.
 */
const base: ColunaDef[] = [{ campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Descrição' }];
const custos: ColunaDef[] = [
  { campo: 'custo_atual', titulo: 'Custo atual', tipo: 'moeda', total: true },
  { campo: 'custo', titulo: 'Custo de compra', tipo: 'moeda', total: true },
  { campo: 'margem', titulo: 'Margem s/ custo (%)', tipo: 'percentual' },
];
const COLUNAS: Record<string, ColunaDef[]> = {
  vendedor: [...base, { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
    { campo: 'direto', titulo: 'Como vendedor', tipo: 'moeda', total: true },
    { campo: 'operador', titulo: 'Como operador', tipo: 'moeda', total: true },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true }, ...custos],
  cliente: [...base, { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true }, { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true }, ...custos],
  ranking: [{ campo: 'posicao', titulo: 'Pos.', tipo: 'inteiro' }, ...base, { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
    { campo: 'perc', titulo: '% do total', tipo: 'percentual' }, { campo: 'perc_acum', titulo: '% acumulado', tipo: 'percentual' },
    { campo: 'margem', titulo: 'Margem s/ custo (%)', tipo: 'percentual' }],
};
COLUNAS.grupo_marca = COLUNAS.cliente;

export const relatorio: Relatorio = {
  slug: 'analiseFaturamento',
  titulo: 'Análise de Faturamento',
  descricao:
    'Painel do faturamento por item, em quatro visões (as abas do sistema antigo): Vendedor (como vendedor da nota e como operador de telemarketing, com custo e margem), Cliente, Grupo/Marca e Ranking. ' +
    'Escolha a visão e o agrupamento; a visão Vendedor exige o vendedor, a visão Cliente exige o cliente e a visão Grupo/Marca exige ao menos um grupo ou marca. ' +
    AVISO_ITENS + ' Margem = (total ÷ custo de compra − 1) × 100.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'visao', rotulo: 'Visão', tipo: 'select', obrigatorio: true, padrao: 'vendedor',
      opcoes: [{ valor: 'vendedor', rotulo: 'Vendedor' }, { valor: 'cliente', rotulo: 'Cliente' }, { valor: 'grupo_marca', rotulo: 'Grupo ou marca' }, { valor: 'ranking', rotulo: 'Ranking' }] },
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', obrigatorio: true, padrao: 'grupo',
      opcoes: OPCOES_AGRUPAR(['grupo', 'marca', 'cliente', 'vendedor', 'produto']) },
    { campo: 'ordenar', rotulo: 'Ordenar por', tipo: 'select', padrao: 'total',
      opcoes: [{ valor: 'total', rotulo: 'Total' }, { valor: 'descricao', rotulo: 'Descrição' }] },
    { campo: 'vendedor', rotulo: 'Vendedor', tipo: 'lookup', lookup: 'vendedor' },
    { campo: 'cliente', rotulo: 'Cliente', tipo: 'lookup', lookup: 'cliente' },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
  ],
  colunas: COLUNAS.vendedor,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const visao = String(p.visao || 'vendedor');
    if (visao === 'vendedor' && !p.vendedor) throw new RelatorioValidacaoError('Escolha o código do VENDEDOR.');
    if (visao === 'cliente' && !p.cliente) throw new RelatorioValidacaoError('Escolha o código do CLIENTE.');
    if (visao === 'grupo_marca' && !p.grupos && !p.marcas) throw new RelatorioValidacaoError('Escolha ao menos um grupo de produto ou marca.');
    const params: any[] = [];
    const cte = cteItensFaturados(params, de, ate);
    const onde: string[] = [];
    filtrosCadastro({ marcas: p.marcas, grupos: p.grupos }, params, onde);
    const medidas: Record<string, string> = { qtd: MEDIDAS.qtd };
    if (visao === 'vendedor') {
      params.push(p.vendedor);
      const v = `$${params.length}`;
      onde.push(`(i.codvend = ${v} OR i.codoperador = ${v})`);
      medidas.direto = `round(COALESCE(sum(i.valor) FILTER (WHERE i.codvend = ${v}), 0), 2)`;
      medidas.operador = `round(COALESCE(sum(i.valor) FILTER (WHERE i.codvend IS DISTINCT FROM ${v}), 0), 2)`;
    } else if (p.vendedor) { params.push(p.vendedor); onde.push(`i.codvend = $${params.length}`); }
    if (p.cliente) { params.push(p.cliente); onde.push(`i.codcli = $${params.length}`); }
    Object.assign(medidas, { total: MEDIDAS.total, custo_atual: MEDIDAS.custo_atual, custo: MEDIDAS.custo });

    const linhas = await agruparItens(db, { cte, params, dim: String(p.agrupar || 'grupo'), onde, medidas, ordenar: visao === 'ranking' ? 'total' : p.ordenar });
    const margemTotal = aplicarMargem(linhas);
    const totais: Record<string, number | string> = { margem: margemTotal };
    if (visao === 'ranking') { participacao(linhas); totais.perc = 100; totais.perc_acum = ''; totais.posicao = ''; }
    const avisos = de <= '2026-07-31' && ate >= '2025-07-01' ? [AVISO_ITENS] : [];
    return { linhas, colunas: COLUNAS[visao] || COLUNAS.vendedor, totais, avisos };
  },
};
