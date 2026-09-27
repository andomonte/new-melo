/**
 * Classificador de SAÍDAS do extrato para a conciliação de Contas a Pagar.
 *
 * Espelha o classificarLancamento (usado no Contas a Receber), mas ao contrário:
 * lá o foco é o CRÉDITO (recebimento de cliente); aqui o foco é o DÉBITO (pagamento
 * a fornecedor). Um débito vira 'pagamento' (candidato a casar com um título a pagar),
 * exceto quando é custo bancário/movimento interno (tarifa, IOF, transferência própria,
 * aplicação/resgate, estorno) → 'descarte'. Crédito nunca é pagamento → 'descarte'.
 */

export type CategoriaPagamento = 'pagamento' | 'descarte';

export interface ClassificacaoPagamento {
  tipo: string;
  categoria: CategoriaPagamento;
  motivo: string;
}

// Custos bancários / movimentos internos que NÃO são pagamento a fornecedor.
const RE_TARIFA = /TARIFA|\bIOF\b|CESTA|PACOTE\s+SERVICOS|MENSALIDADE|ANUIDADE/i;
const RE_TRANSF_PROPRIA = /TRANSFER[ÊE]NCIA ENTRE CONTAS|APLICA[ÇC][ÃA]O AUTOMATICA|CTA\s+INVEST|TRANSF\s+MESMA\s+TITULARIDADE|RESGATE|APLICA[ÇC][ÃA]O/i;
const RE_ESTORNO = /ESTORNO|CANCELAMENTO/i;

// Rótulos comuns de saída (só para dar um 'tipo' mais legível na tela).
const RE_PIX_ENVIADO = /PIX\s+ENVIADO|PIX\s+SAIDA|PIX\s+DEB/i;
const RE_TED_DOC = /\b(TED|DOC)\b/i;
const RE_BOLETO = /PAGAMENTO\s+(DE\s+)?BOLETO|LIQUIDA[ÇC][ÃA]O|\bBOLETO\b|PAG\.?\s*BOLETO|PAGAMENTO\s+CONTA/i;
const RE_DEBITO_AUTO = /DEBITO\s+AUT|D[ÉE]BITO\s+AUT/i;

export function classificarPagamento(historico: string, valorCentavos: number): ClassificacaoPagamento {
  const h = String(historico || '');

  // 1) Crédito (entrada) nunca é pagamento a fornecedor.
  if (valorCentavos >= 0) {
    return { tipo: 'entrada', categoria: 'descarte', motivo: 'Lançamento de entrada (crédito)' };
  }

  // 2) Saídas que são custo bancário / movimento interno → descarte.
  if (RE_TARIFA.test(h)) return { tipo: 'tarifa', categoria: 'descarte', motivo: 'Tarifa/IOF bancária' };
  if (RE_TRANSF_PROPRIA.test(h)) return { tipo: 'transferencia_propria', categoria: 'descarte', motivo: 'Transferência/aplicação própria' };
  if (RE_ESTORNO.test(h)) return { tipo: 'estorno', categoria: 'descarte', motivo: 'Estorno/cancelamento' };

  // 3) Demais saídas → pagamento (candidato a conciliar com título a pagar).
  if (RE_PIX_ENVIADO.test(h)) return { tipo: 'pix_enviado', categoria: 'pagamento', motivo: 'Pix enviado' };
  if (RE_BOLETO.test(h)) return { tipo: 'boleto', categoria: 'pagamento', motivo: 'Pagamento de boleto' };
  if (RE_TED_DOC.test(h)) return { tipo: 'ted_doc', categoria: 'pagamento', motivo: 'TED/DOC enviado' };
  if (RE_DEBITO_AUTO.test(h)) return { tipo: 'debito_auto', categoria: 'pagamento', motivo: 'Débito automático' };
  return { tipo: 'saida', categoria: 'pagamento', motivo: 'Saída (pagamento)' };
}
