// lib/impostos/types.ts

/**
 * Tipos para o sistema de cálculo de impostos
 * Utiliza infraestrutura SQL (functions + views) do PostgreSQL
 */

// Enums e constantes
export type TipoOperacao = 'VENDA' | 'TRANSFERENCIA' | 'BONIFICACAO' | 'DEVOLUCAO' | 'EXPORTACAO';
export type TipoCliente = 'F' | 'J'; // Física ou Jurídica
export type UF = string; // Sigla UF (2 letras)

// CST ICMS (Código de Situação Tributária)
export type CSTICMS =
  | '00' // Tributada integralmente
  | '10' // Tributada e com cobrança do ICMS por substituição tributária
  | '20' // Com redução de base de cálculo
  | '30' // Isenta ou não tributada e com cobrança do ICMS por substituição tributária
  | '40' // Isenta
  | '41' // Não tributada
  | '50' // Suspensão
  | '51' // Diferimento
  | '60' // ICMS cobrado anteriormente por substituição tributária
  | '70' // Com redução de base de cálculo e cobrança do ICMS por substituição tributária
  | '90'; // Outras

// CST IPI
export type CSTIPI =
  | '00' // Entrada com recuperação de crédito
  | '01' // Entrada tributada com alíquota zero
  | '02' // Entrada isenta
  | '03' // Entrada não-tributada
  | '04' // Entrada imune
  | '05' // Entrada com suspensão
  | '49' // Outras entradas
  | '50' // Saída tributada
  | '51' // Saída tributada com alíquota zero
  | '52' // Saída isenta
  | '53' // Saída não-tributada
  | '54' // Saída imune
  | '55' // Saída com suspensão
  | '99'; // Outras saídas

// CST PIS/COFINS
export type CSTPISCOFINS =
  | '01' // Operação Tributável com Alíquota Básica
  | '02' // Operação Tributável com Alíquota Diferenciada
  | '03' // Operação Tributável com Alíquota por Unidade de Medida de Produto
  | '04' // Operação Tributável Monofásica - Revenda a Alíquota Zero
  | '05' // Operação Tributável por Substituição Tributária
  | '06' // Operação Tributável a Alíquota Zero
  | '07' // Operação Isenta da Contribuição
  | '08' // Operação sem Incidência da Contribuição
  | '09' // Operação com Suspensão da Contribuição
  | '49' // Outras Operações de Saída
  | '50' // Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno
  | '99'; // Outras Operações

// Dados de entrada para cálculo
export interface DadosCalculoImposto {
  // Produto
  produto_id?: number;
  ncm: string;
  valor_produto: number;
  quantidade: number;
  desconto?: number;

  // Cliente
  cliente_id: number;
  uf_cliente?: string; // Será buscado se não fornecido
  tipo_cliente?: TipoCliente; // Será buscado se não fornecido

  // Operação
  tipo_operacao: TipoOperacao;
  data_operacao?: Date | string;

  // Empresa/Armazém
  armazem_id?: number;
  uf_empresa?: string; // Será buscado se não fornecido

  // Alíquotas opcionais (se não fornecidas, busca do produto)
  ipi_aliquota?: number;
  pis_aliquota?: number;
  cofins_aliquota?: number;

  // Flags especiais
  produto_importado?: boolean;
  base_icms_reduzida?: boolean;
  percentual_reducao?: number;
  isento_icms?: boolean;

  // Modo de cálculo PIS/COFINS
  usar_regras_oracle_procedimento?: boolean; // true = usa regras do procedimento Oracle (1.65%/7.60%), false = usa valores do produto

  // Origem da mercadoria (para NCM)
  origem_mercadoria?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
}

// Resultado completo do cálculo (espelhado para dbitvenda)
export interface ResultadoCalculoImposto {
  // Valores básicos
  valor_produto: number;
  quantidade: number;
  valor_total_item: number; // quantidade × valor_produto - desconto
  desconto: number;

  // ICMS
  cfop: string;
  tipocfop: string; // Descrição
  icms: number; // alíquota %
  baseicms: number;
  totalicms: number;
  icmsinterno_dest: number; // Alíquota interna destino
  icmsexterno_orig: number; // Alíquota interestadual
  csticms: CSTICMS;

  // Substituição Tributária
  tem_st: boolean;
  mva: number; // MVA original ou ajustado
  basesubst_trib: number;
  totalsubst_trib: number;
  protocolo_icms?: string; // Protocolo/Convênio que estabelece a ST
  origem_mva: string; // 'VIEW' | 'MANUAL' | 'NAO_APLICAVEL'

  // IPI
  ipi: number; // alíquota %
  baseipi: number;
  totalipi: number;
  cstipi: CSTIPI;

  // PIS/COFINS
  pis: number; // alíquota %
  basepis: number;
  valorpis: number;
  cstpis: CSTPISCOFINS;

  cofins: number; // alíquota %
  basecofins: number;
  valorcofins: number;
  cstcofins: CSTPISCOFINS;

  // FCP (Fundo de Combate à Pobreza)
  fcp: number; // alíquota %
  base_fcp: number;
  valor_fcp: number;

  // FCP ST
  fcp_subst: number; // alíquota %
  basefcp_subst: number;
  valorfcp_subst: number;

  // IBS/CBS (Reforma Tributária 2026+)
  ibs_aliquota: number; // Total IBS (estadual + municipal)
  ibs_e: number; // IBS Estadual - alíquota % (substitui ICMS)
  ibs_m: number; // IBS Municipal - alíquota % (substitui ISS)
  ibs_valor: number;
  cbs_aliquota: number;
  cbs_valor: number;
  ibs_cbs_informativo: boolean; // true em 2026

  // Metadados
  ncm: string;
  cest?: string;
  origem_mercadoria: string;

  // Operação
  operacao_interna: boolean; // mesma UF
  operacao_interestadual: boolean; // UFs diferentes

  // Debug e observações
  observacoes: string[];
  warnings: string[];
  timestamp: Date;
}

// Resultado de múltiplos itens (para API calcular-completo)
export interface ResultadoCalculoCompleto {
  itens: ResultadoCalculoImposto[];
  totais: TotaisImpostos;
  observacoes: string[];
  warnings: string[];
  timestamp: Date;
}

// Totais consolidados
export interface TotaisImpostos {
  valor_produtos: number;
  total_descontos: number;
  subtotal: number;

  total_icms: number;
  total_st: number;
  total_ipi: number;
  total_pis: number;
  total_cofins: number;
  total_fcp: number;
  total_fcp_st: number;
  total_ibs: number;
  total_cbs: number;

  total_impostos: number;
  total_nfe: number; // Valor final da nota
}

// Alíquotas ICMS por UF
export interface AliquotasICMS {
  uf: string;
  icms_interno: number;
  icms_externo: number; // Interestadual
  icms_corredor: number; // Exportação
  tem_st: boolean;
  icms_antecipado: boolean;
  fcp: number; // Alíquota FCP se houver
}

// Dados de Substituição Tributária
export interface DadosST {
  tem_st: boolean;
  mva_original: number;
  mva_ajustado: number;
  aliquota_interna_origem: number;
  aliquota_interna_destino: number;
  aliquota_interestadual: number;
  protocolo?: string;
  ncm: string;
  uf_origem: string;
  uf_destino: string;
}

// Dados IBS/CBS
export interface DadosIBSCBS {
  ano: number;
  ncm: string;
  categoria: string;
  aliquota_ibs: number; // Total IBS (estadual + municipal)
  aliquota_cbs: number;
  ibs_e: number; // IBS Estadual (substitui ICMS)
  ibs_m: number; // IBS Municipal (substitui ISS)
  ibs_valor: number;
  cbs_valor: number;
  informativo: boolean;
  observacao?: string;
}

// Configuração fiscal (empresa/armazém)
export interface ConfiguracaoFiscal {
  uf: string;
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: 'SIMPLES' | 'PRESUMIDO' | 'REAL';
  armazem_id?: number;
}

// Dados do produto (cache)
export interface DadosProduto {
  codprod: string;
  ncm: string;
  descricao: string;
  referencia?: string;

  // Alíquotas
  ipi: number;
  pis: number;
  cofins: number;

  // Flags
  strib?: string; // Situação tributária (código origem mercadoria)
  produto_importado: boolean;
  monofasico: boolean;
  isentoipi?: string; // 'S'=Suspenso, 'C'=Cobrado, 'P'=Pago, 'I'=Isento, 'T'=Tributado, 'N'=Não se aplica

  // CEST
  cest?: string;
}

// Dados do cliente (cache)
export interface DadosCliente {
  codcli: string;
  nome: string;
  nome_fantasia?: string;
  tipo: TipoCliente;
  uf: string;
  cidade?: string;
  cnpj_cpf?: string;
  inscricao_estadual?: string;
  contribuinte_icms: boolean;
}

// Request da API /api/impostos/index.ts
export interface ImpostoRequest {
  // Dados básicos
  codProd: string;
  codCli: string;
  quantidade: number;
  valorUnitario: number;
  totalItem?: number;
  usarAuto?: boolean;

  // Tipo de operação
  tipoMovimentacao?: string;
  tipoOperacao?: string;
  tipoFatura?: string;
  zerarSubstituicao?: 'S' | 'N';

  // Modo de cálculo
  usarRegrasOracleProcedimento?: boolean; // true = usa regras do procedimento Oracle, false = usa valores do produto

  // Overrides opcionais
  uf_empresa?: string;
}

// Response da API /api/impostos/index.ts
export interface ImpostoResponse {
  cards: {
    valorIPI: number;
    valorICMS: number;
    valorICMS_Subst: number;
    valorPIS: number;
    valorCOFINS: number;
    totalImpostos: number;
    valorIBS?: number; // Informativo 2026
    valorCBS?: number; // Informativo 2026
  };
  aliquotas: {
    icms: number;
    ipi: number;
    pis: number;
    cofins: number;
    agregado: number;
    ibs?: number; // Informativo 2026
    cbs?: number; // Informativo 2026
  };
  // Valores em R$ para salvar no banco
  valores?: {
    totalicms: number;
    totalsubst_trib: number;
    totalipi: number;
    valorpis: number;
    valorcofins: number;
    valor_fcp: number;
    valorfcp_subst: number;
    ibs_valor: number; // Informativo 2026
    cbs_valor: number; // Informativo 2026
  };
  // Campos para salvar na dbitvenda
  campos?: {
    icms: number; // alíquota %
    baseicms: number;
    totalicms: number;
    icmsinterno_dest: number;
    icmsexterno_orig: number;
    csticms: string;

    mva: number;
    basesubst_trib: number;
    totalsubst_trib: number;

    ipi: number; // alíquota %
    baseipi: number;
    totalipi: number;
    cstipi: string;

    pis: number; // alíquota %
    basepis: number;
    valorpis: number;
    cstpis: string;

    cofins: number; // alíquota %
    basecofins: number;
    valorcofins: number;
    cstcofins: string;

    fcp: number;
    base_fcp: number;
    valor_fcp: number;
    fcp_subst: number;
    basefcp_subst: number;
    valorfcp_subst: number;

    cfop: string;
    tipocfop: string;
    ncm: string;

    totalproduto: number;
  };
  debug?: {
    input: any;
    uf: any;
    produto: any;
    mva: any;
    st?: any;
    cfop: string;
    observacao: string;
    ibs_cbs_informativo?: boolean;
  };
}

// Request da API /api/impostos/calcular-completo.ts
export interface CalculoCompletoRequest {
  itens: Array<{
    produto_id?: number;
    codprod: string;
    quantidade: number;
    valor_unitario: number;
    desconto?: number;
  }>;
  cliente_id?: number;
  codcli: string;
  tipo_operacao: string;
  data_emissao?: string;
  armazem_id?: number;
}

// Response da API /api/impostos/calcular-completo.ts
export interface CalculoCompletoResponse {
  ok: boolean;
  resultado?: ResultadoCalculoCompleto;
  error?: string;
}

// Validação de entrada
export interface ValidacaoResultado {
  valido: boolean;
  erros: string[];
  warnings: string[];
}

// Log de auditoria
export interface LogCalculoImposto {
  timestamp: Date;
  usuario?: string;
  filial: string;
  tipo_operacao: TipoOperacao;
  cliente_id: number;
  itens_count: number;
  valor_total: number;
  total_impostos: number;
  tempo_calculo_ms: number;
  observacoes: string[];
}
