/**
 * Cálculo de saldo de uma sessão de caixa — FUNÇÕES PURAS, testáveis isoladamente.
 * Ver docs/caixa/spec-abertura-fechamento-caixa-melo.md (seção 7).
 *
 * Regra: só DINHEIRO afeta a gaveta. Cartão/PIX/Cheque são conferidos por forma
 * (caixa_fechamento_forma) e NÃO entram no saldo esperado em dinheiro.
 */

export type TipoMovimento =
  | 'ABERTURA'
  | 'RECEBIMENTO'
  | 'SUPRIMENTO'
  | 'SANGRIA'
  | 'ESTORNO';

export type FormaPagamento =
  | 'DINHEIRO'
  | 'DEBITO'
  | 'CREDITO'
  | 'PIX'
  | 'CHEQUE'
  | 'OUTRO';

export type Sentido = 'ENTRADA' | 'SAIDA';

export interface MovimentoSaldo {
  tipo: TipoMovimento;
  forma_pagamento: FormaPagamento;
  /** sempre positivo; o sinal vem do sentido */
  valor: number;
  sentido: Sentido;
}

/**
 * Sentido padrão de cada tipo. ESTORNO é a exceção: o sinal depende do que se
 * está estornando, então quem grava informa o sentido explicitamente.
 */
export function sentidoPadrao(tipo: TipoMovimento): Sentido {
  switch (tipo) {
    case 'ABERTURA':
    case 'RECEBIMENTO':
    case 'SUPRIMENTO':
      return 'ENTRADA';
    case 'SANGRIA':
      return 'SAIDA';
    case 'ESTORNO':
      // caso genérico: estorno devolve/sai dinheiro; o chamador pode sobrepor
      return 'SAIDA';
    default:
      return 'ENTRADA';
  }
}

/** Arredonda para 2 casas (numeric(15,2)); evita ruído de ponto flutuante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Saldo esperado em dinheiro na gaveta:
 *   fundo_troco + Σ(DINHEIRO ENTRADA) − Σ(DINHEIRO SAIDA)
 * Só forma_pagamento = DINHEIRO entra no cálculo.
 */
export function calcularSaldoDinheiro(
  fundoTroco: number,
  movimentos: MovimentoSaldo[],
): number {
  let saldo = fundoTroco || 0;
  for (const m of movimentos) {
    if (m.forma_pagamento !== 'DINHEIRO') continue;
    // ABERTURA é o próprio fundo de troco (já é o ponto de partida) — não somar de novo
    if (m.tipo === 'ABERTURA') continue;
    if (m.sentido === 'ENTRADA') saldo += m.valor;
    else saldo -= m.valor;
  }
  return round2(saldo);
}

export interface TotalForma {
  forma_pagamento: FormaPagamento;
  entrada: number;
  saida: number;
  liquido: number;
}

/**
 * Totais líquidos por forma de pagamento (para conferência no fechamento).
 * O ABERTURA (fundo de troco) é ignorado aqui — ele é o ponto de partida do
 * dinheiro, não uma "receita" por forma.
 */
export function totaisPorForma(movimentos: MovimentoSaldo[]): TotalForma[] {
  const mapa = new Map<FormaPagamento, TotalForma>();
  for (const m of movimentos) {
    if (m.tipo === 'ABERTURA') continue;
    let t = mapa.get(m.forma_pagamento);
    if (!t) {
      t = { forma_pagamento: m.forma_pagamento, entrada: 0, saida: 0, liquido: 0 };
      mapa.set(m.forma_pagamento, t);
    }
    if (m.sentido === 'ENTRADA') t.entrada += m.valor;
    else t.saida += m.valor;
    t.liquido = round2(t.entrada - t.saida);
    t.entrada = round2(t.entrada);
    t.saida = round2(t.saida);
  }
  return Array.from(mapa.values());
}

/** quebra = informado − esperado (positivo = sobra, negativo = falta) */
export function calcularQuebra(informado: number, esperado: number): number {
  return round2((informado || 0) - (esperado || 0));
}
