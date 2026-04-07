/**
 * Biblioteca de Cálculos para Geração de Boletos Bancários
 * Baseado no sistema legado em Delphi (unitBoletoGrupo.pas e UniRelVendas.pas)
 * 
 * Suporta:
 * - Bradesco (código 0 ou 237)
 * - Banco do Brasil (código 1 ou 001)
 * - Itaú (código 2 ou 341)
 */

// ============================================================================
// CONSTANTES
// ============================================================================

const DATA_BASE_BOLETO = new Date('1997-10-07'); // Data base para cálculo do fator de vencimento

export const CODIGO_BANCO = {
  BRADESCO: '237',
  BANCO_BRASIL: '001',
  ITAU: '341',
} as const;

export const BANCO_LEGACY = {
  '0': CODIGO_BANCO.BRADESCO,
  '1': CODIGO_BANCO.BANCO_BRASIL,
  '2': CODIGO_BANCO.ITAU,
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface DadosBoleto {
  // Dados da conta bancária
  banco: '0' | '1' | '2'; // 0=Bradesco, 1=Banco do Brasil, 2=Itaú
  nroConta: string;
  agencia: string;
  convenio?: string; // Para Banco do Brasil
  carteira?: string;
  
  // Dados do documento
  codReceb: string; // Código do recebível (11 dígitos)
  nroDoc: string; // Número do documento
  nroDocBanco: string; // Número do documento no banco
  
  // Valores e datas
  valor: number;
  dtEmissao: Date;
  dtVencimento: Date;
  juros?: number; // Percentual de juros (ex: 0.02 para 2%)
  multa?: number; // Percentual de multa (ex: 0.02 para 2%)
  
  // Dados do sacado (cliente)
  nomeCli: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  cpfCnpj?: string;
  
  // Dados do cedente (empresa)
  nomeCedente?: string;
  enderecoCedente?: string;
  
  // Informações adicionais
  instrucoes?: string[];
  descricao?: string;
}

export interface BoletoGerado {
  // Linha digitável formatada
  linhaDigitavel: string;
  
  // Código de barras (44 dígitos)
  codigoBarras: string;
  
  // Nosso número formatado
  nossoNumero: string;
  
  // Fator de vencimento
  fatorVencimento: string;
  
  // Campos separados para exibição
  campo1: string;
  campo2: string;
  campo3: string;
  campo4: string; // Dígito verificador
  campo5: string; // Fator + Valor
  
  // Valores calculados
  valorMora: number;
  
  // Informações originais
  dadosOriginais: DadosBoleto;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Repete um caractere N vezes
 */
function repetir(char: string, count: number): string {
  return char.repeat(count);
}

/**
 * Remove caracteres não numéricos
 */
function apenasNumeros(str: string): string {
  return str.replace(/\D/g, '');
}

/**
 * Completa string com zeros à esquerda
 */
function completarZeros(str: string | number, tamanho: number): string {
  return String(str).padStart(tamanho, '0');
}

/**
 * Formata valor monetário removendo pontos e vírgulas
 * Exemplo: 1500.00 -> "0000150000"
 */
function formatarValor(valor: number): string {
  const valorCentavos = Math.round(valor * 100);
  return completarZeros(valorCentavos, 10);
}

/**
 * Calcula diferença em dias entre duas datas
 */
function diferencaDias(dataFutura: Date, dataBase: Date): number {
  const diff = dataFutura.getTime() - dataBase.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ============================================================================
// CÁLCULO DE DÍGITOS VERIFICADORES
// ============================================================================

/**
 * Módulo 10 - Usado para dígitos verificadores dos campos da linha digitável
 * Baseado em: UniRelVendas.pas (linhas 1470-1490)
 */
function modulo10(campo: string): number {
  let soma = 0;
  let multiplicador = 2;
  
  // Percorre da direita para esquerda
  for (let i = campo.length - 1; i >= 0; i--) {
    let digito = parseInt(campo[i]);
    let resultado = digito * multiplicador;
    
    // Se resultado > 9, soma os dígitos
    if (resultado > 9) {
      resultado = Math.floor(resultado / 10) + (resultado % 10);
    }
    
    soma += resultado;
    
    // Alterna entre 2 e 1
    multiplicador = multiplicador === 2 ? 1 : 2;
  }
  
  // Calcula o dígito
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/**
 * Módulo 11 - Usado para dígito verificador do código de barras
 * Baseado em: UniRelVendas.pas (linhas 1574-1589)
 */
function modulo11CodigoBarras(campo: string): number {
  let soma = 0;
  let multiplicador = 2;
  
  // Percorre da direita para esquerda
  for (let i = campo.length - 1; i >= 0; i--) {
    soma += parseInt(campo[i]) * multiplicador;
    multiplicador++;
    
    // Multiplicador varia de 2 a 9
    if (multiplicador > 9) {
      multiplicador = 2;
    }
  }
  
  const resto = soma % 11;
  let digito = 11 - resto;
  
  // Regra especial: 0, 10 ou 11 vira 1
  if (digito === 0 || digito === 10 || digito === 11 || digito > 9) {
    digito = 1;
  }
  
  return digito;
}

/**
 * Gera dígito verificador do Nosso Número (Bradesco)
 * Baseado em: UniRelVendas.pas função GeraDigito_NossoNro (linhas 2436-2455)
 */
function gerarDigitoNossoNumeroBradesco(nossoNumero: string): string {
  let soma = 0;
  let multiplicador = 2;
  
  // Percorre da direita para esquerda
  for (let i = nossoNumero.length - 1; i >= 0; i--) {
    soma += parseInt(nossoNumero[i]) * multiplicador;
    multiplicador++;
    
    // Multiplicador varia de 2 a 7
    if (multiplicador > 7) {
      multiplicador = 2;
    }
  }
  
  soma += 63; // Constante mágica do Bradesco
  const resto = soma % 11;
  
  // Regras especiais
  if (resto === 0) return '0';
  if (resto === 1) return 'P';
  
  return String(11 - resto);
}

/**
 * Gera dígito verificador do Nosso Número (Banco do Brasil)
 * Baseado em: UniRelVendas.pas função GeraDigito_NossoNroBB (linhas 2416-2434)
 */
function gerarDigitoNossoNumeroBB(nossoNumero: string): string {
  let soma = 0;
  let multiplicador = 9;
  
  // Percorre da esquerda para direita
  for (let i = 0; i < nossoNumero.length; i++) {
    soma += parseInt(nossoNumero[i]) * multiplicador;
    multiplicador--;
    
    // Multiplicador varia de 9 a 2
    if (multiplicador < 2) {
      multiplicador = 9;
    }
  }
  
  const resto = soma % 11;
  
  if (resto === 10) return 'X';
  
  return String(resto);
}

// ============================================================================
// GERAÇÃO DE CAMPO LIVRE
// ============================================================================

/**
 * Gera campo livre para Bradesco (25 dígitos)
 * Baseado em: UniRelVendas.pas (linhas 1560-1562)
 */
function gerarCampoLivreBradesco(dados: DadosBoleto): string {
  const nroConta = apenasNumeros(dados.nroConta);
  const tam = nroConta.length;
  
  // Estrutura: 236809 + nroDocBanco (11) + zeros (7) + dígito conta + 0
  return '236809' + 
         completarZeros(dados.nroDocBanco, 11) + 
         repetir('0', 7 - (tam - 1)) + 
         nroConta.slice(0, tam - 1) + 
         '0';
}

/**
 * Gera campo livre para Banco do Brasil (25 dígitos)
 * Formato para convênio de 6 dígitos:
 * - Posições 1-6: Convênio
 * - Posições 7-11: Nosso Número  
 * - Posições 12-12: Tipo de Carteira
 * - Posições 13-25: Restante do nosso número
 */
function gerarCampoLivreBB(dados: DadosBoleto): string {
  const convenio = (dados.convenio || '000000').padStart(7, '0').substring(0, 7);
  const nossoNumero = dados.nroDocBanco.padStart(17, '0');
  const carteira = (dados.carteira || '17').padStart(2, '0');
  
  // Campo livre BB: convênio(7) + nosso número(10) + carteira(2) + restante nosso número(7) 
  return convenio + 
         nossoNumero.substring(0, 10) + 
         carteira.substring(0, 2) + 
         nossoNumero.substring(10, 17);
}

/**
 * Gera campo livre para Itaú (25 dígitos)
 */
function gerarCampoLivreItau(dados: DadosBoleto): string {
  const carteira = dados.carteira || '109';
  const nossoNumero = completarZeros(dados.nroDocBanco, 8);
  const agencia = completarZeros(dados.agencia, 4);
  const conta = completarZeros(apenasNumeros(dados.nroConta), 5);
  
  // Estrutura: carteira (3) + nosso número (8) + DAC + agencia (4) + conta (5) + DAC + zeros
  const dac = '0'; // Simplificado
  
  return carteira + 
         nossoNumero + 
         dac + 
         agencia + 
         conta + 
         dac + 
         '000';
}

// ============================================================================
// GERAÇÃO DE CÓDIGO DE BARRAS E LINHA DIGITÁVEL
// ============================================================================

/**
 * Gera código de barras completo (44 dígitos)
 * Baseado em: UniRelVendas.pas (linhas 1574-1650)
 */
export function gerarCodigoBarras(dados: DadosBoleto): {
  codigoBarras: string;
  campoLivre: string;
  fatorVencimento: string;
  valorFormatado: string;
} {
  // 1. Determinar código do banco
  const codigoBanco = BANCO_LEGACY[dados.banco];
  const codigoBancoPadrao = codigoBanco === CODIGO_BANCO.BRADESCO ? '237' : 
                             codigoBanco === CODIGO_BANCO.BANCO_BRASIL ? '001' : '341';
  
  // 2. Calcular fator de vencimento
  const fator = diferencaDias(dados.dtVencimento, DATA_BASE_BOLETO);
  const fatorVencimento = completarZeros(fator, 4);
  
  // 3. Formatar valor
  const valorFormatado = formatarValor(dados.valor);
  
  // 4. Gerar campo livre específico do banco
  let campoLivre: string;
  
  switch (dados.banco) {
    case '0': // Bradesco
      campoLivre = gerarCampoLivreBradesco(dados);
      break;
    case '1': // Banco do Brasil
      campoLivre = gerarCampoLivreBB(dados);
      break;
    case '2': // Itaú
      campoLivre = gerarCampoLivreItau(dados);
      break;
    default:
      throw new Error(`Banco não suportado: ${dados.banco}`);
  }
  
  // 5. Montar código sem o dígito verificador (posições 1-4, 6-44)
  const codigoSemDV = codigoBancoPadrao.slice(0, 3) + 
                      '9' + // Código da moeda (Real)
                      fatorVencimento + 
                      valorFormatado + 
                      campoLivre;
  
  // 6. Calcular dígito verificador
  const digitoVerificador = modulo11CodigoBarras(codigoSemDV);
  
  // 7. Montar código completo (DV na posição 5)
  const codigoBarras = codigoBancoPadrao.slice(0, 3) + 
                       '9' + 
                       digitoVerificador + 
                       fatorVencimento + 
                       valorFormatado + 
                       campoLivre;
  
  return {
    codigoBarras,
    campoLivre,
    fatorVencimento,
    valorFormatado,
  };
}

/**
 * Gera linha digitável a partir do código de barras
 * Baseado em: UniRelVendas.pas (linhas 1594-1650)
 */
export function gerarLinhaDigitavel(dados: DadosBoleto): {
  linhaDigitavel: string;
  campo1: string;
  campo2: string;
  campo3: string;
  campo4: string;
  campo5: string;
} {
  const { codigoBarras, campoLivre } = gerarCodigoBarras(dados);
  
  const codigoBanco = codigoBarras.substring(0, 3);
  const moeda = codigoBarras.substring(3, 4);
  const dvGeral = codigoBarras.substring(4, 5);
  const fatorVencimento = codigoBarras.substring(5, 9);
  const valor = codigoBarras.substring(9, 19);
  
  // Campo 1: Código banco (3) + moeda (1) + primeiros 5 do campo livre + DV
  const campo1SemDV = codigoBanco + moeda + campoLivre.substring(0, 5);
  const dvCampo1 = modulo10(campo1SemDV);
  const campo1 = campo1SemDV + dvCampo1;
  
  // Campo 2: Próximos 10 dígitos do campo livre + DV
  const campo2SemDV = campoLivre.substring(5, 15);
  const dvCampo2 = modulo10(campo2SemDV);
  const campo2 = campo2SemDV + dvCampo2;
  
  // Campo 3: Últimos 10 dígitos do campo livre + DV
  const campo3SemDV = campoLivre.substring(15, 25);
  const dvCampo3 = modulo10(campo3SemDV);
  const campo3 = campo3SemDV + dvCampo3;
  
  // Campo 4: Dígito verificador geral
  const campo4 = dvGeral;
  
  // Campo 5: Fator de vencimento + valor
  const campo5 = fatorVencimento + valor;
  
  // Linha digitável formatada
  const linhaDigitavel = 
    `${campo1.substring(0, 5)}.${campo1.substring(5)} ` +
    `${campo2.substring(0, 5)}.${campo2.substring(5)} ` +
    `${campo3.substring(0, 5)}.${campo3.substring(5)} ` +
    `${campo4} ` +
    `${campo5}`;
  
  return {
    linhaDigitavel,
    campo1,
    campo2,
    campo3,
    campo4,
    campo5,
  };
}

/**
 * Gera nosso número formatado para exibição
 */
export function gerarNossoNumero(dados: DadosBoleto): string {
  const carteira = dados.carteira || '17';
  
  switch (dados.banco) {
    case '0': // Bradesco
      const nossoNumeroBradesco = completarZeros(dados.nroDocBanco, 11);
      const digitoBradesco = gerarDigitoNossoNumeroBradesco(nossoNumeroBradesco);
      return `${carteira} / ${nossoNumeroBradesco}-${digitoBradesco}`;
      
    case '1': // Banco do Brasil
      const nossoNumeroBB = completarZeros(dados.nroDocBanco, 17);
      const digitoBB = gerarDigitoNossoNumeroBB(nossoNumeroBB);
      return `${nossoNumeroBB}-${digitoBB}`;
      
    case '2': // Itaú
      const nossoNumeroItau = completarZeros(dados.nroDocBanco, 8);
      const digitoItau = gerarDigitoNossoNumeroBradesco(nossoNumeroItau);
      return `${carteira} / ${nossoNumeroItau}-${digitoItau}`;
      
    default:
      return dados.nroDocBanco;
  }
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

/**
 * Gera boleto completo com todos os cálculos
 * Esta é a função principal que deve ser usada
 */
export function gerarBoleto(dados: DadosBoleto): BoletoGerado {
  // Validações básicas
  if (!dados.codReceb || dados.codReceb.length !== 11) {
    throw new Error('COD_RECEB deve ter 11 dígitos');
  }
  
  if (!dados.nroDocBanco) {
    throw new Error('Número do documento no banco é obrigatório');
  }
  
  if (dados.valor <= 0) {
    throw new Error('Valor deve ser maior que zero');
  }
  
  if (dados.dtVencimento <= dados.dtEmissao) {
    throw new Error('Data de vencimento deve ser posterior à data de emissão');
  }
  
  // Gerar linha digitável
  const linhaDigitavelData = gerarLinhaDigitavel(dados);
  
  // Gerar código de barras
  const codigoBarrasData = gerarCodigoBarras(dados);
  
  // Gerar nosso número
  const nossoNumero = gerarNossoNumero(dados);
  //  TODO: CALCULO DE JUROS COMPOSTOS E ADITIVOS DERIVADOS
  // Calcular valor de mora (juros por dia)
  const taxaJuros = dados.juros || 0.02; // 2% padrão
  const valorMora = (dados.valor * taxaJuros) / 30; // Por dia
  
  return {
    linhaDigitavel: linhaDigitavelData.linhaDigitavel,
    codigoBarras: codigoBarrasData.codigoBarras,
    nossoNumero,
    fatorVencimento: codigoBarrasData.fatorVencimento,
    campo1: linhaDigitavelData.campo1,
    campo2: linhaDigitavelData.campo2,
    campo3: linhaDigitavelData.campo3,
    campo4: linhaDigitavelData.campo4,
    campo5: linhaDigitavelData.campo5,
    valorMora,
    dadosOriginais: dados,
  };
}

/**
 * Calcula taxa de juros conforme sistema legado
 * Fórmula: (valor * taxa) / 3000
 */
export function calcularJurosMora(valor: number, taxaJuros: number): number {
  return (valor * taxaJuros) / 3000;
}
