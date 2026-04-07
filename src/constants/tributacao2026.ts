/**
 * Constantes da Reforma Tributária 2026 (LC 214/2025)
 * IBS (Imposto sobre Bens e Serviços) + CBS (Contribuição sobre Bens e Serviços)
 */

// ============================================================================
// ALÍQUOTAS DE TRANSIÇÃO (2026-2033)
// ============================================================================

export interface AliquotaTransicao {
  ano: number;
  cbs: number;           // Alíquota CBS (%)
  ibs: number;           // Alíquota IBS (%)
  icmsResidual: number;  // % do ICMS que ainda se aplica
  issResidual: number;   // % do ISS que ainda se aplica
  faseTeste: boolean;    // Se é apenas informativo (sem cobrança efetiva)
  observacao: string;
}

export const ALIQUOTAS_TRANSICAO: AliquotaTransicao[] = [
  { ano: 2026, cbs: 0.9,  ibs: 0.1,  icmsResidual: 100, issResidual: 100, faseTeste: true,  observacao: 'Fase teste - apenas informativo' },
  { ano: 2027, cbs: 0.9,  ibs: 0.1,  icmsResidual: 100, issResidual: 100, faseTeste: false, observacao: 'CBS começa a valer' },
  { ano: 2028, cbs: 0.9,  ibs: 0.1,  icmsResidual: 100, issResidual: 100, faseTeste: false, observacao: 'Preparação para IBS' },
  { ano: 2029, cbs: 3.8,  ibs: 7.8,  icmsResidual: 90,  issResidual: 90,  faseTeste: false, observacao: 'IBS inicia transição' },
  { ano: 2030, cbs: 5.5,  ibs: 11.2, icmsResidual: 70,  issResidual: 70,  faseTeste: false, observacao: 'Transição progressiva' },
  { ano: 2031, cbs: 7.1,  ibs: 14.6, icmsResidual: 50,  issResidual: 50,  faseTeste: false, observacao: 'Transição progressiva' },
  { ano: 2032, cbs: 8.5,  ibs: 17.5, icmsResidual: 30,  issResidual: 30,  faseTeste: false, observacao: 'Última fase de transição' },
  { ano: 2033, cbs: 9.3,  ibs: 18.7, icmsResidual: 0,   issResidual: 0,   faseTeste: false, observacao: 'Sistema completo' },
];

// Alíquotas padrão para o ano atual (2026)
export const ALIQUOTA_CBS_2026 = 0.9;
export const ALIQUOTA_IBS_2026 = 0.1;
export const ALIQUOTA_TOTAL_2026 = 1.0;

// Alíquotas estimadas finais (2033+)
export const ALIQUOTA_CBS_FINAL = 9.3;
export const ALIQUOTA_IBS_FINAL = 18.7;
export const ALIQUOTA_TOTAL_FINAL = 28.0;

// ============================================================================
// ZONA FRANCA DE MANAUS (ZFM) E ÁREAS DE LIVRE COMÉRCIO (ALC)
// ============================================================================

/** Municípios da Zona Franca de Manaus */
export const MUNICIPIOS_ZFM = [
  'MANAUS',
  'RIO PRETO DA EVA',
  'PRESIDENTE FIGUEIREDO',
] as const;

/** Códigos IBGE dos municípios ZFM */
export const CODIGOS_IBGE_ZFM = [
  '1302603', // MANAUS
  '1303569', // RIO PRETO DA EVA
  '1303536', // PRESIDENTE FIGUEIREDO
] as const;

/** Municípios das Áreas de Livre Comércio (ALC) */
export const MUNICIPIOS_ALC = [
  // Acre
  'BRASILEIA',
  'EPITACIOLANDIA',
  'CRUZEIRO DO SUL',
  // Amazonas
  'TABATINGA',
  // Rondônia
  'GUAJARA-MIRIM',
  // Roraima
  'BOA VISTA',
  'BONFIM',
  // Amapá
  'MACAPA',
  'SANTANA',
] as const;

/** Códigos IBGE dos municípios ALC */
export const CODIGOS_IBGE_ALC = [
  // Acre
  '1200104', // BRASILEIA
  '1200252', // EPITACIOLANDIA
  '1200203', // CRUZEIRO DO SUL
  // Amazonas
  '1304062', // TABATINGA
  // Rondônia
  '1100106', // GUAJARA-MIRIM
  // Roraima
  '1400100', // BOA VISTA
  '1400159', // BONFIM
  // Amapá
  '1600303', // MACAPA
  '1600600', // SANTANA
] as const;

/** UFs com Áreas de Livre Comércio */
export const UFS_COM_ALC = ['AC', 'AM', 'RO', 'RR', 'AP'] as const;

// ============================================================================
// CRÉDITOS PRESUMIDOS (Arts. 443-466 LC 214/2025)
// ============================================================================

export interface CreditoPresumido {
  regiaoOrigem: string[];
  percentualIBS: number;
  descricao: string;
}

export const CREDITOS_PRESUMIDOS: CreditoPresumido[] = [
  {
    regiaoOrigem: ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'], // Sul/Sudeste exceto ES
    percentualIBS: 7.5,
    descricao: 'Bens das regiões Sul e Sudeste (exceto ES)',
  },
  {
    regiaoOrigem: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO', 'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', 'DF', 'GO', 'MT', 'MS', 'ES'],
    percentualIBS: 13.5,
    descricao: 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES',
  },
];

// ============================================================================
// CATEGORIAS DE ALÍQUOTA
// ============================================================================

export type CategoriaAliquota =
  | 'PADRAO'           // Alíquota padrão (28% quando completo)
  | 'REDUZIDA_50'      // 50% da alíquota padrão
  | 'REDUZIDA_60'      // 60% da alíquota padrão (60% de 28% = 16.8%)
  | 'REDUZIDA_30'      // 30% da alíquota padrão (alguns casos)
  | 'ZERO'             // Alíquota zero (exportação, cesta básica)
  | 'ZERO_ZFM'         // Alíquota zero por ZFM
  | 'ZERO_ALC'         // Alíquota zero por ALC
  | 'ZERO_EXPORTACAO'  // Alíquota zero por exportação
  | 'TRIBUTACAO_70'    // 70% da alíquota (entrada ZFM não industrial)
  | 'ESPECIFICA';      // Regime específico setorial

export interface ConfiguracaoAliquota {
  categoria: CategoriaAliquota;
  multiplicador: number; // Multiplicador sobre alíquota padrão
  descricao: string;
}

export const CONFIGURACOES_ALIQUOTA: Record<CategoriaAliquota, ConfiguracaoAliquota> = {
  'PADRAO':          { categoria: 'PADRAO',          multiplicador: 1.0,  descricao: 'Alíquota padrão' },
  'REDUZIDA_50':     { categoria: 'REDUZIDA_50',     multiplicador: 0.5,  descricao: '50% da alíquota padrão' },
  'REDUZIDA_60':     { categoria: 'REDUZIDA_60',     multiplicador: 0.6,  descricao: '60% da alíquota padrão' },
  'REDUZIDA_30':     { categoria: 'REDUZIDA_30',     multiplicador: 0.3,  descricao: '30% da alíquota padrão' },
  'ZERO':            { categoria: 'ZERO',            multiplicador: 0.0,  descricao: 'Alíquota zero' },
  'ZERO_ZFM':        { categoria: 'ZERO_ZFM',        multiplicador: 0.0,  descricao: 'Isento - Zona Franca de Manaus' },
  'ZERO_ALC':        { categoria: 'ZERO_ALC',        multiplicador: 0.0,  descricao: 'Isento - Área de Livre Comércio' },
  'ZERO_EXPORTACAO': { categoria: 'ZERO_EXPORTACAO', multiplicador: 0.0,  descricao: 'Isento - Exportação' },
  'TRIBUTACAO_70':   { categoria: 'TRIBUTACAO_70',   multiplicador: 0.7,  descricao: '70% da alíquota (entrada ZFM)' },
  'ESPECIFICA':      { categoria: 'ESPECIFICA',      multiplicador: 1.0,  descricao: 'Regime específico setorial' },
};

// ============================================================================
// TIPOS DE OPERAÇÃO
// ============================================================================

export type TipoOperacaoIBSCBS =
  | 'VENDA'
  | 'COMPRA'
  | 'TRANSFERENCIA'
  | 'DEVOLUCAO_VENDA'
  | 'DEVOLUCAO_COMPRA'
  | 'BONIFICACAO'
  | 'REMESSA_CONSERTO'
  | 'RETORNO_CONSERTO'
  | 'EXPORTACAO'
  | 'IMPORTACAO';

// ============================================================================
// CST IBS/CBS (Códigos de Situação Tributária)
// ============================================================================

export const CST_IBS_CBS = {
  '000': { codigo: '000', descricao: 'Tributação normal', cclasstrib: '000001' },
  '200': { codigo: '200', descricao: 'Operação com suspensão', cclasstrib: '200022' },
  '410': { codigo: '410', descricao: 'Não incidência', cclasstrib: '410001' },
  '500': { codigo: '500', descricao: 'Imunidade', cclasstrib: '500001' },
  '900': { codigo: '900', descricao: 'Outros', cclasstrib: '900001' },
} as const;

// Classificações específicas
export const CCLASSTRIB = {
  NORMAL: '000001',
  TRANSFERENCIA: '410002',
  BONIFICACAO: '410001',
  EXPORTACAO: '410004',
  CONSERTO: '200022',
  ALC: '200024',
  ZFM: '200022',
} as const;
