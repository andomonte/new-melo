/**
 * Relatórios › Gerenciais — mesma ordem e nomes do menu do Delphi (UniPrincipal, &Relatórios ›
 * Gerenciais). Análise de cada um em docs/relatorios-delphi/ (PLANO-RELATORIOS.md, itens 8–54).
 * Arquivo SEM código de servidor: usado pelo menu e pela migration das telas.
 * Rota de cada relatório: /relatorios/gerenciais/<slug>.
 */
export interface ItemCatalogo { slug: string; titulo: string }

export const RELATORIOS_GERENCIAIS: ItemCatalogo[] = [
  { slug: 'cautelasAberto', titulo: 'Cautelas em Aberto' },
  { slug: 'extratoItens', titulo: 'Extrato de Itens' },
  { slug: 'extratoRaioX', titulo: 'Extrato Produto - Raio-X' },
  { slug: 'extratoItemNF', titulo: 'Extrato de Item de Nota Fiscal' },
  { slug: 'extratoDetalhado', titulo: 'Extrato Detalhado' },
  { slug: 'faturasSemTitulos', titulo: 'Faturas sem Títulos de Cobrança' },
  { slug: 'listagemVendas', titulo: 'Listagem de Vendas' },
  { slug: 'produtosNE', titulo: 'Produtos para N.E.' },
  { slug: 'pendenciaProdutos', titulo: 'Pendência de Produtos' },
  { slug: 'produtosPromocao', titulo: 'Produtos em Promoção' },
  { slug: 'resumoDoctosGrupoMarca', titulo: 'Resumo Doctos Grupo/Marca' },
  { slug: 'produtoSemDemanda', titulo: 'Produto sem Demanda' },
  { slug: 'rankingVendedores', titulo: 'Ranking de Vendedores' },
  { slug: 'comissaoGerencial', titulo: 'Comissão por Vendedor - Gerencial' },
  { slug: 'comissaoFinanceiro', titulo: 'Comissão por Vendedor - Financeiro' },
  { slug: 'comissaoCliente', titulo: 'Relação para Comissão por Cliente' },
  { slug: 'notasSemCobranca', titulo: 'Relatório de Notas sem Cobrança' },
  { slug: 'listagemVendasDiaria', titulo: 'Listagem de Vendas - Diária' },
  { slug: 'resumoDocumentos', titulo: 'Resumo de Documentos' },
  { slug: 'vendasTelemarketing', titulo: 'Vendas Telemarketing por Vendedor' },
  { slug: 'metasPerfil', titulo: 'Metas de Venda por Perfil' },
  { slug: 'metasCliente', titulo: 'Metas de Venda por Cliente' },
  { slug: 'acompanhamentoVendas', titulo: 'Acompanhamento de Vendas' },
  { slug: 'analiseFaturamento', titulo: 'Análise de Faturamento' },
  { slug: 'analiseDetalhadaFaturamento', titulo: 'Análise Detalhada do Faturamento' },
  { slug: 'analiseFaturamentoTele', titulo: 'Análise de Faturamento - Telemarketing' },
  { slug: 'analiseVendas', titulo: 'Análise de Vendas' },
  { slug: 'cmv', titulo: 'Custo de Mercadoria Vendida' },
  { slug: 'vendasDesbloqueadas', titulo: 'Vendas Desbloqueadas' },
  { slug: 'faturamento2Vendedor', titulo: 'Faturamento do 2º Vendedor nos Grupos' },
  { slug: 'analiseCompraVendas', titulo: 'Análise de Compra e Vendas' },
  { slug: 'projecaoCompra', titulo: 'Análise de Projeção de Compra' },
  { slug: 'pedidosPorComprador', titulo: 'Pedidos/Entradas por Comprador' },
  { slug: 'comprasOrigemAB', titulo: 'Compras por Origem AB' },
  { slug: 'curvaAbc', titulo: 'Curva ABC' },
  { slug: 'projetarVendas', titulo: 'Projetar Vendas' },
  { slug: 'estoqueSuprido', titulo: 'Estoque Suprido' },
  { slug: 'saidaProdutoVendedor', titulo: 'Saída de Produto por Vendedor' },
  { slug: 'estoqueSaturado', titulo: 'Estoque Saturado' },
  { slug: 'estoqueCritico', titulo: 'Estoque Crítico' },
  { slug: 'produtosSemEntrada', titulo: 'Produtos que ainda não deram entrada' },
  { slug: 'licitacoes', titulo: 'Licitações' },
  { slug: 'produtosFagNF', titulo: 'Produtos por FAG e NF (DI)' },
  { slug: 'acompanhamentoSony', titulo: 'Acompanhamento SONY' },
  { slug: 'acompanhamentoHBuster', titulo: 'Acompanhamento HBuster' },
  { slug: 'acompanhamentoSachs', titulo: 'Acompanhamento SACHS' },
  { slug: 'produtosClientesFags', titulo: 'Produtos por Clientes e FAGs' },
];

export const hrefGerencial = (slug: string) => `/relatorios/gerenciais/${slug}`;
