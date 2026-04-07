/**
 * Funções para calcular dígito verificador de nosso número
 * Baseado no PACKAGE REMESSA_BOLETO do Oracle
 * 
 * Suporta 8 bancos:
 * - 0: Bradesco (237)
 * - 1: Banco do Brasil (001)
 * - 2: Itaú (341)
 * - 3: Rural (453)
 * - 5: Santander (033)
 * - 6: Safra (422)
 * - 7: Citibank (745)
 * - 8: Caixa (104)
 */

/**
 * BRADESCO - Módulo 11 base 2-7
 * Carteira: 09
 */
export function digitoBradesco(nossoNumero: string): string {
  const numero = nossoNumero.padStart(11, '0');
  let soma = 0;
  let multiplicador = 2;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = soma % 11;
  const digito = resto === 0 || resto === 1 ? 0 : 11 - resto;

  return digito.toString();
}

/**
 * BANCO DO BRASIL - Módulo 11 base 9-1
 * Retorna 'X' se resto = 10
 * Carteira: 17
 */
export function digitoBancoDoBrasil(nossoNumero: string): string {
  const numero = nossoNumero.padStart(11, '0');
  let soma = 0;
  let multiplicador = 9;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 1 ? 9 : multiplicador - 1;
  }

  const resto = soma % 11;
  
  if (resto === 10) return 'X';
  if (resto === 0 || resto === 1) return '0';
  
  return (11 - resto).toString();
}

/**
 * ITAÚ - Módulo 10 base 1-2 alternado
 * Carteira: 109
 */
export function digitoItau(agencia: string, conta: string, carteira: string, nossoNumero: string): string {
  // Formato: AGENCIA + CONTA + CARTEIRA + NOSSONUMERO
  const numero = `${agencia.padStart(4, '0')}${conta.padStart(5, '0')}${carteira.padStart(3, '0')}${nossoNumero.padStart(8, '0')}`;
  
  let soma = 0;
  let multiplicador = 1;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    let produto = parseInt(numero[i]) * multiplicador;
    
    // Se produto > 9, soma os dígitos
    if (produto > 9) {
      produto = Math.floor(produto / 10) + (produto % 10);
    }
    
    soma += produto;
    multiplicador = multiplicador === 1 ? 2 : 1;
  }

  const resto = soma % 10;
  const digito = resto === 0 ? 0 : 10 - resto;

  return digito.toString();
}

/**
 * RURAL - Fórmula customizada
 * Carteira: 1
 */
export function digitoRural(agencia: string, tipoConta: string, nroConta: string, dacConta: string): string {
  const ag = parseInt(agencia) || 0;
  const tc = parseInt(tipoConta) || 0;
  const nc = parseInt(nroConta) || 0;
  const dac = parseInt(dacConta) || 0;

  // Fórmula: (AG + TC + NC + DAC) % 9
  const soma = ag + tc + nc + dac;
  const digito = soma % 9;

  return digito.toString();
}

/**
 * SANTANDER - Módulo 11 base 8-1
 * Carteira: 5
 */
export function digitoSantander(nossoNumero: string): string {
  const numero = nossoNumero.padStart(13, '0');
  let soma = 0;
  let multiplicador = 8;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 1 ? 8 : multiplicador - 1;
  }

  const resto = soma % 11;
  
  if (resto === 0 || resto === 1) return '0';
  
  return (11 - resto).toString();
}

/**
 * SAFRA - Módulo 11 base 9-1
 * Carteira: 2
 */
export function digitoSafra(nossoNumero: string): string {
  const numero = nossoNumero.padStart(8, '0');
  let soma = 0;
  let multiplicador = 9;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 1 ? 9 : multiplicador - 1;
  }

  const resto = soma % 11;
  
  if (resto === 0 || resto === 1) return '0';
  
  return (11 - resto).toString();
}

/**
 * CITIBANK - Módulo 11 base 2-9
 * Carteira: 2
 */
export function digitoCitibank(nossoNumero: string): string {
  const numero = nossoNumero.padStart(11, '0');
  let soma = 0;
  let multiplicador = 2;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
  }

  const resto = soma % 11;
  
  if (resto === 0 || resto === 1) return '0';
  
  return (11 - resto).toString();
}

/**
 * CAIXA - Módulo 11 base 2-9
 * Carteira: 12
 */
export function digitoCaixa(nossoNumero: string): string {
  const numero = nossoNumero.padStart(15, '0');
  let soma = 0;
  let multiplicador = 2;

  // Percorre da direita para esquerda
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
  }

  const resto = soma % 11;
  
  if (resto === 0 || resto === 1) return '0';
  
  return (11 - resto).toString();
}

/**
 * Função principal que seleciona o algoritmo correto por banco
 */
export function calcularDigitoDocumento(
  codigoBanco: string,
  nossoNumero: string,
  agencia?: string,
  conta?: string,
  carteira?: string,
  tipoConta?: string,
  dacConta?: string
): string {
  switch (codigoBanco) {
    case '0': // Bradesco
    case '237':
      return digitoBradesco(nossoNumero);

    case '1': // Banco do Brasil
    case '001':
      return digitoBancoDoBrasil(nossoNumero);

    case '2': // Itaú
    case '341':
      if (!agencia || !conta || !carteira) {
        throw new Error('Itaú requer agência, conta e carteira');
      }
      return digitoItau(agencia, conta, carteira, nossoNumero);

    case '3': // Rural
    case '453':
      if (!agencia || !tipoConta || !conta || !dacConta) {
        throw new Error('Rural requer agência, tipoConta, conta e dacConta');
      }
      return digitoRural(agencia, tipoConta, conta, dacConta);

    case '5': // Santander
    case '033':
      return digitoSantander(nossoNumero);

    case '6': // Safra
    case '422':
      return digitoSafra(nossoNumero);

    case '7': // Citibank
    case '745':
      return digitoCitibank(nossoNumero);

    case '8': // Caixa
    case '104':
      return digitoCaixa(nossoNumero);

    default:
      throw new Error(`Banco ${codigoBanco} não suportado`);
  }
}

/**
 * Gera o nosso número completo com dígito verificador
 */
export function gerarNossoNumeroCompleto(
  codigoBanco: string,
  nossoNumeroBase: string,
  agencia?: string,
  conta?: string,
  carteira?: string,
  tipoConta?: string,
  dacConta?: string
): string {
  const digito = calcularDigitoDocumento(
    codigoBanco,
    nossoNumeroBase,
    agencia,
    conta,
    carteira,
    tipoConta,
    dacConta
  );

  return `${nossoNumeroBase}${digito}`;
}

/**
 * Retorna informações sobre convênio do Banco do Brasil
 * Após DTCONVENIO_UNIFICADO (21/05/2012): convênio unificado
 */
export function getConvenioBB(dataEmissao: Date): { convenio: string; variacao: string } {
  const dataUnificacao = new Date('2012-05-21');
  
  if (dataEmissao >= dataUnificacao) {
    return {
      convenio: '2552433',
      variacao: '167'
    };
  }

  // Antes da unificação, deveria buscar em DBCONVENIOBB
  // Por ora, retornamos o padrão
  return {
    convenio: '2552433',
    variacao: '167'
  };
}

/**
 * Mapa de carteiras por banco
 */
export const CARTEIRAS_POR_BANCO: Record<string, string> = {
  '0': '009',      // Bradesco
  '237': '009',
  '1': '17',       // Banco do Brasil
  '001': '17',
  '2': '109',      // Itaú
  '341': '109',
  '3': '1',        // Rural
  '453': '1',
  '5': '5',        // Santander
  '033': '5',
  '6': '2',        // Safra
  '422': '2',
  '7': '2',        // Citibank
  '745': '2',
  '8': '12',       // Caixa
  '104': '12'
};

/**
 * Mapa de códigos de empresa (cedente) por banco
 */
export const CODIGO_EMPRESA_POR_BANCO: Record<string, string> = {
  '0': '18053139000169',      // Bradesco
  '237': '18053139000169',
  '1': '2552433',              // Banco do Brasil (convênio)
  '001': '2552433',
  '2': '18053139000169',       // Itaú
  '341': '18053139000169',
  '5': '18053139000169',       // Santander
  '033': '18053139000169',
  '6': '18053139000169',       // Safra
  '422': '18053139000169',
  '7': '18053139000169',       // Citibank
  '745': '18053139000169',
  '8': '18053139000169',       // Caixa
  '104': '18053139000169'
};
