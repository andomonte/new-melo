/**
 * Schemas de Validação para Sistema de Impostos IBS/CBS
 * Nova Legislação - Reforma Tributária (2026+)
 */

import { z } from 'zod';

// ============================================================================
// ENUMS E CONSTANTES
// ============================================================================

/** Tipos de Movimentação */
export const TipoMovimentacaoSchema = z.enum([
  'ENTRADA_COMPRAS',
  'ENTRADA',
  'SAIDA',
]);

/** Tipos de Operação */
export const TipoOperacaoSchema = z.enum([
  'COMPRA',
  'VENDA',
  'TRANSFERENCIA',
  'DEVOLUCAO_VENDA',
  'DEVOLUCAO_COMPRA',
  'BONIFICACAO',
  'EXPOSICAO',
  'DEMONSTRACAO',
  'GARANTIA',
  'CONSERTO',
  'REMESSA',
  'RETORNO',
]);

/** Tipo de Fatura */
export const TipoFaturaSchema = z.enum(['NOTA_FISCAL', 'FAG']);

/** Regime Tributário do Cliente/Fornecedor */
export const RegimeTributarioSchema = z.enum([
  'REGIME_REGULAR',
  'SIMPLES_NACIONAL',
  'MEI',
  'ISENTO',
  'IMUNE',
]);

/** Tipo de Contribuinte IBS/CBS */
export const TipoContribuinteSchema = z.enum([
  'CONTRIBUINTE_B2B', // Pessoa Jurídica com direito a crédito
  'CONTRIBUINTE_B2C', // Consumidor final pessoa jurídica
  'CONSUMIDOR_FINAL_PF', // Pessoa Física consumidor final
  'EXPORTACAO', // Operação de exportação (alíquota zero)
]);

/** Categoria de Alíquota IBS/CBS */
export const CategoriaAliquotaSchema = z.enum([
  'PADRAO', // Alíquota padrão (27% estimado)
  'REDUZIDA_50', // 50% da alíquota padrão
  'REDUZIDA_60', // 60% da alíquota padrão (alguns casos específicos)
  'ZERO', // Alíquota zero (exportação, alguns produtos essenciais)
  'ESPECIFICA', // Regime específico setorial
]);

/** UF brasileiras */
export const UFSchema = z.enum([
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
]);

// ============================================================================
// SCHEMAS DE PRODUTO
// ============================================================================

/** Schema de Produto com dados fiscais IBS/CBS */
export const ProdutoFiscalSchema = z.object({
  codigo: z.string().min(1, 'Código do produto é obrigatório'),
  descricao: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  ncm: z
    .string()
    .length(8, 'NCM deve ter 8 dígitos')
    .regex(/^\d{8}$/, 'NCM deve conter apenas números'),
  cest: z
    .string()
    .length(7, 'CEST deve ter 7 dígitos')
    .regex(/^\d{7}$/, 'CEST deve conter apenas números')
    .nullable()
    .optional(),
  categoria_aliquota: CategoriaAliquotaSchema,
  aliquota_ibs: z.number().min(0).max(100), // Percentual
  aliquota_cbs: z.number().min(0).max(100), // Percentual
  aliquota_especifica: z.number().min(0).max(100).nullable().optional(), // Para regimes especiais
  permite_credito: z.boolean().default(true), // Se permite creditamento na próxima etapa
  elegivel_cashback: z.boolean().default(false), // Se é elegível para cashback
  percentual_cashback_ibs: z.number().min(0).max(100).nullable().optional(),
  percentual_cashback_cbs: z.number().min(0).max(100).nullable().optional(),
  regime_especifico: z.string().max(100).nullable().optional(), // Ex: "Automotivo"
  observacoes_fiscais: z.string().max(500).nullable().optional(),
});

// ============================================================================
// SCHEMAS DE PARTICIPANTE (CLIENTE/FORNECEDOR)
// ============================================================================

/** Schema de Participante com dados fiscais IBS/CBS */
export const ParticipanteFiscalSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf_cnpj: z
    .string()
    .min(11, 'CPF/CNPJ inválido')
    .max(14, 'CPF/CNPJ inválido')
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 ou CNPJ 14 dígitos'),
  tipo_pessoa: z.enum(['F', 'J']),
  uf: UFSchema,
  municipio_ibge: z
    .string()
    .length(7, 'Código IBGE deve ter 7 dígitos')
    .regex(/^\d{7}$/, 'Código IBGE deve conter apenas números'),
  tipo_contribuinte: TipoContribuinteSchema,
  regime_tributario: RegimeTributarioSchema,
  inscricao_ibs_cbs: z.string().max(50).nullable().optional(), // Inscrição no novo sistema (quando disponível)
  inscricao_estadual: z.string().max(50).nullable().optional(), // Mantido para transição
  elegivel_cashback: z.boolean().default(false), // Se está no CadÚnico
  cpf_cadastro_unico: z
    .string()
    .length(11)
    .regex(/^\d{11}$/)
    .nullable()
    .optional(), // Para cashback
});

// ============================================================================
// SCHEMA DE CÁLCULO IBS/CBS
// ============================================================================

/** Schema de entrada para cálculo de impostos */
export const CalculoImpostoInputSchema = z.object({
  // Contexto da operação
  tipo_movimentacao: TipoMovimentacaoSchema,
  tipo_operacao: TipoOperacaoSchema,
  tipo_fatura: TipoFaturaSchema,

  // Dados do produto
  codigo_produto: z.string().min(1, 'Código do produto é obrigatório'),

  // Dados do participante (cliente/fornecedor)
  codigo_participante: z
    .string()
    .min(1, 'Código do participante é obrigatório'),

  // Valores da operação
  quantidade: z.number().positive('Quantidade deve ser positiva'),
  valor_unitario: z
    .number()
    .nonnegative('Valor unitário não pode ser negativo'),
  valor_total_produto: z.number().positive('Valor total deve ser positivo'),

  // Descontos e acréscimos
  valor_desconto: z.number().nonnegative().default(0),
  valor_acrescimo: z.number().nonnegative().default(0),
  valor_frete: z.number().nonnegative().default(0),
  valor_seguro: z.number().nonnegative().default(0),
  outras_despesas: z.number().nonnegative().default(0),

  // Créditos acumulados (para não-cumulatividade)
  credito_ibs_disponivel: z.number().nonnegative().default(0),
  credito_cbs_disponivel: z.number().nonnegative().default(0),

  // Opções específicas
  aplicar_cashback: z.boolean().default(false),
  operacao_exportacao: z.boolean().default(false), // Alíquota zero

  // Dados opcionais para transição (2026-2033)
  ano_operacao: z.number().int().min(2026).max(2033).default(2033), // Padrão: sistema completo
});

/** Schema de saída do cálculo */
export const CalculoImpostoOutputSchema = z.object({
  // Resumo da operação
  operacao: z.object({
    tipo_movimentacao: TipoMovimentacaoSchema,
    tipo_operacao: TipoOperacaoSchema,
    codigo_produto: z.string(),
    codigo_participante: z.string(),
  }),

  // Bases de cálculo
  bases: z.object({
    valor_produtos: z.number(),
    valor_desconto: z.number(),
    valor_acrescimo: z.number(),
    valor_frete: z.number(),
    valor_seguro: z.number(),
    outras_despesas: z.number(),
    base_calculo_ibs: z.number(),
    base_calculo_cbs: z.number(),
  }),

  // Alíquotas aplicadas
  aliquotas: z.object({
    aliquota_ibs: z.number(),
    aliquota_cbs: z.number(),
    aliquota_combinada: z.number(),
    categoria_aliquota: CategoriaAliquotaSchema,
  }),

  // Valores calculados
  tributos: z.object({
    valor_ibs: z.number(),
    valor_cbs: z.number(),
    total_tributos: z.number(),
  }),

  // Créditos (não-cumulatividade)
  creditos: z.object({
    credito_ibs_gerado: z.number(), // Crédito para próxima etapa
    credito_cbs_gerado: z.number(),
    credito_ibs_utilizado: z.number(), // Crédito usado nesta operação
    credito_cbs_utilizado: z.number(),
  }),

  // Cashback (se aplicável)
  cashback: z
    .object({
      elegivel: z.boolean(),
      valor_ibs_devolvido: z.number(),
      valor_cbs_devolvido: z.number(),
      total_cashback: z.number(),
    })
    .nullable()
    .optional(),

  // Totais finais
  totais: z.object({
    valor_liquido_operacao: z.number(), // Sem tributos
    valor_tributos: z.number(),
    valor_total_nota: z.number(), // Com tributos
    valor_efetivo_cliente: z.number(), // Total - cashback (se aplicável)
  }),

  // Informações adicionais
  metadata: z.object({
    data_calculo: z.string(),
    ano_legislacao: z.number(),
    regime_transicao: z.boolean(),
    observacoes: z.array(z.string()).optional(),
  }),
});

// ============================================================================
// SCHEMAS PARA TABELAS DE CONFIGURAÇÃO
// ============================================================================

/** Tabela de Alíquotas IBS/CBS por NCM */
export const TabelaAliquotaNCMSchema = z.object({
  ncm: z
    .string()
    .length(8)
    .regex(/^\d{8}$/),
  descricao_ncm: z.string().max(500),
  categoria_aliquota: CategoriaAliquotaSchema,
  aliquota_ibs_padrao: z.number().min(0).max(100), // % (estimativa: 27%)
  aliquota_cbs_padrao: z.number().min(0).max(100), // % (estimativa: 10%)
  aliquota_ibs_aplicavel: z.number().min(0).max(100), // Pode ser reduzida
  aliquota_cbs_aplicavel: z.number().min(0).max(100), // Pode ser reduzida
  permite_credito: z.boolean().default(true),
  elegivel_cashback: z.boolean().default(false),
  percentual_cashback_ibs: z.number().min(0).max(100).nullable().optional(),
  percentual_cashback_cbs: z.number().min(0).max(100).nullable().optional(),
  regime_especifico: z.string().max(100).nullable().optional(), // Ex: "Regime Automotivo"
  observacoes: z.string().max(1000).nullable().optional(),
  vigencia_inicio: z.date(),
  vigencia_fim: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

/** Tabela de Cronograma de Transição (2026-2033) */
export const TabelaTransicaoSchema = z.object({
  ano: z.number().int().min(2026).max(2033),
  aliquota_cbs: z.number().min(0).max(100), // Cresce gradualmente
  aliquota_ibs: z.number().min(0).max(100), // Cresce gradualmente
  aliquota_icms_residual: z.number().min(0).max(100).nullable().optional(), // Diminui
  aliquota_iss_residual: z.number().min(0).max(100).nullable().optional(), // Diminui
  sistema_completo: z.boolean(), // true apenas em 2033
  observacoes: z.string().max(500).nullable().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TipoMovimentacao = z.infer<typeof TipoMovimentacaoSchema>;
export type TipoOperacao = z.infer<typeof TipoOperacaoSchema>;
export type TipoFatura = z.infer<typeof TipoFaturaSchema>;
export type RegimeTributario = z.infer<typeof RegimeTributarioSchema>;
export type TipoContribuinte = z.infer<typeof TipoContribuinteSchema>;
export type CategoriaAliquota = z.infer<typeof CategoriaAliquotaSchema>;
export type UF = z.infer<typeof UFSchema>;

export type ProdutoFiscal = z.infer<typeof ProdutoFiscalSchema>;
export type ParticipanteFiscal = z.infer<typeof ParticipanteFiscalSchema>;
export type CalculoImpostoInput = z.infer<typeof CalculoImpostoInputSchema>;
export type CalculoImpostoOutput = z.infer<typeof CalculoImpostoOutputSchema>;
export type TabelaAliquotaNCM = z.infer<typeof TabelaAliquotaNCMSchema>;
export type TabelaTransicao = z.infer<typeof TabelaTransicaoSchema>;
