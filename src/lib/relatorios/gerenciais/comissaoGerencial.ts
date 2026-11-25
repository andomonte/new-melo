import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Relação para Comissão por Vendedor › Gerencial
 * (Delphi: FrmRelatorioComissao, modo Gerencial / COMISSAO.COMISSAO_VENDEDOR).
 * PENDENTE: tabelas de regra não migradas + regra de comissão sem decisão (comissão suspensa).
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'comissaoGerencial',
  titulo: 'Comissão por Vendedor - Gerencial',
  descricao: 'Comissão por vendedor detalhada por cliente e documento (D1, NF, FAG): total vendido, prazo médio, margem, % e valor de comissão, com bloco de totais (venda ativa × passiva, grupos com % diferenciado, comissão sem cobrança).',
  filtros: [],
  colunas: [],
  pendente: 'Depende das tabelas dbprod_comissao (% de comissão por produto), dbclivend (carteira do 2º vendedor) e dbgpfaturareceb, que ainda não existem no banco novo, e da decisão sobre qual regra de comissão vale: a do package COMISSAO do Delphi (9 ramos e exceções fixas) ou a da tela Comissão de Vendedor do web. A comissão está suspensa por decisão do negócio.',
};
