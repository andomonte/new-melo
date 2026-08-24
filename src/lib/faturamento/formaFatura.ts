// src/lib/faturamento/formaFatura.ts
//
// FONTE ÚNICA da forma de faturamento (dbfatura.frmfat / dbreceb.forma_fat).
//
// O SysMelo/Oracle usa CÓDIGOS NUMÉRICOS (validado em all_source):
//   1 = RECIBO       (ANALISE_DET_BANCO:21, CRECEB_CONSULTA_DETALHE:16)
//   2 = BOLETO       (é o que tem tarifa R$7 no caixa — CONTASR:935)
//   3 = PROMISSÓRIA
//   4 = CARTEIRA     (pago só na MELO — PRETCOBRANCA.INFORMACAO_FINANCEIRA:176-178)
//   5 = CHEQUE       (nro_doc "CH..." — TOTVS:2566 `'5'→'CH '`)
//   6 = CARTÃO       (nro_doc "C000..." — CAIXA pkg; caixa/receber.ts já grava '6')
//
// A leitura do web (remessa CNAB filtra forma_fat='2'; caixa lê '2'/'6') e todos os
// dados históricos (milhões de linhas) usam esses NÚMEROS. Antes, a gravação do
// faturamento usava LETRAS ('B','C','W'...) — divergente, quebrava a remessa e dava
// "tipo de fatura CARTEIRA não é válido". Este módulo unifica tudo nos números.

/** Código numérico canônico da forma de faturamento (1 char). */
export type CodigoFormaFatura = '1' | '2' | '3' | '4' | '5' | '6';

/** Rótulo amigável por código. */
export const LABEL_FORMA_FATURA: Record<CodigoFormaFatura, string> = {
  '1': 'RECIBO',
  '2': 'BOLETO',
  '3': 'PROMISSÓRIA',
  '4': 'CARTEIRA',
  '5': 'CHEQUE',
  '6': 'CARTÃO',
};

// Descrição (ou apelido) → código numérico do Oracle.
const MAPA_DESCRICAO: { [k: string]: CodigoFormaFatura } = {
  RECIBO: '1',
  BOLETO: '2',
  'BOLETO BANCARIO': '2',
  'BOLETO BANCÁRIO': '2',
  DUPLICATA: '2', // duplicata mercantil é cobrada como boleto (Oracle não tem código próprio)
  'DUPLICATA MERCANTIL': '2',
  DM: '2',
  PROMISSORIA: '3',
  'PROMISSÓRIA': '3',
  CARTEIRA: '4',
  CHEQUE: '5',
  CARTAO: '6',
  'CARTÃO': '6',
  'CARTAO DE CREDITO': '6',
  'CARTÃO DE CRÉDITO': '6',
  'CARTAO DE DEBITO': '6',
  'CARTÃO DE DÉBITO': '6',
  // À vista / sem título bancário — não têm código de faturamento no Oracle; tratados
  // como RECIBO (título à vista). Se o negócio exigir outro, ajustar aqui (fonte única).
  PIX: '1',
  DINHEIRO: '1',
  'DEPOSITO': '1',
  'DEPÓSITO': '1',
  OUTROS: '1',
  OUTRO: '1',
  CONTRATO: '1',
};

// Apelidos de LETRA legada do web → número (para migrar dados/telas antigas).
const MAPA_LETRA_LEGADA: { [k: string]: CodigoFormaFatura } = {
  B: '2', // boleto
  D: '2', // duplicata → boleto
  P: '1', // pix → recibo
  $: '1', // dinheiro → recibo
  C: '4', // carteira (ContasAReceber usava 'C')
  W: '4', // carteira (dbtipo_documento/FaturamentoNota usavam 'W')
  V: '6', // cartão débito
};

/**
 * Normaliza qualquer entrada (descrição, número já correto, ou letra legada) para o
 * código numérico canônico. Retorna null se não reconhecer (o chamador decide o erro).
 */
export function codigoFormaFatura(entrada: string | number | null | undefined): CodigoFormaFatura | null {
  if (entrada === null || entrada === undefined) return null;
  const bruto = String(entrada).trim();
  if (bruto === '') return null;

  // Já é um número canônico 1..6.
  if ((['1', '2', '3', '4', '5', '6'] as string[]).includes(bruto)) {
    return bruto as CodigoFormaFatura;
  }
  // Descrição (case/acento-insensível ao que está no mapa: comparamos em maiúsculas).
  const up = bruto.toUpperCase();
  if (MAPA_DESCRICAO[up]) return MAPA_DESCRICAO[up];
  // Letra legada do web.
  if (MAPA_LETRA_LEGADA[up]) return MAPA_LETRA_LEGADA[up];
  return null;
}

/** Rótulo a partir de qualquer entrada (número, descrição ou letra legada). */
export function labelFormaFatura(entrada: string | number | null | undefined): string {
  const cod = codigoFormaFatura(entrada);
  return cod ? LABEL_FORMA_FATURA[cod] : (entrada ? String(entrada) : '-');
}

/** Opções para <select> de forma de faturamento (value = número canônico). */
export const OPCOES_FORMA_FATURA: { value: CodigoFormaFatura; label: string }[] = [
  { value: '2', label: 'BOLETO' },
  { value: '4', label: 'CARTEIRA' },
  { value: '3', label: 'PROMISSÓRIA' },
  { value: '1', label: 'RECIBO' },
  { value: '5', label: 'CHEQUE' },
  { value: '6', label: 'CARTÃO' },
];
