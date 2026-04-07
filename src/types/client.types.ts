/**
 * Types and Interfaces for Legacy Client System (dbclien table)
 * Sistema de Clientes - Migração de Sistema Legado
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Tipo de Pessoa
 * F = Física, J = Jurídica
 */
export type TipoPessoa = 'F' | 'J';

/**
 * Tipo de Cliente
 * Revenda = Revenda
 * Financeiro = Financeiro
 * Produtor Rural = Produtor Rural
 * Solidário = Solidário
 * Exportador = Exportador
 */
export type TipoCliente =
  | 'Revenda'
  | 'Financeiro'
  | 'Produtor Rural'
  | 'Solidário'
  | 'Exportador';

/**
 * Situação Tributária
 * Não Contribuinte = Não Contribuinte
 * Lucro Presumido = Lucro Presumido
 * Lucro Real = Lucro Real
 * Simples Nacional = Simples Nacional
 */
export type SituacaoTributaria =
  | 'Não Contribuinte'
  | 'Lucro Presumido'
  | 'Lucro Real'
  | 'Simples Nacional';

/**
 * Unidades Federativas do Brasil
 */
export type UF =
  | 'AC'
  | 'AL'
  | 'AP'
  | 'AM'
  | 'BA'
  | 'CE'
  | 'DF'
  | 'ES'
  | 'GO'
  | 'MA'
  | 'MT'
  | 'MS'
  | 'MG'
  | 'PA'
  | 'PB'
  | 'PR'
  | 'PE'
  | 'PI'
  | 'RJ'
  | 'RN'
  | 'RS'
  | 'RO'
  | 'RR'
  | 'SC'
  | 'SP'
  | 'SE'
  | 'TO';

/**
 * Tipo de Endereço
 */
export type TipoEndereco = 'principal' | 'cobranca';

// ============================================================================
// INTERFACES - ENDEREÇO
// ============================================================================

/**
 * Interface para Endereço (Principal ou Cobrança)
 * Baseada em tabela legada de endereços
 */
export interface Address {
  /** ID do endereço (se existir na tabela legada) */
  id?: number;

  /** Código do cliente (FK) */
  codigo_cliente: number;

  /** Tipo do endereço */
  tipo: TipoEndereco;

  /** Logradouro (Rua, Avenida, etc.) */
  logradouro: string;

  /** Número do endereço */
  numero: string;

  /** Complemento (opcional) */
  complemento?: string | null;

  /** Bairro */
  bairro: string;

  /** Cidade */
  cidade: string;

  /** Unidade Federativa */
  uf: UF;

  /** CEP (formato: 12345-678 ou 12345678) */
  cep: string;

  /** País (padrão: Brasil) */
  pais?: string;

  /** Ponto de referência (opcional) */
  ponto_referencia?: string | null;

  /** Data de criação */
  created_at?: Date;

  /** Data de atualização */
  updated_at?: Date;
}

// ============================================================================
// INTERFACES - DADOS FINANCEIROS
// ============================================================================

/**
 * Interface para Dados Financeiros do Cliente
 * Pode estar na mesma tabela (dbclien) ou em tabela separada
 */
export interface FinancialData {
  /** Código do cliente (FK) */
  codigo_cliente: number;

  /** Limite de crédito (valor decimal) */
  limite_credito: number;

  /** Classe de pagamento (pode ser ID de outra tabela) */
  classe_pagamento?: string | null;

  /** Aceita atraso no pagamento */
  aceita_atraso: boolean;

  /** Contribuinte de ICMS */
  icms: boolean;

  /** Faixa financeira (classificação) */
  faixa_financeira?: number | null;

  /** Banco preferencial do cliente */
  banco?: string | null;

  /** Código do banco (opcional) */
  codigo_banco?: string | null;

  /** Agência (opcional) */
  agencia?: string | null;

  /** Conta corrente (opcional) */
  conta_corrente?: string | null;

  /** Data de criação */
  created_at?: Date;

  /** Data de atualização */
  updated_at?: Date;
}

// ============================================================================
// INTERFACES - CLIENTE PRINCIPAL
// ============================================================================

/**
 * Interface principal para Cliente (Tabela dbclien)
 * Representa a entidade principal do sistema legado
 */
export interface Client {
  /** Código único do cliente (PK) */
  codigo: number;

  /** Nome completo ou Razão Social */
  nome: string;

  /** Nome fantasia (para PJ) */
  nome_fantasia?: string | null;

  /** Email principal (obrigatório) */
  email_principal: string;

  /** Email secundário */
  email?: string | null;

  /** CPF ou CNPJ (único) */
  cpf_cnpj: string;

  /** Tipo de pessoa */
  tipo_pessoa: TipoPessoa;

  /** Tipo de cliente */
  tipo_cliente: TipoCliente;

  /** Situação tributária */
  situacao_tributaria: SituacaoTributaria;

  /** Classe de cliente (opcional) */
  classe_cliente?: string | null;

  // ========== SUFRAMA ==========
  /** Habilita SUFRAMA */
  habilita_suframa: boolean;

  /** Inscrição SUFRAMA (se aplicável) */
  inscricao_suframa?: string | null;

  // ========== INSCRIÇÕES ==========
  /** Inscrição Estadual */
  inscricao_estadual?: string | null;

  /** Inscrição Municipal */
  inscricao_municipal?: string | null;

  // ========== CONTATOS ==========
  /** Telefone principal */
  telefone?: string | null;

  /** Telefone secundário */
  telefone_secundario?: string | null;

  /** Celular */
  celular?: string | null;

  // ========== OUTROS DADOS ==========
  /** Observações gerais */
  observacoes?: string | null;

  /** Status ativo/inativo */
  ativo: boolean;

  /** Data de cadastro */
  data_cadastro?: Date;

  /** Data de criação no sistema */
  created_at?: Date;

  /** Data de última atualização */
  updated_at?: Date;
}

// ============================================================================
// INTERFACES - DTOs E FORMULÁRIOS
// ============================================================================

/**
 * DTO para criação de cliente (sem código)
 */
export type ClientCreateDTO = Omit<
  Client,
  'codigo' | 'created_at' | 'updated_at' | 'data_cadastro'
>;

/**
 * DTO para atualização de cliente (campos opcionais)
 */
export type ClientUpdateDTO = Partial<
  Omit<Client, 'codigo' | 'cpf_cnpj' | 'created_at' | 'updated_at'>
>;

/**
 * Interface completa para formulário de cliente
 * Inclui endereços e dados financeiros
 */
export interface ClientFormData {
  /** Dados principais do cliente */
  client: ClientCreateDTO;

  /** Endereço principal */
  endereco_principal: Omit<
    Address,
    'id' | 'codigo_cliente' | 'tipo' | 'created_at' | 'updated_at'
  >;

  /** Endereço de cobrança */
  endereco_cobranca: Omit<
    Address,
    'id' | 'codigo_cliente' | 'tipo' | 'created_at' | 'updated_at'
  >;

  /** Dados financeiros */
  dados_financeiros: Omit<
    FinancialData,
    'codigo_cliente' | 'created_at' | 'updated_at'
  >;
}

/**
 * Interface para resposta completa do cliente
 * Retornada em queries que incluem relacionamentos
 */
export interface ClientWithRelations extends Client {
  /** Endereço principal */
  endereco_principal?: Address;

  /** Endereço de cobrança */
  endereco_cobranca?: Address;

  /** Dados financeiros */
  dados_financeiros?: FinancialData;
}

// ============================================================================
// MAPEAMENTO DE CAMPOS LEGADOS (para referência)
// ============================================================================

/**
 * Mapeamento de campos legados da tabela dbclien
 * Use este tipo para mapear resultados de queries SQL legadas
 */
export interface DbClienLegacyRow {
  CODIGO: number;
  NOME: string;
  NOME_FANTASIA?: string;
  EMAIL?: string;
  CPF_CNPJ: string;
  TIPO_PESSOA: string;
  TIPO_CLIENTE: string;
  SITUACAO_TRIBUTARIA?: string;
  HABILITA_SUFRAMA: string | boolean; // Pode ser 'S'/'N' ou boolean
  INSCRICAO_SUFRAMA?: string;
  INSCRICAO_ESTADUAL?: string;
  INSCRICAO_MUNICIPAL?: string;
  TELEFONE?: string;
  TELEFONE_SECUNDARIO?: string;
  CELULAR?: string;
  OBSERVACOES?: string;
  ATIVO: string | boolean; // Pode ser 'S'/'N' ou boolean
  DATA_CADASTRO?: Date;
  CREATED_AT?: Date;
  UPDATED_AT?: Date;
}

/**
 * Função helper para converter row legado em Client
 */
export function mapLegacyRowToClient(row: DbClienLegacyRow): Client {
  return {
    codigo: row.CODIGO,
    nome: row.NOME,
    nome_fantasia: row.NOME_FANTASIA || null,
    email_principal: row.EMAIL || 'sem-email@example.com', // Campo obrigatório, fallback
    email: row.EMAIL || null,
    cpf_cnpj: row.CPF_CNPJ,
    tipo_pessoa: row.TIPO_PESSOA as TipoPessoa,
    tipo_cliente: row.TIPO_CLIENTE as TipoCliente,
    situacao_tributaria: row.SITUACAO_TRIBUTARIA as SituacaoTributaria,
    classe_cliente: null,
    habilita_suframa:
      typeof row.HABILITA_SUFRAMA === 'string'
        ? row.HABILITA_SUFRAMA === 'S'
        : row.HABILITA_SUFRAMA,
    inscricao_suframa: row.INSCRICAO_SUFRAMA || null,
    inscricao_estadual: row.INSCRICAO_ESTADUAL || null,
    inscricao_municipal: row.INSCRICAO_MUNICIPAL || null,
    telefone: row.TELEFONE || null,
    telefone_secundario: row.TELEFONE_SECUNDARIO || null,
    celular: row.CELULAR || null,
    observacoes: row.OBSERVACOES || null,
    ativo: typeof row.ATIVO === 'string' ? row.ATIVO === 'S' : row.ATIVO,
    data_cadastro: row.DATA_CADASTRO,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}
