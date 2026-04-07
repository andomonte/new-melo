import { z } from 'zod';

// ==================== HELPERS DE PREPROCESSAMENTO ====================

/**
 * Helper para preprocessar números - converte strings vazias em undefined e aceita 0
 * Garante que valores numéricos sejam corretamente interpretados
 */
const numberPreprocessor = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}, z.number().optional().nullable());

/**
 * Helper para preprocessar números decimais com validação de range
 * @param min - Valor mínimo permitido
 * @param max - Valor máximo permitido
 * @param message - Mensagem de erro personalizada
 */
const decimalPreprocessor = (min: number, max: number, message?: string) =>
  z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z
      .number()
      .min(min, { message: message || `Valor deve ser no mínimo ${min}.` })
      .max(max, { message: message || `Valor máximo permitido é ${max}.` })
      .optional()
      .nullable(),
  );

/**
 * Helper para preprocessar strings - normaliza trim e uppercase quando necessário
 * Remove espaços extras e garante formato consistente
 */
const stringPreprocessor = (options?: {
  uppercase?: boolean;
  lowercase?: boolean;
  trim?: boolean;
}) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    let str = String(val);

    if (options?.trim !== false) {
      str = str.trim();
    }

    if (options?.uppercase) {
      str = str.toUpperCase();
    } else if (options?.lowercase) {
      str = str.toLowerCase();
    }

    return str === '' ? undefined : str;
  }, z.string());

// ==================== SCHEMA BASE ====================

export const grupoProdutoSchema = z.object({
  // ===== CAMPOS OBRIGATÓRIOS =====

  /**
   * Código do grupo de produtos (PK)
   * - Max 5 caracteres
   * - Normalizado para UPPERCASE
   * - Sem espaços em branco
   */
  codgpp: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .min(1, { message: 'Código do grupo de produtos é obrigatório.' })
        .max(5, {
          message:
            'Código do grupo de produtos deve ter no máximo 5 caracteres.',
        })
        .regex(/^[A-Z0-9]+$/, {
          message:
            'Código deve conter apenas letras maiúsculas e números, sem espaços.',
        }),
    )
    .optional(),

  /**
   * Descrição do grupo de produtos (UNIQUE)
   * - Max 30 caracteres
   * - Normalizado para UPPERCASE
   * - Sem espaços extras no início/fim
   */
  descr: stringPreprocessor({ uppercase: true }).pipe(
    z
      .string({ required_error: 'Descrição é obrigatória.' })
      .min(1, { message: 'Descrição não pode ser vazia.' })
      .max(30, { message: 'Descrição deve ter no máximo 30 caracteres.' })
      .regex(/^[A-Z0-9\s\-\/\.]+$/, {
        message:
          'Descrição deve conter apenas letras, números, espaços e caracteres: - / .',
      }),
  ),

  // ===== CAMPOS OPCIONAIS - CÓDIGOS =====

  codvend: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .max(5, {
          message: 'Código do vendedor deve ter no máximo 5 caracteres.',
        }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  codseg: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .max(5, {
          message: 'Código do segmento deve ter no máximo 5 caracteres.',
        }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  codcomprador: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .max(3, {
          message: 'Código do comprador deve ter no máximo 3 caracteres.',
        }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  ramonegocio: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .max(1, { message: 'Ramo de negócio deve ter no máximo 1 caracter.' })
        .regex(/^[SN]?$/, { message: 'Ramo de negócio deve ser S ou N.' }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  codgpc: stringPreprocessor()
    .pipe(
      z
        .string()
        .max(4, { message: 'Código GPC deve ter no máximo 4 caracteres.' }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  bloquear_preco: stringPreprocessor({ uppercase: true })
    .pipe(
      z
        .string()
        .max(1, { message: 'Bloquear preço deve ter no máximo 1 caracter.' })
        .regex(/^[SN]?$/, { message: 'Bloquear preço deve ser S ou N.' }),
    )
    .optional()
    .nullable()
    .or(z.literal('')),

  // ===== CAMPOS NUMÉRICOS - DESCONTOS =====

  descbalcao: decimalPreprocessor(
    0,
    999.99,
    'Desconto balcão deve estar entre 0 e 999.99.',
  ),
  dscrev30: decimalPreprocessor(
    0,
    999.99,
    'Desconto revisão 30 dias deve estar entre 0 e 999.99.',
  ),
  dscrev45: decimalPreprocessor(
    0,
    999.99,
    'Desconto revisão 45 dias deve estar entre 0 e 999.99.',
  ),
  dscrev60: decimalPreprocessor(
    0,
    999.99,
    'Desconto revisão 60 dias deve estar entre 0 e 999.99.',
  ),
  dscrv30: decimalPreprocessor(
    0,
    999.99,
    'Desconto revenda 30 dias deve estar entre 0 e 999.99.',
  ),
  dscrv45: decimalPreprocessor(
    0,
    999.99,
    'Desconto revenda 45 dias deve estar entre 0 e 999.99.',
  ),
  dscrv60: decimalPreprocessor(
    0,
    999.99,
    'Desconto revenda 60 dias deve estar entre 0 e 999.99.',
  ),
  dscbv30: decimalPreprocessor(
    0,
    999.99,
    'Desconto balcão 30 dias deve estar entre 0 e 999.99.',
  ),
  dscbv45: decimalPreprocessor(
    0,
    999.99,
    'Desconto balcão 45 dias deve estar entre 0 e 999.99.',
  ),
  dscbv60: decimalPreprocessor(
    0,
    999.99,
    'Desconto balcão 60 dias deve estar entre 0 e 999.99.',
  ),
  dscpv30: decimalPreprocessor(
    0,
    999.99,
    'Desconto prazo 30 dias deve estar entre 0 e 999.99.',
  ),
  dscpv45: decimalPreprocessor(
    0,
    999.99,
    'Desconto prazo 45 dias deve estar entre 0 e 999.99.',
  ),
  dscpv60: decimalPreprocessor(
    0,
    999.99,
    'Desconto prazo 60 dias deve estar entre 0 e 999.99.',
  ),
  DSCBALCAO: decimalPreprocessor(
    0,
    999.99,
    'DSCBALCAO deve estar entre 0 e 999.99.',
  ),

  // ===== CAMPOS NUMÉRICOS - COMISSÕES =====

  comgpp: decimalPreprocessor(
    0,
    9.99,
    'Comissão GPP deve estar entre 0 e 9.99.',
  ),
  comgpptmk: decimalPreprocessor(
    0,
    9.99,
    'Comissão GPP Telemarketing deve estar entre 0 e 9.99.',
  ),
  comgppextmk: decimalPreprocessor(
    0,
    9.99,
    'Comissão GPP Ext. Telemarketing deve estar entre 0 e 9.99.',
  ),

  // ===== CAMPOS NUMÉRICOS - OUTROS =====

  diasreposicao: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().int('Dias de reposição deve ser um número inteiro.').min(0, { message: 'Dias de reposição deve ser positivo.' }).max(365, { message: 'Dias de reposição deve ser no máximo 365 dias.' }).optional().nullable()),

  gpp_id: numberPreprocessor,

  p_comercial: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().int('P. Comercial deve ser um número inteiro.').min(0, { message: 'P. Comercial deve ser positivo ou zero.' }).optional().nullable()),

  v_marketing: decimalPreprocessor(
    0,
    999.99,
    'Valor marketing deve estar entre 0 e 999.99.',
  ),
  margem_min_venda: decimalPreprocessor(
    0,
    99999.99,
    'Margem mínima de venda deve estar entre 0 e 99999.99.',
  ),
  margem_med_venda: decimalPreprocessor(
    0,
    99999.99,
    'Margem média de venda deve estar entre 0 e 99999.99.',
  ),
  margem_ide_venda: decimalPreprocessor(
    0,
    99999.99,
    'Margem ideal de venda deve estar entre 0 e 99999.99.',
  ),
  codgrupai: numberPreprocessor,
  codgrupoprod: numberPreprocessor,
});

// ==================== SCHEMA COM REFINAMENTOS ====================

/**
 * Schema para criação de grupo de produtos
 * - codgpp é obrigatório
 * - descr é obrigatório e unique (validação no backend)
 * - Validações de consistência entre margens
 */
export const createGrupoProdutoSchema = grupoProdutoSchema
  .extend({
    codgpp: stringPreprocessor({ uppercase: true }).pipe(
      z
        .string({
          required_error:
            'Código do grupo de produtos é obrigatório para criação.',
        })
        .min(1, { message: 'Código do grupo de produtos não pode ser vazio.' })
        .max(5, {
          message:
            'Código do grupo de produtos deve ter no máximo 5 caracteres.',
        })
        .regex(/^[A-Z0-9]+$/, {
          message:
            'Código deve conter apenas letras maiúsculas e números, sem espaços.',
        }),
    ),
  })
  .refine(
    (data) => {
      // Validação: margem_min <= margem_med <= margem_ide
      if (
        data.margem_min_venda !== undefined &&
        data.margem_min_venda !== null &&
        data.margem_med_venda !== undefined &&
        data.margem_med_venda !== null &&
        data.margem_min_venda > data.margem_med_venda
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Margem mínima não pode ser maior que margem média.',
      path: ['margem_min_venda'],
    },
  )
  .refine(
    (data) => {
      if (
        data.margem_med_venda !== undefined &&
        data.margem_med_venda !== null &&
        data.margem_ide_venda !== undefined &&
        data.margem_ide_venda !== null &&
        data.margem_med_venda > data.margem_ide_venda
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Margem média não pode ser maior que margem ideal.',
      path: ['margem_med_venda'],
    },
  );

/**
 * Schema para atualização de grupo de produtos
 * - Todos os campos são opcionais
 * - Mantém validações de consistência
 */
export const updateGrupoProdutoSchema = grupoProdutoSchema
  .partial()
  .refine(
    (data) => {
      if (
        data.margem_min_venda !== undefined &&
        data.margem_min_venda !== null &&
        data.margem_med_venda !== undefined &&
        data.margem_med_venda !== null &&
        data.margem_min_venda > data.margem_med_venda
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Margem mínima não pode ser maior que margem média.',
      path: ['margem_min_venda'],
    },
  )
  .refine(
    (data) => {
      if (
        data.margem_med_venda !== undefined &&
        data.margem_med_venda !== null &&
        data.margem_ide_venda !== undefined &&
        data.margem_ide_venda !== null &&
        data.margem_med_venda > data.margem_ide_venda
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Margem média não pode ser maior que margem ideal.',
      path: ['margem_med_venda'],
    },
  );

// ==================== TIPOS TYPESCRIPT ====================

export type GrupoProdutoFormInput = z.infer<typeof grupoProdutoSchema>;
export type CreateGrupoProdutoFormInput = z.infer<
  typeof createGrupoProdutoSchema
>;
export type UpdateGrupoProdutoFormInput = z.infer<
  typeof updateGrupoProdutoSchema
>;
