/**
 * Utilitários para Cálculo de IBS/CBS (Reforma Tributária 2026)
 * Baseado na LC 214/2025 e procedimentos Oracle legados
 */

import {
  ALIQUOTAS_TRANSICAO,
  ALIQUOTA_CBS_2026,
  ALIQUOTA_IBS_2026,
  MUNICIPIOS_ZFM,
  MUNICIPIOS_ALC,
  CODIGOS_IBGE_ZFM,
  CODIGOS_IBGE_ALC,
  CREDITOS_PRESUMIDOS,
  CONFIGURACOES_ALIQUOTA,
  CST_IBS_CBS,
  CCLASSTRIB,
  type CategoriaAliquota,
  type AliquotaTransicao,
  type TipoOperacaoIBSCBS,
} from '@/constants/tributacao2026';

// ============================================================================
// INTERFACES
// ============================================================================

export interface DadosLocalidade {
  municipio: string;
  codigoIbge?: string;
  uf: string;
}

export interface ResultadoVerificacaoZFM {
  isZFM: boolean;
  isALC: boolean;
  isZonaIncentivada: boolean;
  tipo: 'ZFM' | 'ALC' | 'NORMAL';
  descricao: string;
}

export interface ParametrosCalculoIBSCBS {
  tipoOperacao: TipoOperacaoIBSCBS;
  origem: DadosLocalidade;
  destino: DadosLocalidade;
  valorBase: number;
  ncm?: string;
  categoriaAliquota?: CategoriaAliquota;
  anoOperacao?: number;
  isIndustriaIncentivada?: boolean;
  isExportacao?: boolean;
}

export interface ResultadoCalculoIBSCBS {
  // Identificação da operação
  tipoOperacao: TipoOperacaoIBSCBS;
  anoOperacao: number;
  faseTeste: boolean;

  // Alíquotas aplicadas
  aliquotaCBS: number;
  aliquotaIBS: number;
  aliquotaTotal: number;

  // Valores calculados
  baseCalculo: number;
  valorCBS: number;
  valorIBS: number;
  valorTotal: number;

  // CST e classificação
  cstIBSCBS: string;
  cClassTrib: string;

  // Créditos presumidos (se aplicável)
  creditoPresumido: {
    aplicavel: boolean;
    percentual: number;
    valor: number;
    descricao: string;
  };

  // Informações de incentivo fiscal
  incentivoFiscal: {
    aplicado: boolean;
    tipo: 'ZFM' | 'ALC' | 'EXPORTACAO' | 'NENHUM';
    descricao: string;
    fundamentoLegal: string;
  };

  // Categoria final
  categoriaAliquota: CategoriaAliquota;

  // Observações
  observacoes: string[];
}

// ============================================================================
// FUNÇÕES DE VERIFICAÇÃO ZFM/ALC
// ============================================================================

/**
 * Normaliza nome do município para comparação
 */
function normalizarMunicipio(municipio: string): string {
  return municipio
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^A-Z\s]/g, '')        // Remove caracteres especiais
    .trim();
}

/**
 * Verifica se um município está na Zona Franca de Manaus
 */
export function isZFM(localidade: DadosLocalidade): boolean {
  // Verificar por código IBGE (mais preciso)
  if (localidade.codigoIbge) {
    return (CODIGOS_IBGE_ZFM as readonly string[]).includes(localidade.codigoIbge);
  }

  // Verificar por nome do município
  const municipioNorm = normalizarMunicipio(localidade.municipio);
  return MUNICIPIOS_ZFM.some(m => normalizarMunicipio(m) === municipioNorm);
}

/**
 * Verifica se um município está em uma Área de Livre Comércio
 */
export function isALC(localidade: DadosLocalidade): boolean {
  // Verificar por código IBGE (mais preciso)
  if (localidade.codigoIbge) {
    return (CODIGOS_IBGE_ALC as readonly string[]).includes(localidade.codigoIbge);
  }

  // Verificar por nome do município
  const municipioNorm = normalizarMunicipio(localidade.municipio);
  return MUNICIPIOS_ALC.some(m => normalizarMunicipio(m) === municipioNorm);
}

/**
 * Verifica se um município está em zona incentivada (ZFM ou ALC)
 */
export function isZonaIncentivada(localidade: DadosLocalidade): boolean {
  return isZFM(localidade) || isALC(localidade);
}

/**
 * Verifica detalhes completos de zona incentivada
 */
export function verificarZonaIncentivada(localidade: DadosLocalidade): ResultadoVerificacaoZFM {
  const zfm = isZFM(localidade);
  const alc = isALC(localidade);

  if (zfm) {
    return {
      isZFM: true,
      isALC: false,
      isZonaIncentivada: true,
      tipo: 'ZFM',
      descricao: `Zona Franca de Manaus - ${localidade.municipio}`,
    };
  }

  if (alc) {
    return {
      isZFM: false,
      isALC: true,
      isZonaIncentivada: true,
      tipo: 'ALC',
      descricao: `Área de Livre Comércio - ${localidade.municipio}`,
    };
  }

  return {
    isZFM: false,
    isALC: false,
    isZonaIncentivada: false,
    tipo: 'NORMAL',
    descricao: 'Tributação normal',
  };
}

/**
 * Verifica se origem e destino estão na mesma zona ZFM
 * (Operações internas ZFM têm alíquota zero)
 */
export function isMesmaZFM(origem: DadosLocalidade, destino: DadosLocalidade): boolean {
  return isZFM(origem) && isZFM(destino);
}

/**
 * Verifica se origem e destino estão na mesma ALC
 * (Operações internas ALC têm alíquota zero)
 */
export function isMesmaALC(origem: DadosLocalidade, destino: DadosLocalidade): boolean {
  return isALC(origem) && isALC(destino);
}

/**
 * Verifica se é operação de entrada na ZFM/ALC (de fora para dentro)
 */
export function isEntradaZonaIncentivada(origem: DadosLocalidade, destino: DadosLocalidade): boolean {
  const origemIncentivada = isZonaIncentivada(origem);
  const destinoIncentivado = isZonaIncentivada(destino);

  return !origemIncentivada && destinoIncentivado;
}

// ============================================================================
// FUNÇÕES DE ALÍQUOTA
// ============================================================================

/**
 * Obtém as alíquotas de transição para um ano específico
 */
export function getAliquotasTransicao(ano: number): AliquotaTransicao {
  // Encontrar a configuração do ano ou a mais próxima anterior
  const config = ALIQUOTAS_TRANSICAO.find(a => a.ano === ano);

  if (config) {
    return config;
  }

  // Se não encontrou, usar a última disponível
  if (ano > 2033) {
    return ALIQUOTAS_TRANSICAO[ALIQUOTAS_TRANSICAO.length - 1];
  }

  // Se for antes de 2026, usar 2026
  return ALIQUOTAS_TRANSICAO[0];
}

/**
 * Calcula o crédito presumido aplicável
 */
export function calcularCreditoPresumido(
  ufOrigem: string,
  valorOperacao: number,
): { aplicavel: boolean; percentual: number; valor: number; descricao: string } {
  const uf = ufOrigem.toUpperCase();

  for (const credito of CREDITOS_PRESUMIDOS) {
    if (credito.regiaoOrigem.includes(uf)) {
      return {
        aplicavel: true,
        percentual: credito.percentualIBS,
        valor: Number((valorOperacao * (credito.percentualIBS / 100)).toFixed(2)),
        descricao: credito.descricao,
      };
    }
  }

  return {
    aplicavel: false,
    percentual: 0,
    valor: 0,
    descricao: 'Não aplicável',
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE CÁLCULO
// ============================================================================

/**
 * Calcula IBS e CBS conforme LC 214/2025
 * Implementa a lógica equivalente ao CALCULO_IMPOSTO.Calcular_IBS_CBS do Oracle
 */
export function calcularIBSCBS(params: ParametrosCalculoIBSCBS): ResultadoCalculoIBSCBS {
  const {
    tipoOperacao,
    origem,
    destino,
    valorBase,
    categoriaAliquota = 'PADRAO',
    anoOperacao = new Date().getFullYear(),
    isIndustriaIncentivada = false,
    isExportacao = false,
  } = params;

  const observacoes: string[] = [];

  // 1. Obter alíquotas do ano
  const aliquotasAno = getAliquotasTransicao(anoOperacao);
  let aliquotaCBS = aliquotasAno.cbs;
  let aliquotaIBS = aliquotasAno.ibs;
  let categoriaFinal: CategoriaAliquota = categoriaAliquota;

  // Declarar variáveis de CST com tipos string para permitir reatribuição
  let cstIBSCBS: string = CST_IBS_CBS['000'].codigo;
  let cClassTrib: string = CCLASSTRIB.NORMAL;

  // Informações de incentivo
  let incentivoAplicado = false;
  let tipoIncentivo: 'ZFM' | 'ALC' | 'EXPORTACAO' | 'NENHUM' = 'NENHUM';
  let descricaoIncentivo = 'Tributação normal';
  let fundamentoLegal = '';

  // 2. Verificar zonas incentivadas
  const verificacaoOrigem = verificarZonaIncentivada(origem);
  const verificacaoDestino = verificarZonaIncentivada(destino);

  // 3. Aplicar regras específicas

  // 3.1 Exportação - Alíquota zero
  if (isExportacao || tipoOperacao === 'EXPORTACAO') {
    aliquotaCBS = 0;
    aliquotaIBS = 0;
    categoriaFinal = 'ZERO_EXPORTACAO';
    cstIBSCBS = CST_IBS_CBS['410'].codigo;
    cClassTrib = CCLASSTRIB.EXPORTACAO;
    incentivoAplicado = true;
    tipoIncentivo = 'EXPORTACAO';
    descricaoIncentivo = 'Exportação - Alíquota zero';
    fundamentoLegal = 'Art. 5º, LC 214/2025';
    observacoes.push('Operação de exportação com alíquota zero de IBS e CBS');
  }
  // 3.2 Transferência
  else if (tipoOperacao === 'TRANSFERENCIA') {
    cstIBSCBS = CST_IBS_CBS['410'].codigo;
    cClassTrib = CCLASSTRIB.TRANSFERENCIA;
    observacoes.push('Operação de transferência');
  }
  // 3.3 Bonificação
  else if (tipoOperacao === 'BONIFICACAO') {
    cstIBSCBS = CST_IBS_CBS['410'].codigo;
    cClassTrib = CCLASSTRIB.BONIFICACAO;
    observacoes.push('Operação de bonificação');
  }
  // 3.4 Conserto
  else if (tipoOperacao === 'REMESSA_CONSERTO' || tipoOperacao === 'RETORNO_CONSERTO') {
    cstIBSCBS = CST_IBS_CBS['200'].codigo;
    cClassTrib = CCLASSTRIB.CONSERTO;
    observacoes.push('Operação de conserto - suspensão');
  }
  // 3.5 Operações dentro da mesma ZFM ou ALC
  else if (isMesmaZFM(origem, destino)) {
    aliquotaCBS = 0;
    aliquotaIBS = 0;
    categoriaFinal = 'ZERO_ZFM';
    cstIBSCBS = CST_IBS_CBS['200'].codigo;
    cClassTrib = CCLASSTRIB.ZFM;
    incentivoAplicado = true;
    tipoIncentivo = 'ZFM';
    descricaoIncentivo = 'Operação interna na Zona Franca de Manaus';
    fundamentoLegal = 'Art. 448, LC 214/2025';
    observacoes.push('Origem e destino na ZFM - Alíquota zero de IBS e CBS');
    observacoes.push('Mantém direito a créditos de operações anteriores');
  }
  else if (isMesmaALC(origem, destino)) {
    aliquotaCBS = 0;
    aliquotaIBS = 0;
    categoriaFinal = 'ZERO_ALC';
    cstIBSCBS = CST_IBS_CBS['200'].codigo;
    cClassTrib = CCLASSTRIB.ALC;
    incentivoAplicado = true;
    tipoIncentivo = 'ALC';
    descricaoIncentivo = 'Operação interna em Área de Livre Comércio';
    fundamentoLegal = 'Art. 466, LC 214/2025';
    observacoes.push('Origem e destino na mesma ALC - Alíquota zero de IBS e CBS');
  }
  // 3.6 Destino é ALC específica (Art. 451, 466)
  else if (verificacaoDestino.isALC) {
    aliquotaCBS = 0;
    aliquotaIBS = 0;
    categoriaFinal = 'ZERO_ALC';
    cstIBSCBS = CST_IBS_CBS['200'].codigo;
    cClassTrib = CCLASSTRIB.ALC;
    incentivoAplicado = true;
    tipoIncentivo = 'ALC';
    descricaoIncentivo = `Venda para ${destino.municipio} (ALC)`;
    fundamentoLegal = 'Arts. 451 e 466, LC 214/2025';
    observacoes.push(`Destino em ALC (${destino.municipio}) - Alíquota zero`);
  }
  // 3.7 Entrada na ZFM de fora
  else if (isEntradaZonaIncentivada(origem, destino) && verificacaoDestino.isZFM) {
    if (isIndustriaIncentivada) {
      // Indústria incentivada - alíquota zero
      aliquotaCBS = 0;
      aliquotaIBS = 0;
      categoriaFinal = 'ZERO_ZFM';
      cstIBSCBS = CST_IBS_CBS['200'].codigo;
      cClassTrib = CCLASSTRIB.ZFM;
      incentivoAplicado = true;
      tipoIncentivo = 'ZFM';
      descricaoIncentivo = 'Entrada na ZFM para indústria incentivada';
      fundamentoLegal = 'Art. 443, LC 214/2025';
      observacoes.push('Entrada na ZFM para indústria incentivada - Alíquota zero');
    } else {
      // Não é indústria - tributa 70% do IBS
      aliquotaCBS = 0; // CBS não incide
      aliquotaIBS = aliquotaIBS * 0.7; // 70% da alíquota padrão
      categoriaFinal = 'TRIBUTACAO_70';
      cstIBSCBS = CST_IBS_CBS['000'].codigo;
      cClassTrib = CCLASSTRIB.NORMAL;
      incentivoAplicado = true; // Marcar para não aplicar multiplicador novamente
      observacoes.push('Entrada na ZFM (não industrial) - IBS a 70% da alíquota');
      observacoes.push(`IBS: ${aliquotaIBS.toFixed(2)}% (70% de ${aliquotasAno.ibs}%)`);
      fundamentoLegal = 'Arts. 446 e 464, LC 214/2025';
    }
  }
  // 3.8 Saída da ZFM para fora
  else if (verificacaoOrigem.isZFM && !verificacaoDestino.isZonaIncentivada) {
    // Tributação normal na saída
    observacoes.push('Saída da ZFM para fora - Tributação normal');
  }

  // 4. Aplicar multiplicador da categoria (se não foi sobrescrito)
  if (!incentivoAplicado && categoriaFinal !== 'PADRAO') {
    const config = CONFIGURACOES_ALIQUOTA[categoriaFinal];
    if (config) {
      aliquotaCBS = aliquotaCBS * config.multiplicador;
      aliquotaIBS = aliquotaIBS * config.multiplicador;
      observacoes.push(`Categoria ${categoriaFinal}: ${config.descricao}`);
    }
  }

  // 5. Calcular valores
  const baseCalculo = valorBase;
  const valorCBS = Number((baseCalculo * (aliquotaCBS / 100)).toFixed(2));
  const valorIBS = Number((baseCalculo * (aliquotaIBS / 100)).toFixed(2));
  const valorTotal = Number((valorCBS + valorIBS).toFixed(2));

  // 6. Calcular crédito presumido (se aplicável para ZFM)
  let creditoPresumido = { aplicavel: false, percentual: 0, valor: 0, descricao: 'Não aplicável' };

  if (verificacaoDestino.isZFM && isIndustriaIncentivada) {
    creditoPresumido = calcularCreditoPresumido(origem.uf, baseCalculo);
    if (creditoPresumido.aplicavel) {
      observacoes.push(`Crédito presumido de ${creditoPresumido.percentual}%: R$ ${creditoPresumido.valor.toFixed(2)}`);
    }
  }

  // 7. Adicionar observação sobre fase de teste
  if (aliquotasAno.faseTeste) {
    observacoes.unshift(`ANO ${anoOperacao}: Fase de teste - valores apenas informativos`);
  }

  return {
    tipoOperacao,
    anoOperacao,
    faseTeste: aliquotasAno.faseTeste,

    aliquotaCBS: Number(aliquotaCBS.toFixed(4)),
    aliquotaIBS: Number(aliquotaIBS.toFixed(4)),
    aliquotaTotal: Number((aliquotaCBS + aliquotaIBS).toFixed(4)),

    baseCalculo,
    valorCBS,
    valorIBS,
    valorTotal,

    cstIBSCBS,
    cClassTrib,

    creditoPresumido,

    incentivoFiscal: {
      aplicado: incentivoAplicado,
      tipo: tipoIncentivo,
      descricao: descricaoIncentivo,
      fundamentoLegal,
    },

    categoriaAliquota: categoriaFinal,

    observacoes,
  };
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Formata resultado para exibição
 */
export function formatarResultadoIBSCBS(resultado: ResultadoCalculoIBSCBS): string {
  const linhas = [
    `=== Cálculo IBS/CBS - Ano ${resultado.anoOperacao} ===`,
    resultado.faseTeste ? '*** FASE DE TESTE - APENAS INFORMATIVO ***' : '',
    '',
    `Operação: ${resultado.tipoOperacao}`,
    `Categoria: ${resultado.categoriaAliquota}`,
    '',
    `Base de Cálculo: R$ ${resultado.baseCalculo.toFixed(2)}`,
    `Alíquota CBS: ${resultado.aliquotaCBS}%`,
    `Alíquota IBS: ${resultado.aliquotaIBS}%`,
    `Alíquota Total: ${resultado.aliquotaTotal}%`,
    '',
    `Valor CBS: R$ ${resultado.valorCBS.toFixed(2)}`,
    `Valor IBS: R$ ${resultado.valorIBS.toFixed(2)}`,
    `Valor Total: R$ ${resultado.valorTotal.toFixed(2)}`,
    '',
    `CST: ${resultado.cstIBSCBS}`,
    `cClassTrib: ${resultado.cClassTrib}`,
  ];

  if (resultado.incentivoFiscal.aplicado) {
    linhas.push('', '--- Incentivo Fiscal ---');
    linhas.push(`Tipo: ${resultado.incentivoFiscal.tipo}`);
    linhas.push(`Descrição: ${resultado.incentivoFiscal.descricao}`);
    linhas.push(`Fundamento: ${resultado.incentivoFiscal.fundamentoLegal}`);
  }

  if (resultado.creditoPresumido.aplicavel) {
    linhas.push('', '--- Crédito Presumido ---');
    linhas.push(`Percentual: ${resultado.creditoPresumido.percentual}%`);
    linhas.push(`Valor: R$ ${resultado.creditoPresumido.valor.toFixed(2)}`);
  }

  if (resultado.observacoes.length > 0) {
    linhas.push('', '--- Observações ---');
    resultado.observacoes.forEach(obs => linhas.push(`• ${obs}`));
  }

  return linhas.filter(l => l !== '').join('\n');
}
