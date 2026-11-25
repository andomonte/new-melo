import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Acompanhamento de Vendas (Delphi: FrmMasterConsulta / package SUPER_MASTER:
 * CONSULTAR_REGIAO, CALCULA_VEND_TMP).
 * PENDENTE: cadastro "Super Master" não migrado; regiões com WHERE dinâmico gravado na tabela.
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'acompanhamentoVendas',
  titulo: 'Acompanhamento de Vendas',
  descricao: 'Painel gerencial: faturamento por região × grupo de faturamento × cliente, e objetivo × atingido por vendedor (com gerente e coordenador), normal × telemarketing.',
  filtros: [],
  colunas: [],
  pendente: 'Depende do cadastro "Super Master", que não existe no banco novo: dbregiao, dbregiao_gerente, dbgrupo_faturamento, dbgrupo_faturamento_segmento, dbcoordenador, dbgerente, dbvendedor_meta e dbvendedor_meta_marca. As regiões guardam um trecho de WHERE na própria tabela (dbregiao.conteudo), que precisa virar regra estruturada, e o modo Vendedor usa a regra de comissão COMISSAO.TotalTipoVenda2 (comissão suspensa).',
};
