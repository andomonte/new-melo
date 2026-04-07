/**
 * Zod Validation Schemas for Client System
 * Schemas de Validação para Sistema de Clientes
 */

import { z } from 'zod';

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/** Regex para validar CPF (apenas números) */
const CPF_REGEX = /^\d{11}$/;

/** Regex para validar CNPJ (apenas números) */
const CNPJ_REGEX = /^\d{14}$/;

/** Regex para validar CEP (com ou sem hífen) */
const CEP_REGEX = /^\d{5}-?\d{3}$/;

/** Regex para validar telefone brasileiro */
const TELEFONE_REGEX = /^(\d{2})?\d{8,9}$/;

/** Regex para validar email */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Valida CPF (algoritmo completo)
 */
function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // Sequências iguais

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

/**
 * Valida CNPJ (algoritmo completo)
 */
function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '');

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // Sequências iguais

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ baseado no tamanho
 */
function validarCpfCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return validarCPF(cleaned);
  } else if (cleaned.length === 14) {
    return validarCNPJ(cleaned);
  }

  return false;
}

// ============================================================================
// ENUMS SCHEMAS
// ============================================================================

/** Schema para Tipo de Pessoa */
export const TipoPessoaSchema = z.enum(['F', 'J'], {
  errorMap: () => ({
    message: "Tipo de pessoa deve ser 'F' (Física) ou 'J' (Jurídica)",
  }),
});

/** Schema para Tipo de Cliente */
export const TipoClienteSchema = z.enum(
  ['Revenda', 'Financeiro', 'Produtor Rural', 'Solidário', 'Exportador'],
  {
    errorMap: () => ({
      message:
        "Tipo de cliente deve ser 'Revenda', 'Financeiro', 'Produtor Rural', 'Solidário' ou 'Exportador'",
    }),
  },
);

/** Schema para Situação Tributária */
export const SituacaoTributariaSchema = z.enum(
  ['Não Contribuinte', 'Lucro Presumido', 'Lucro Real', 'Simples Nacional'],
  {
    errorMap: () => ({
      message:
        "Situação tributária deve ser 'Não Contribuinte', 'Lucro Presumido', 'Lucro Real' ou 'Simples Nacional'",
    }),
  },
);

/** Schema para UF */
export const UFSchema = z.enum(
  [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ],
  {
    errorMap: () => ({ message: 'UF inválida' }),
  },
);

/** Schema para Tipo de Endereço */
export const TipoEnderecoSchema = z.enum(['principal', 'cobranca'], {
  errorMap: () => ({
    message: "Tipo de endereço deve ser 'principal' ou 'cobranca'",
  }),
});

// ============================================================================
// ADDRESS SCHEMA
// ============================================================================

/** Schema de validação para Endereço */
export const AddressSchema = z.object({
  id: z.number().int().positive().optional(),
  codigo_cliente: z.number().int().positive({
    message: 'Código do cliente é obrigatório',
  }),
  tipo: TipoEnderecoSchema,
  logradouro: z
    .string()
    .min(3, 'Logradouro deve ter no mínimo 3 caracteres')
    .max(200, 'Logradouro deve ter no máximo 200 caracteres')
    .trim(),
  numero: z
    .string()
    .min(1, 'Número é obrigatório')
    .max(20, 'Número deve ter no máximo 20 caracteres')
    .trim(),
  complemento: z
    .string()
    .max(100, 'Complemento deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),
  bairro: z
    .string()
    .min(2, 'Bairro deve ter no mínimo 2 caracteres')
    .max(100, 'Bairro deve ter no máximo 100 caracteres')
    .trim(),
  cidade: z
    .string()
    .min(2, 'Cidade deve ter no mínimo 2 caracteres')
    .max(100, 'Cidade deve ter no máximo 100 caracteres')
    .trim(),
  uf: UFSchema,
  cep: z
    .string()
    .regex(CEP_REGEX, 'CEP inválido (formato: 12345-678 ou 12345678)')
    .transform((val) => val.replace(/\D/g, '')), // Remove hífen
  pais: z
    .string()
    .max(100, 'País deve ter no máximo 100 caracteres')
    .default('Brasil')
    .optional(),
  ponto_referencia: z
    .string()
    .max(200, 'Ponto de referência deve ter no máximo 200 caracteres')
    .trim()
    .nullable()
    .optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

/** Schema para criação de endereço (sem ID) */
export const AddressCreateSchema = AddressSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

/** Schema para atualização de endereço */
export const AddressUpdateSchema = AddressSchema.omit({
  codigo_cliente: true,
  created_at: true,
  updated_at: true,
}).partial();

// ============================================================================
// FINANCIAL DATA SCHEMA
// ============================================================================

/** Schema de validação para Dados Financeiros */
export const FinancialDataSchema = z.object({
  codigo_cliente: z.number().int().positive({
    message: 'Código do cliente é obrigatório',
  }),
  limite_credito: z
    .number()
    .nonnegative('Limite de crédito não pode ser negativo')
    .multipleOf(0.01, 'Limite de crédito deve ter no máximo 2 casas decimais')
    .default(0),
  classe_pagamento: z
    .string()
    .max(50, 'Classe de pagamento deve ter no máximo 50 caracteres')
    .trim()
    .nullable()
    .optional(),
  aceita_atraso: z.boolean().default(false),
  icms: z.boolean().default(false),
  faixa_financeira: z
    .number()
    .int('Faixa financeira deve ser um número inteiro')
    .min(1, 'Faixa financeira deve ser no mínimo 1')
    .max(10, 'Faixa financeira deve ser no máximo 10')
    .nullable()
    .optional(),
  banco: z
    .string()
    .max(100, 'Nome do banco deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),
  codigo_banco: z
    .string()
    .length(3, 'Código do banco deve ter 3 dígitos')
    .regex(/^\d{3}$/, 'Código do banco deve conter apenas números')
    .nullable()
    .optional(),
  agencia: z
    .string()
    .max(10, 'Agência deve ter no máximo 10 caracteres')
    .trim()
    .nullable()
    .optional(),
  conta_corrente: z
    .string()
    .max(20, 'Conta corrente deve ter no máximo 20 caracteres')
    .trim()
    .nullable()
    .optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

/** Schema para criação de dados financeiros */
export const FinancialDataCreateSchema = FinancialDataSchema.omit({
  created_at: true,
  updated_at: true,
});

/** Schema para atualização de dados financeiros */
export const FinancialDataUpdateSchema = FinancialDataSchema.omit({
  codigo_cliente: true,
  created_at: true,
  updated_at: true,
}).partial();

// ============================================================================
// CLIENT SCHEMA
// ============================================================================

/** Schema de validação para Cliente */
export const ClientSchema = z.object({
  codigo: z.number().int().positive({
    message: 'Código do cliente é obrigatório',
  }),
  nome: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .trim(),
  nome_fantasia: z
    .string()
    .min(3, 'Nome fantasia deve ter no mínimo 3 caracteres')
    .max(200, 'Nome fantasia deve ter no máximo 200 caracteres')
    .trim()
    .nullable()
    .optional(),
  email_principal: z
    .string()
    .regex(EMAIL_REGEX, 'Email inválido')
    .max(150, 'Email deve ter no máximo 150 caracteres')
    .toLowerCase()
    .trim()
    .min(1, 'Email principal é obrigatório'),
  email: z
    .string()
    .regex(EMAIL_REGEX, 'Email inválido')
    .max(150, 'Email deve ter no máximo 150 caracteres')
    .toLowerCase()
    .trim()
    .nullable()
    .optional(),
  cpf_cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, '')) // Remove caracteres especiais
    .refine(validarCpfCnpj, {
      message: 'CPF ou CNPJ inválido',
    }),
  tipo_pessoa: TipoPessoaSchema,
  tipo_cliente: TipoClienteSchema,
  situacao_tributaria: SituacaoTributariaSchema,
  classe_cliente: z
    .string()
    .max(100, 'Classe de cliente deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),
  habilita_suframa: z.boolean().default(false),
  inscricao_suframa: z
    .string()
    .max(50, 'Inscrição SUFRAMA deve ter no máximo 50 caracteres')
    .trim()
    .nullable()
    .optional(),
  inscricao_estadual: z
    .string()
    .max(50, 'Inscrição Estadual deve ter no máximo 50 caracteres')
    .trim()
    .nullable()
    .optional(),
  inscricao_municipal: z
    .string()
    .max(50, 'Inscrição Municipal deve ter no máximo 50 caracteres')
    .trim()
    .nullable()
    .optional(),
  telefone: z
    .string()
    .regex(TELEFONE_REGEX, 'Telefone inválido')
    .transform((val) => val.replace(/\D/g, ''))
    .nullable()
    .optional(),
  telefone_secundario: z
    .string()
    .regex(TELEFONE_REGEX, 'Telefone secundário inválido')
    .transform((val) => val.replace(/\D/g, ''))
    .nullable()
    .optional(),
  celular: z
    .string()
    .regex(TELEFONE_REGEX, 'Celular inválido')
    .transform((val) => val.replace(/\D/g, ''))
    .nullable()
    .optional(),
  observacoes: z
    .string()
    .max(1000, 'Observações devem ter no máximo 1000 caracteres')
    .trim()
    .nullable()
    .optional(),
  ativo: z.boolean().default(true),
  data_cadastro: z.date().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

/** Schema base sem refinements para permitir omit */
const ClientBaseSchema = ClientSchema;

/** Schema para criação de cliente */
export const ClientCreateSchema = ClientBaseSchema.omit({
  codigo: true,
  data_cadastro: true,
  created_at: true,
  updated_at: true,
}).refine(
  (data) => {
    // Se habilita SUFRAMA, deve ter inscrição SUFRAMA e Estadual
    if (data.habilita_suframa) {
      if (!data.inscricao_suframa || !data.inscricao_estadual) {
        return false;
      }
    }
    return true;
  },
  {
    message:
      'Inscrição SUFRAMA e Inscrição Estadual são obrigatórias quando SUFRAMA está habilitado',
    path: ['inscricao_suframa'],
  },
);

/** Schema para atualização de cliente */
export const ClientUpdateSchema = ClientBaseSchema.omit({
  codigo: true,
  cpf_cnpj: true, // CPF/CNPJ não pode ser alterado
  created_at: true,
  updated_at: true,
}).partial();

// ============================================================================
// FORMULÁRIO COMPLETO
// ============================================================================

/** Schema para formulário completo de cliente (criação) */
export const ClientFormSchema = z
  .object({
    client: ClientCreateSchema,
    endereco_principal: AddressCreateSchema.omit({
      codigo_cliente: true,
      tipo: true,
    }),
    endereco_cobranca: AddressCreateSchema.omit({
      codigo_cliente: true,
      tipo: true,
    }),
    dados_financeiros: FinancialDataCreateSchema.omit({
      codigo_cliente: true,
    }),
  })
  .refine(
    (data) => {
      // Validação: CEPs não podem ser iguais se endereços são diferentes
      const cep1 = data.endereco_principal.cep.replace(/\D/g, '');
      const cep2 = data.endereco_cobranca.cep.replace(/\D/g, '');

      // Se CEPs são iguais, outros campos também devem ser
      if (cep1 === cep2) {
        return (
          data.endereco_principal.logradouro ===
            data.endereco_cobranca.logradouro &&
          data.endereco_principal.numero === data.endereco_cobranca.numero
        );
      }
      return true;
    },
    {
      message: 'Endereços com mesmo CEP devem ter logradouro e número iguais',
      path: ['endereco_cobranca', 'cep'],
    },
  );

// ============================================================================
// SCHEMAS PARA BUSCA E FILTROS
// ============================================================================

/** Schema para parâmetros de busca de clientes */
export const ClientSearchSchema = z.object({
  nome: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  tipo_pessoa: TipoPessoaSchema.optional(),
  tipo_cliente: TipoClienteSchema.optional(),
  ativo: z.boolean().optional(),
  limite: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  ordenar_por: z.enum(['nome', 'codigo', 'data_cadastro']).default('nome'),
  ordem: z.enum(['asc', 'desc']).default('asc'),
});

/** Schema para validação de código de cliente */
export const CodigoClienteSchema = z.object({
  codigo: z.number().int().positive({
    message: 'Código do cliente inválido',
  }),
});

/** Schema para validação de CPF/CNPJ único */
export const CpfCnpjUnicoSchema = z.object({
  cpf_cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine(validarCpfCnpj, {
      message: 'CPF ou CNPJ inválido',
    }),
});

// ============================================================================
// TYPE EXPORTS (inferidos dos schemas)
// ============================================================================

export type TipoPessoa = z.infer<typeof TipoPessoaSchema>;
export type TipoCliente = z.infer<typeof TipoClienteSchema>;
export type SituacaoTributaria = z.infer<typeof SituacaoTributariaSchema>;
export type UF = z.infer<typeof UFSchema>;
export type TipoEndereco = z.infer<typeof TipoEnderecoSchema>;

export type Address = z.infer<typeof AddressSchema>;
export type AddressCreate = z.infer<typeof AddressCreateSchema>;
export type AddressUpdate = z.infer<typeof AddressUpdateSchema>;

export type FinancialData = z.infer<typeof FinancialDataSchema>;
export type FinancialDataCreate = z.infer<typeof FinancialDataCreateSchema>;
export type FinancialDataUpdate = z.infer<typeof FinancialDataUpdateSchema>;

export type Client = z.infer<typeof ClientSchema>;
export type ClientCreate = z.infer<typeof ClientCreateSchema>;
export type ClientUpdate = z.infer<typeof ClientUpdateSchema>;

export type ClientForm = z.infer<typeof ClientFormSchema>;
export type ClientSearch = z.infer<typeof ClientSearchSchema>;
