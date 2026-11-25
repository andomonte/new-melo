import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Relação para Comissão por Vendedor › Financeiro
 * (Delphi: FrmRelatorioComissao, modo Financeiro / COMISSAO.COMISSAO_VENDEDOR — igual ao Gerencial sem a margem).
 * PENDENTE: tabelas de regra não migradas + regra de comissão sem decisão (comissão suspensa).
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'comissaoFinanceiro',
  titulo: 'Comissão por Vendedor - Financeiro',
  descricao: 'Igual ao Gerencial (comissão por vendedor, cliente e documento, com prazo médio, % e valor de comissão e bloco de totais), sem a coluna de margem.',
  filtros: [],
  colunas: [],
  pendente: 'Depende das tabelas dbprod_comissao (% de comissão por produto), dbclivend (carteira do 2º vendedor) e dbgpfaturareceb, que ainda não existem no banco novo, e da decisão sobre qual regra de comissão vale: a do package COMISSAO do Delphi (9 ramos e exceções fixas) ou a da tela Comissão de Vendedor do web. A comissão está suspensa por decisão do negócio.',
};
