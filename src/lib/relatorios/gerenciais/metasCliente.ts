import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Metas de Venda por Cliente (Delphi: UnitFrmMetasClientes / PERFIL_GPP.ACOMPANHAMENTO_MENSAL).
 * PENDENTE: tabelas de campanha não migradas, package PERFIL_GPP inválido e campanha parada desde 2015.
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'metasCliente',
  titulo: 'Metas de Venda por Cliente',
  descricao: 'Campanhas de fidelização por segmento: clientes do segmento, meta em R$ por linha, lote promocional e acompanhamento mensal (valor bruto, devolução, líquido, meta e pontos).',
  filtros: [],
  colunas: [],
  pendente: 'Nenhuma das tabelas da campanha existe no banco novo (dbcampseg_2014, dbcampconf_2014, dbmetascampconf_2014, dbcliente_fideliza, dblote_promocional, dbcfop_saida), o package PERFIL_GPP está inválido no Oracle e a última campanha terminou em 10/01/2015. Candidato a não migrar (confirmar com o negócio).',
};
