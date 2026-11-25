import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Faturamento do 2º Vendedor nos Grupos
 * (Delphi: FrmRelatorioGeral / tabFaturamentoGrupo / RELATO.FATURA_VENDEDOR_GRUPO).
 * PENDENTE: a carteira do 2º vendedor (dbclivend) não existe no PG.
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'faturamento2Vendedor',
  titulo: 'Faturamento do 2º Vendedor nos Grupos',
  descricao: 'Total faturado por cliente nos grupos de produto (dbvendgpp) e clientes da carteira (dbclivend) do vendedor escolhido.',
  filtros: [],
  colunas: [],
  pendente: 'Depende da tabela dbclivend (carteira de clientes do 2º vendedor), que ainda não existe no banco novo; sem ela não há como saber quais clientes são da carteira do vendedor. Os itens de fatura (dbprodfat) também só existem a partir de 08/2026.',
};
