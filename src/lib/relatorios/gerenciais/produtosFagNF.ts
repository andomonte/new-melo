import type { Relatorio } from '../tipos';

/**
 * Relatórios › Gerenciais › Produtos por FAG e NF (DI) (Delphi: FrmTot_Prod_Fag_NF / procedure
 * CONSULTA_TOT_PROD_POR_NF_FAG). Confronta, por produto, a quantidade faturada em FAG (tipofat 3)
 * com a quantidade em NF ligada a documento interno de DI (tipofat 1 ⋈ DBDOCINTERNO) — saldo e
 * valor do saldo a preço de compra. Fica pendente: DBDOCINTERNO não existe no PG e os itens de
 * fatura (dbprodfat) só têm o que o web emitiu (desde 08/2026; nenhum item de FAG).
 */
export const relatorio: Relatorio = {
  slug: 'produtosFagNF',
  titulo: 'Produtos por FAG e NF (DI)',
  descricao: 'Saldo por produto entre a quantidade faturada em FAG e a quantidade em notas fiscais ligadas a documento interno de DI, com o valor do saldo a preço de compra.',
  filtros: [],
  colunas: [],
  pendente: 'Indisponível: a tabela de documentos internos de DI (dbdocinterno) não existe no banco novo e os itens de fatura (dbprodfat) '
    + 'só têm as notas emitidas pelo sistema web (desde 08/2026, nenhuma FAG). Falta também definir o que é "NF de DI" no modelo novo de importação.',
};
