// src/lib/boleto/febraban.ts
//
// Linha digitável + código de barras (padrão FEBRABAN, 44 dígitos) para os boletos
// da MELO — Bradesco (237) e Santander (033). Validado contra os modelos reais
// (BOLETO BRADESCO/SANTANDER MELO): reproduz a linha digitável exata.
//
// Estrutura do código de barras (44):
//   1-3 banco | 4 moeda(9) | 5 DV geral | 6-9 fator venc | 10-19 valor(10) | 20-44 campo livre(25)

/** Config FIXA de cobrança da MELO por banco (banco = código interno: 0=Bradesco, 5=Santander). */
export interface ConfigBancoBoleto {
  bancoFebraban: string; // '237' | '033'
  bancoNome: string; // 'Bradesco' | 'Banco Santander'
  bancoCodigoDisplay: string; // '237-2' | '033'
  agenciaCedenteDisplay: string; // '2368-0 / 0000338-7' | '1403 / 0009560'
  carteiraDisplay: string; // '09' | 'COBRANCA SIMPLES - RCR'
  localPagamento: string;
}

export const CONFIG_BOLETO: Record<string, ConfigBancoBoleto> = {
  '0': {
    bancoFebraban: '237',
    bancoNome: 'Bradesco',
    bancoCodigoDisplay: '237-2',
    agenciaCedenteDisplay: '2368-0 / 0000338-7',
    carteiraDisplay: '09',
    localPagamento:
      'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Bradesco.',
  },
  '5': {
    bancoFebraban: '033',
    bancoNome: 'Banco Santander',
    bancoCodigoDisplay: '033',
    agenciaCedenteDisplay: '1403 / 0009560',
    carteiraDisplay: 'COBRANCA SIMPLES - RCR',
    localPagamento:
      'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Banco Santander.',
  },
};

// Parâmetros internos do campo livre por banco (fixos MELO).
const BRADESCO = { agencia: '2368', carteira: '09', conta: '0000338' };
const SANTANDER = { codCedente: '0009560', modalidade: '101' };

const zeros = (v: string | number, n: number) => String(v).padStart(n, '0');

/** Fator de vencimento FEBRABAN — base 22/02/2025 = 1000 (reset de 2025). */
export function fatorVencimento(dtVenc: Date): string {
  const base = Date.UTC(2025, 1, 22); // 22/02/2025
  const venc = Date.UTC(dtVenc.getUTCFullYear(), dtVenc.getUTCMonth(), dtVenc.getUTCDate());
  const dias = Math.round((venc - base) / 86400000);
  return zeros(1000 + dias, 4);
}

/** Módulo 10 (DV dos campos da linha digitável). */
function modulo10(campo: string): number {
  let soma = 0;
  let mult = 2;
  for (let i = campo.length - 1; i >= 0; i--) {
    let p = Number(campo[i]) * mult;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    mult = mult === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/** Módulo 11 do código de barras (DV geral, posição 5). */
function modulo11Barras(campo43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = campo43.length - 1; i >= 0; i--) {
    soma += Number(campo43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Valor em centavos, 10 dígitos. */
function valor10(valor: number): string {
  return zeros(Math.round((Number(valor) || 0) * 100), 10);
}

/** Campo livre (25 díg.) por banco. nossoNumeroBase = dbreceb.nro_banco; dv = DV do nosso número. */
function campoLivre(banco: string, nossoNumeroBase: string, dv: string): string {
  if (banco === '0') {
    // Bradesco: agência(4) + carteira(2) + nossoNumero(11) + conta(7) + '0'
    return (
      zeros(BRADESCO.agencia, 4) +
      zeros(BRADESCO.carteira, 2) +
      zeros(nossoNumeroBase, 11) +
      zeros(BRADESCO.conta, 7) +
      '0'
    );
  }
  if (banco === '5') {
    // Santander: '9' + códCedente(7) + nossoNumero(13 = 12 díg + DV) + '0'(IOF) + modalidade(3)
    const nnComDv = zeros(Number(nossoNumeroBase), 12) + dv;
    return '9' + zeros(SANTANDER.codCedente, 7) + nnComDv + '0' + zeros(SANTANDER.modalidade, 3);
  }
  throw new Error(`Campo livre não implementado para o banco '${banco}'.`);
}

export interface BoletoFebraban {
  codigoBarras: string; // 44 dígitos
  linhaDigitavel: string; // formatada
}

/**
 * Monta código de barras + linha digitável FEBRABAN.
 * @param banco código interno ('0' Bradesco, '5' Santander)
 * @param nossoNumeroBase dbreceb.nro_banco (StrZero do banco)
 * @param dv DV do nosso número (digitoNossoNumero)
 */
export function gerarBoletoFebraban(
  banco: string,
  nossoNumeroBase: string,
  dv: string,
  valor: number,
  dtVenc: Date,
): BoletoFebraban {
  const cfg = CONFIG_BOLETO[banco];
  if (!cfg) throw new Error(`Banco '${banco}' não configurado para boleto.`);
  const fator = fatorVencimento(dtVenc);
  const val = valor10(valor);
  const livre = campoLivre(banco, nossoNumeroBase, dv);
  // 43 dígitos sem o DV geral: banco(3)+moeda(1)+fator(4)+valor(10)+livre(25)
  const semDv = cfg.bancoFebraban + '9' + fator + val + livre;
  const dvGeral = String(modulo11Barras(semDv));
  const codigoBarras = cfg.bancoFebraban + '9' + dvGeral + fator + val + livre;

  // Linha digitável (5 campos)
  const c1 = cfg.bancoFebraban + '9' + livre.substring(0, 5);
  const c2 = livre.substring(5, 15);
  const c3 = livre.substring(15, 25);
  const campo1 = c1 + modulo10(c1);
  const campo2 = c2 + modulo10(c2);
  const campo3 = c3 + modulo10(c3);
  const campo5 = fator + val;
  const linhaDigitavel =
    `${campo1.substring(0, 5)}.${campo1.substring(5)} ` +
    `${campo2.substring(0, 5)}.${campo2.substring(5)} ` +
    `${campo3.substring(0, 5)}.${campo3.substring(5)} ` +
    `${dvGeral} ${campo5}`;

  return { codigoBarras, linhaDigitavel };
}
