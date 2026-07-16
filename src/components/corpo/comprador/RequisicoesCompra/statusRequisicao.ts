/**
 * Regra do Delphi (PEDIDO DE COMPRA/UNIREQ.pas, btnProd_SelecionarClick):
 *   //Nega acrescentar produtos ao pedido com INF = D, S e N
 * Produtos com esses status de informativo NÃO podem entrar na requisição.
 * Ver memória produto-status-ativo-inativo.
 */
export const INF_BLOQUEIA_REQUISICAO: Record<string, string> = {
  S: 'Não é possível incluir este produto ao pedido: produto com número substituído!',
  D: 'Não é possível incluir este produto ao pedido: produto desativado!',
  N: 'Não é possível incluir este produto ao pedido: produto sem giro!',
};

/** Rótulo curto do status, para compor a pergunta do substituto. */
export const INF_ROTULO: Record<string, string> = {
  S: 'substituído',
  D: 'desativado',
  N: 'sem giro',
};

/**
 * Se o produto não pode ser incluído na requisição pelo seu `inf`, devolve a
 * mensagem; senão devolve null.
 */
export function motivoBloqueioRequisicao(
  inf: string | null | undefined,
): string | null {
  const chave = String(inf ?? '').trim().toUpperCase();
  return INF_BLOQUEIA_REQUISICAO[chave] ?? null;
}

/** 'substituído' | 'desativado' | 'sem giro' | null */
export function rotuloStatus(inf: string | null | undefined): string | null {
  const chave = String(inf ?? '').trim().toUpperCase();
  return INF_ROTULO[chave] ?? null;
}
