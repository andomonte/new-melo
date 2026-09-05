import type { LinhaExtrato } from './parseCsv';

/**
 * Classificador de lançamentos do extrato (spec de conciliação).
 * Antes de conciliar qualquer coisa: separar o que é RECEBIMENTO de cliente do que deve
 * ser DESCARTADO (tarifa, IOF, débito automático, transferência própria, aplicação/resgate,
 * estorno, rendimento). O que sobra (positivo, sem tipo claro) fica 'a_identificar'.
 */

// 'boleto' = liquidação de cobrança/boleto: é recebimento, MAS identificado pelo banco
// (retorno CNAB / tela de baixa de boletos) — NÃO entra na conciliação manual de dar baixa.
export type CategoriaLancamento = 'recebimento' | 'boleto' | 'descarte' | 'a_identificar';

export interface Classificacao {
  tipo: string;
  categoria: CategoriaLancamento;
  motivo: string;
}

// Palavras que marcam SAÍDA/DESCARTE mesmo em crédito (rendimento, estorno, etc.).
const RE_RENDIMENTO = /RENDIMENTO|CONTAMAX|APLICA[ÇC][ÃA]O|RESGATE/i;
const RE_ESTORNO = /ESTORNO|DEVOLU[ÇC][ÃA]O DE|CANCELAMENTO/i;
const RE_TARIFA = /TARIFA|IOF|CESTA|PACOTE SERVICOS|MENSALIDADE/i;
const RE_DEBITO_AUTO = /DEBITO AUT|DÉBITO AUT|ENERGIA ELETRICA|CONTA DE AGUA|CONTA CELULAR|RECARGA|PAGAMENTO CONTA|PAGAMENTO DE BOLETO|PAGAMENTO CELULAR/i;
const RE_TRANSF_PROPRIA = /TRANSFER[ÊE]NCIA ENTRE CONTAS|APLICACAO AUTOMATICA|CTA INVEST|TRANSF MESMA TITULARIDADE/i;

// Entradas de cliente.
const RE_PIX_RECEBIDO = /PIX\s+RECEBIDO/i;
const RE_PIX_ENVIADO = /PIX\s+ENVIADO/i;
const RE_TED_DOC = /\b(TED|DOC)\b/i;
const RE_DEPOSITO = /DEP[ÓO]SITO/i;
// Liquidação de boleto/cobrança recebida (crédito) → categoria 'boleto' (baixa na tela de boletos).
const RE_BOLETO = /LIQUIDA[ÇC][ÃA]O|COBRAN[ÇC]A|\bBOLETO\b|TIT(ULO)?\.?\s*(COBR|DESC|VINC)|LIQ\.?\s*COBR/i;

export function classificarLancamento(historico: string, valorCentavos: number): Classificacao {
  const h = String(historico || '');

  // 1) Saídas (débito) nunca são recebimento de cliente.
  if (valorCentavos < 0) {
    if (RE_PIX_ENVIADO.test(h)) return { tipo: 'pix_enviado', categoria: 'descarte', motivo: 'Pix enviado (saída)' };
    if (RE_TARIFA.test(h)) return { tipo: 'tarifa', categoria: 'descarte', motivo: 'Tarifa bancária' };
    if (RE_DEBITO_AUTO.test(h)) return { tipo: 'debito_auto', categoria: 'descarte', motivo: 'Débito automático / pagamento' };
    if (RE_ESTORNO.test(h)) return { tipo: 'estorno', categoria: 'descarte', motivo: 'Estorno' };
    return { tipo: 'saida', categoria: 'descarte', motivo: 'Lançamento de saída (débito)' };
  }

  // 2) Créditos que NÃO são recebimento de cliente.
  if (RE_RENDIMENTO.test(h)) return { tipo: 'rendimento', categoria: 'descarte', motivo: 'Rendimento/aplicação (não é cliente)' };
  if (RE_ESTORNO.test(h)) return { tipo: 'estorno', categoria: 'descarte', motivo: 'Estorno bancário' };
  if (RE_TRANSF_PROPRIA.test(h)) return { tipo: 'transferencia_propria', categoria: 'descarte', motivo: 'Transferência entre contas próprias' };
  if (RE_TARIFA.test(h)) return { tipo: 'tarifa', categoria: 'descarte', motivo: 'Ajuste de tarifa (crédito)' };

  // 3) BOLETO (liquidação de cobrança) — recebimento IDENTIFICADO pelo banco: NÃO entra na baixa
  //    manual; é baixado na tela de boletos (retorno CNAB). Fica fora da lista de conciliação.
  if (RE_BOLETO.test(h)) return { tipo: 'boleto', categoria: 'boleto', motivo: 'Liquidação de boleto/cobrança (baixa na tela de boletos)' };

  // 4) Recebimentos de cliente para conciliação MANUAL (Pix/TED/DOC/depósito avulso).
  if (RE_PIX_RECEBIDO.test(h)) return { tipo: 'pix_recebido', categoria: 'recebimento', motivo: 'PIX recebido' };
  if (RE_TED_DOC.test(h)) return { tipo: 'ted_doc', categoria: 'recebimento', motivo: 'TED/DOC recebido' };
  if (RE_DEPOSITO.test(h)) return { tipo: 'deposito', categoria: 'recebimento', motivo: 'Depósito' };

  // 4) Crédito positivo sem tipo reconhecido → precisa identificar.
  return { tipo: 'outro_credito', categoria: 'a_identificar', motivo: 'Crédito sem origem reconhecida' };
}

/** Classifica todas as linhas de um extrato já parseado. */
export function classificarExtrato(linhas: LinhaExtrato[]) {
  return linhas.map((l) => ({ ...l, classificacao: classificarLancamento(l.historico, l.valorCentavos) }));
}
