import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Relação para Comissão por Cliente
 * (Delphi: FrmConsulta_comissao_por_cliente / COMISSAO_CLIENTE, COMISSAO_TOTAL_CLIENTE, FILTRO_CODVENDEDOR_NOVO).
 * PENDENTE: mesmas tabelas de regra da comissão por vendedor + .pas ausente + procedures inválidas no Oracle.
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'comissaoCliente',
  titulo: 'Relação para Comissão por Cliente',
  descricao: 'Para um cliente e período: as faturas vindas de cautela ou pré-pedido, os itens de cada fatura e os vendedores que comissionam nela, com % e valor da comissão.',
  filtros: [],
  colunas: [],
  pendente: 'Depende das tabelas dbprod_comissao e dbclivend (e da view vwRelVendCliGpp, montada sobre dbclivend), que ainda não existem no banco novo, e usa a mesma regra do package COMISSAO, ainda sem decisão (a comissão está suspensa). Além disso, o fonte do formulário no Delphi não existe e as procedures COMISSAO_CLIENTE e FILTRO_CODVENDEDOR_NOVO estão inválidas no Oracle.',
};
