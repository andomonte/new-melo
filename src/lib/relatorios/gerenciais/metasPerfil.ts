import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Metas de Venda por Perfil (Delphi: FrmPerfilGpp / package PERFIL_GPP).
 * PENDENTE: nenhuma tabela do módulo no PG e package PERFIL_GPP inválido no Oracle (tela já quebrada no Delphi).
 * Análise: docs/relatorios-delphi/analise_grupo_A.md.
 */
export const relatorio: Relatorio = {
  slug: 'metasPerfil',
  titulo: 'Metas de Venda por Perfil',
  descricao: 'Perfis (conjuntos de grupos de produto) por filial, equipe gerente → coordenador → vendedor, metas por grupo e desempenho realizado em 3, 6 e 12 meses comparado com a meta.',
  filtros: [],
  colunas: [],
  pendente: 'Nenhuma das tabelas do módulo existe no banco novo (dbperfil_gpp, dbperfil_gpp_det, dbperfil_gpp_metas, dbperfil_vendedor, dbperfil_gerente, dbperfil_coordenador, dbgerente_gpp, dbcoordenador_gpp, dbvendedor_gpp), e o package PERFIL_GPP está inválido no Oracle (falta a view VW_PERFIL_VENDA), ou seja, a tela já não funciona no Delphi. Confirmar com o negócio se ainda é usado antes de migrar.',
};
