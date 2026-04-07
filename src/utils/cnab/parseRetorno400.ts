/**
 * Parser para arquivos de retorno CNAB 400
 * Suporta: BRADESCO (237), SANTANDER (033)
 * 
 * Estrutura CNAB 400:
 * - Linha 1: Header (tipo '0' ou '9')
 * - Linhas 2-N: Detalhes (tipo '1')
 * - Última linha: Trailer (tipo '9')
 */

export interface RetornoHeader {
  tipoRegistro: string;                    // '0' ou '9'
  tipoArquivo: string;                     // '2' = Retorno
  literalRetorno: string;                  // 'RETORNO'
  codigoServico: string;                   // '01' = Cobrança
  literalServico: string;                  // 'COBRANCA'
  codigoEmpresa: string;                   // Código da empresa no banco
  nomeEmpresa: string;                     // Razão social da empresa
  codigoBanco: string;                     // '237' = BRADESCO, '033' = SANTANDER
  nomeBanco: string;                       // Nome do banco
  dataGeracao: string;                     // Data geração (DDMMAA)
  numeroSequencialArquivo: string;         // Número sequencial do arquivo
  versaoLayout: string;                    // Versão do layout
}

export interface RetornoDetalhe {
  tipoRegistro: string;                    // '1'
  codigoInscricao: string;                 // '01' = CPF, '02' = CNPJ
  numeroInscricao: string;                 // CPF/CNPJ do sacado
  codigoEmpresa: string;                   // Código da empresa
  numeroControle: string;                  // Número de controle do participante (uso da empresa)
  nossoNumero: string;                     // Nosso número (identificador do título no banco)
  carteira: string;                        // Código da carteira
  codigoOcorrencia: string;                // Código da ocorrência (02, 06, 09, etc)
  dataOcorrencia: string;                  // Data da ocorrência (DDMMAA)
  numeroDocumento: string;                 // Número do documento (duplicata, NF)
  
  // Identificação do sacado
  identificacaoTitulo: string;             // Identificação do título na empresa
  dataVencimento: string;                  // Data vencimento (DDMMAA)
  valorTitulo: number;                     // Valor nominal do título
  codigoBanco: string;                     // Código do banco cobrador
  agenciaCobradora: string;                // Agência cobradora (com DV)
  
  // Espécie e valores
  especieTitulo: string;                   // Código da espécie (01=DM, 02=NP, etc)
  valorDespesa: number;                    // Valor da despesa de cobrança
  outrasDespesas: number;                  // Outras despesas
  jurosAtraso: number;                     // Juros de mora
  iof: number;                             // IOF
  abatimento: number;                      // Valor do abatimento concedido
  desconto: number;                        // Valor do desconto concedido
  valorPago: number;                       // Valor efetivamente pago
  jurosMulta: number;                      // Juros + multa
  outrosCreditos: number;                  // Outros créditos
  
  // Dados complementares
  motivoOcorrencia: string;                // Motivos da rejeição/ocorrência
  numeroCartorio: string;                  // Número do cartório
  numeroProtocolo: string;                 // Número do protocolo
  nomeSacado: string;                      // Nome do sacado
}

export interface RetornoTrailer {
  tipoRegistro: string;                    // '9'
  quantidadeTitulos: number;               // Quantidade de títulos no arquivo
  valorTotal: number;                      // Valor total dos títulos
}

export interface RetornoCNAB400 {
  header: RetornoHeader;
  detalhes: RetornoDetalhe[];
  trailer: RetornoTrailer;
  banco: string;                           // BRADESCO, SANTANDER, etc
  totalTitulos: number;
  totalValor: number;
}

/**
 * Converte data DDMMAA para YYYY-MM-DD
 */
function converterData(dataDDMMAA: string): string {
  if (!dataDDMMAA || dataDDMMAA.trim() === '000000' || dataDDMMAA.trim() === '') {
    return '';
  }
  
  const dia = dataDDMMAA.substring(0, 2);
  const mes = dataDDMMAA.substring(2, 4);
  const ano = dataDDMMAA.substring(4, 6);
  
  // Determinar século (assumir 20XX se ano < 50, senão 19XX)
  const anoCompleto = parseInt(ano) < 50 ? `20${ano}` : `19${ano}`;
  
  return `${anoCompleto}-${mes}-${dia}`;
}

/**
 * Converte valor numérico com decimais implícitos
 */
function converterValor(valorStr: string, decimais: number = 2): number {
  if (!valorStr || valorStr.trim() === '') {
    return 0;
  }
  
  const valor = valorStr.replace(/[^\d]/g, '');
  return parseFloat(valor) / Math.pow(10, decimais);
}

/**
 * Identifica o banco pelo código
 */
function identificarBanco(codigoBanco: string): string {
  const bancos: { [key: string]: string } = {
    '001': 'BANCO DO BRASIL',
    '033': 'SANTANDER',
    '104': 'CAIXA',
    '237': 'BRADESCO',
    '341': 'ITAU',
    '748': 'SICREDI',
  };
  
  return bancos[codigoBanco] || `BANCO ${codigoBanco}`;
}

/**
 * Parse do header (registro tipo 0)
 */
function parseHeader(linha: string): RetornoHeader {
  return {
    tipoRegistro: linha.substring(0, 1),                     // Posição 001
    tipoArquivo: linha.substring(1, 2),                      // Posição 002
    literalRetorno: linha.substring(2, 9).trim(),            // Posições 003-009
    codigoServico: linha.substring(9, 11),                   // Posições 010-011
    literalServico: linha.substring(11, 26).trim(),          // Posições 012-026
    codigoEmpresa: linha.substring(26, 46).trim(),           // Posições 027-046
    nomeEmpresa: linha.substring(46, 76).trim(),             // Posições 047-076
    codigoBanco: linha.substring(76, 79),                    // Posições 077-079
    nomeBanco: linha.substring(79, 94).trim(),               // Posições 080-094
    dataGeracao: converterData(linha.substring(94, 100)),    // Posições 095-100
    numeroSequencialArquivo: linha.substring(108, 113).trim(), // Posições 109-113
    versaoLayout: linha.substring(390, 394).trim(),          // Posições 391-394
  };
}

/**
 * Parse do detalhe BRADESCO (registro tipo 1)
 */
function parseDetalheBradesco(linha: string): RetornoDetalhe {
  return {
    tipoRegistro: linha.substring(0, 1),                          // Posição 001
    codigoInscricao: linha.substring(1, 3),                       // Posições 002-003
    numeroInscricao: linha.substring(3, 17).trim(),               // Posições 004-017
    codigoEmpresa: linha.substring(17, 37).trim(),                // Posições 018-037
    numeroControle: linha.substring(37, 62).trim(),               // Posições 038-062 (uso da empresa)
    nossoNumero: linha.substring(62, 70).trim(),                  // Posições 063-070 (nosso número sem DV)
    carteira: linha.substring(107, 108),                          // Posição 108
    codigoOcorrencia: linha.substring(108, 110),                  // Posições 109-110
    dataOcorrencia: converterData(linha.substring(110, 116)),     // Posições 111-116
    numeroDocumento: linha.substring(116, 126).trim(),            // Posições 117-126
    identificacaoTitulo: linha.substring(62, 70).trim(),          // Nosso número
    dataVencimento: converterData(linha.substring(146, 152)),     // Posições 147-152
    valorTitulo: converterValor(linha.substring(152, 165), 2),    // Posições 153-165
    codigoBanco: linha.substring(165, 168),                       // Posições 166-168
    agenciaCobradora: linha.substring(168, 173).trim(),           // Posições 169-173
    especieTitulo: linha.substring(173, 175),                     // Posições 174-175
    valorDespesa: converterValor(linha.substring(175, 188), 2),   // Posições 176-188
    outrasDespesas: converterValor(linha.substring(188, 201), 2), // Posições 189-201
    jurosAtraso: converterValor(linha.substring(266, 279), 2),    // Posições 267-279
    iof: converterValor(linha.substring(214, 227), 2),            // Posições 215-227
    abatimento: converterValor(linha.substring(227, 240), 2),     // Posições 228-240
    desconto: converterValor(linha.substring(240, 253), 2),       // Posições 241-253
    valorPago: converterValor(linha.substring(253, 266), 2),      // Posições 254-266
    jurosMulta: converterValor(linha.substring(266, 279), 2),     // Posições 267-279
    outrosCreditos: converterValor(linha.substring(279, 292), 2), // Posições 280-292
    motivoOcorrencia: linha.substring(318, 328).trim(),           // Posições 319-328
    numeroCartorio: linha.substring(368, 370).trim(),             // Posições 369-370
    numeroProtocolo: linha.substring(370, 380).trim(),            // Posições 371-380
    nomeSacado: linha.substring(18, 62).trim(),                   // Extrair do número de controle/razão
  };
}

/**
 * Parse do detalhe SANTANDER (registro tipo 1)
 */
function parseDetalheSantander(linha: string): RetornoDetalhe {
  return {
    tipoRegistro: linha.substring(0, 1),                          // Posição 001
    codigoInscricao: linha.substring(1, 3),                       // Posições 002-003
    numeroInscricao: linha.substring(3, 17).trim(),               // Posições 004-017
    codigoEmpresa: linha.substring(17, 37).trim(),                // Posições 018-037
    numeroControle: linha.substring(37, 62).trim(),               // Posições 038-062
    nossoNumero: linha.substring(62, 70).trim(),                  // Posições 063-070
    carteira: linha.substring(107, 110),                          // Posições 108-110
    codigoOcorrencia: linha.substring(108, 110),                  // Posições 109-110
    dataOcorrencia: converterData(linha.substring(110, 116)),     // Posições 111-116
    numeroDocumento: linha.substring(116, 126).trim(),            // Posições 117-126
    identificacaoTitulo: linha.substring(62, 70).trim(),
    dataVencimento: converterData(linha.substring(146, 152)),     // Posições 147-152
    valorTitulo: converterValor(linha.substring(152, 165), 2),    // Posições 153-165
    codigoBanco: linha.substring(165, 168),                       // Posições 166-168
    agenciaCobradora: linha.substring(168, 173).trim(),           // Posições 169-173
    especieTitulo: linha.substring(173, 175),                     // Posições 174-175
    valorDespesa: converterValor(linha.substring(175, 188), 2),
    outrasDespesas: converterValor(linha.substring(188, 201), 2),
    jurosAtraso: converterValor(linha.substring(266, 279), 2),
    iof: converterValor(linha.substring(214, 227), 2),
    abatimento: converterValor(linha.substring(227, 240), 2),
    desconto: converterValor(linha.substring(240, 253), 2),
    valorPago: converterValor(linha.substring(253, 266), 2),
    jurosMulta: converterValor(linha.substring(266, 279), 2),
    outrosCreditos: converterValor(linha.substring(279, 292), 2),
    motivoOcorrencia: linha.substring(318, 328).trim(),
    numeroCartorio: '',
    numeroProtocolo: '',
    nomeSacado: linha.substring(18, 62).trim(),
  };
}

/**
 * Parse do trailer (registro tipo 9)
 */
function parseTrailer(linha: string): RetornoTrailer {
  return {
    tipoRegistro: linha.substring(0, 1),                       // Posição 001
    quantidadeTitulos: parseInt(linha.substring(17, 25)) || 0, // Posições 018-025
    valorTotal: converterValor(linha.substring(25, 39), 2),    // Posições 026-039
  };
}

/**
 * Função principal para parsear arquivo CNAB 400 de retorno
 */
export function parseCNAB400Retorno(conteudoArquivo: string): RetornoCNAB400 {
  const linhas = conteudoArquivo.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (linhas.length < 2) {
    throw new Error('Arquivo de retorno inválido: deve conter ao menos header e trailer');
  }
  
  // Parse do header
  const header = parseHeader(linhas[0]);
  const codigoBanco = header.codigoBanco;
  const banco = identificarBanco(codigoBanco);
  
  // Parse dos detalhes
  const detalhes: RetornoDetalhe[] = [];
  
  for (let i = 1; i < linhas.length - 1; i++) {
    const linha = linhas[i];
    
    // Verificar se é registro de detalhe (tipo '1')
    if (linha.charAt(0) === '1') {
      let detalhe: RetornoDetalhe;
      
      // Parse específico por banco
      if (codigoBanco === '237') {
        detalhe = parseDetalheBradesco(linha);
      } else if (codigoBanco === '033') {
        detalhe = parseDetalheSantander(linha);
      } else {
        // Usar parser genérico (Bradesco como padrão)
        detalhe = parseDetalheBradesco(linha);
      }
      
      detalhes.push(detalhe);
    }
  }
  
  // Parse do trailer
  let trailer: RetornoTrailer = {
    tipoRegistro: '9',
    quantidadeTitulos: detalhes.length,
    valorTotal: 0,
  };
  
  const ultimaLinha = linhas[linhas.length - 1];
  if (ultimaLinha.charAt(0) === '9') {
    trailer = parseTrailer(ultimaLinha);
  }
  
  // Calcular totais
  const totalValor = detalhes.reduce((sum, d) => sum + d.valorPago, 0);
  
  return {
    header,
    detalhes,
    trailer,
    banco,
    totalTitulos: detalhes.length,
    totalValor,
  };
}

/**
 * Valida se o arquivo é um retorno CNAB 400 válido
 */
export function validarRetornoCNAB400(conteudoArquivo: string): { valido: boolean; erro?: string } {
  try {
    const linhas = conteudoArquivo.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (linhas.length < 2) {
      return { valido: false, erro: 'Arquivo deve conter ao menos 2 linhas (header e trailer)' };
    }
    
    // Verificar header
    const primeiraLinha = linhas[0];
    if (primeiraLinha.charAt(0) !== '0') {
      return { valido: false, erro: 'Primeira linha deve ser header (tipo 0)' };
    }
    
    if (primeiraLinha.length !== 400) {
      return { valido: false, erro: `Header deve ter 400 caracteres (tem ${primeiraLinha.length})` };
    }
    
    // Verificar literal RETORNO
    const literalRetorno = primeiraLinha.substring(2, 9).trim();
    if (literalRetorno !== 'RETORNO') {
      return { valido: false, erro: `Literal deve ser RETORNO (encontrado: ${literalRetorno})` };
    }
    
    // Verificar trailer
    const ultimaLinha = linhas[linhas.length - 1];
    if (ultimaLinha.charAt(0) !== '9') {
      return { valido: false, erro: 'Última linha deve ser trailer (tipo 9)' };
    }
    
    // Verificar detalhes
    for (let i = 1; i < linhas.length - 1; i++) {
      const linha = linhas[i];
      if (linha.charAt(0) !== '1') {
        return { valido: false, erro: `Linha ${i + 1} deve ser detalhe (tipo 1)` };
      }
      
      if (linha.length !== 400) {
        return { valido: false, erro: `Linha ${i + 1} deve ter 400 caracteres (tem ${linha.length})` };
      }
    }
    
    return { valido: true };
  } catch (error) {
    return { valido: false, erro: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
