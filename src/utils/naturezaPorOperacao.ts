// src/utils/naturezaPorOperacao.ts
// Natureza da Operação (natOp, cabeçalho da NF-e) DERIVADA DA OPERAÇÃO (tipo_operacao),
// NÃO do CFOP dos itens. O CFOP continua por item (dbitvenda/dbprodfat).
// Gravada em dbfatura.descrcfop; usada no XML e no DANFE (mesmo valor).
//
// Mapa aprovado pelo negócio. Origem de cada string:
//  [Delphi] = string EXATA do UniFrmFaturamentoUnificado.pas (RdgTipo_Operacoes_cfop_*Click):
//     REMESSA_GARANTIA_*        → 'REMESSA DE PEÇAS EM GARANTIA'      (pas:2246)
//     SIMPLES_REMESSA           → 'SIMPLES REMESSA'                   (pas:2248)
//     EXTRAVIO_AVARIA_*         → 'EXTRAVIO E AVARIA'                 (pas:2232)
//     RETORNO_REMESSA_GARANTIA  → 'RETORNO DE REMESSA EM GARANTIA'    (pas:2250)
//     RETORNO_REMESSA_CONSERTO  → 'RETORNO DE REMESSA EM CONSERTO'    (pas:2252)
//     RETORNO_GARANTIA_* (entr) → 'RETORNO DE PEÇAS EM GARANTIA'      (pas:2972)
//  [negócio] = definido/aprovado pelo cliente (Delphi deixava vazio → descrição do CFOP).

export const NATUREZA_POR_OPERACAO: Record<string, string> = {
  // ---- SAÍDA ----
  VENDA: 'VENDA DE MERCADORIAS', // [negócio]
  TRANSFERENCIA: 'TRANSFERÊNCIA DE MERCADORIAS', // [negócio]
  DEVOLUCAO_COMPRA: 'DEVOLUÇÃO DE COMPRA', // [negócio]
  DEVOLUCAO_TRANSFERENCIA: 'DEVOLUÇÃO DE TRANSFERÊNCIA', // [negócio]
  REMESSA_BONIFICACAO: 'REMESSA EM BONIFICAÇÃO, DOAÇÃO OU BRINDE', // [negócio]
  REMESSA_EXPOSICAO: 'REMESSA PARA EXPOSIÇÃO OU FEIRA', // [negócio]
  REMESSA_DEMOSTRACAO: 'REMESSA PARA DEMONSTRAÇÃO', // [negócio]
  REMESSA_ARMAZEM: 'REMESSA PARA ARMAZÉM GERAL', // [negócio]
  REMESSA_GARANTIA_FABRICA: 'REMESSA DE PEÇAS EM GARANTIA', // [Delphi]
  REMESSA_CONSERTO: 'REMESSA PARA CONSERTO OU REPARO', // [negócio]
  SIMPLES_REMESSA: 'SIMPLES REMESSA', // [Delphi]
  REMESSA_GARANTIA_CLIENTE: 'REMESSA DE PEÇAS EM GARANTIA', // [Delphi]
  EXTRAVIO_AVARIA_FABRICA: 'EXTRAVIO E AVARIA', // [Delphi]
  EXTRAVIO_AVARIA_CLIENTE: 'EXTRAVIO E AVARIA', // [Delphi]
  RETORNO_REMESSA_GARANTIA: 'RETORNO DE REMESSA EM GARANTIA', // [Delphi]
  RETORNO_REMESSA_CONSERTO: 'RETORNO DE REMESSA EM CONSERTO', // [Delphi]
  // ---- ENTRADA ----
  COMPRA: 'COMPRA DE MERCADORIAS', // [negócio]
  DEVOLUCAO_VENDA: 'DEVOLUÇÃO DE VENDA', // [negócio]
  ENTRADA_BONIFICACAO: 'ENTRADA EM BONIFICAÇÃO, DOAÇÃO OU BRINDE', // [negócio]
  RETORNO_EXPOSICAO: 'RETORNO DE EXPOSIÇÃO OU FEIRA', // [negócio]
  ENTRADA_DEMOSTRACAO: 'ENTRADA PARA DEMONSTRAÇÃO', // [negócio] (enum: ENTRADA_DEMOSTRACAO)
  ENTRADA_ARMAZEM: 'ENTRADA DE ARMAZÉM GERAL', // [negócio]
  RETORNO_GARANTIA_CLIENTE: 'RETORNO DE PEÇAS EM GARANTIA', // [Delphi]
  RETORNO_GARANTIA_FABRICA: 'RETORNO DE PEÇAS EM GARANTIA', // [Delphi]
  RETORNO_CONSERTO: 'RETORNO DE CONSERTO OU REPARO', // [negócio]
};

/**
 * Retorna a natureza do cabeçalho para a operação.
 * - 'OUTROS' (Escolher Outros) → usa a natureza informada manualmente.
 * - operação sem mapa → usa a natureza manual, senão 'VENDA DE MERCADORIAS'.
 */
export function naturezaPorOperacao(
  tipoOperacao?: string,
  naturezaManual?: string,
): string {
  const op = String(tipoOperacao ?? '').toUpperCase().trim();
  const manual = String(naturezaManual ?? '').trim();
  if (op === 'OUTROS') return manual || 'VENDA DE MERCADORIAS';
  return NATUREZA_POR_OPERACAO[op] || manual || 'VENDA DE MERCADORIAS';
}
