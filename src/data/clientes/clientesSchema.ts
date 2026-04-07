import { z } from 'zod';

export const cadastroClientesSchema = z
  .object({
    cpfcgc: z
      .string({ required_error: 'Campo CPF/CNPJ é obrigatório.' })
      .min(1, 'Campo CPF/CNPJ é obrigatório.')
      .max(20, 'CPF/CNPJ não pode ter mais de 20 caracteres.'),
    nome: z
      .string({ required_error: 'Campo nome é obrigatório.' })
      .min(1, 'Campo nome é obrigatório.')
      .max(40, 'Nome não pode ter mais de 40 caracteres.'),
    cep: z
      .string({ required_error: 'Campo CEP é obrigatório.' })
      .min(1, 'Campo CEP é obrigatório.')
      .max(9, 'CEP não pode ter mais de 9 caracteres.'),
    ender: z
      .string({ required_error: 'Campo logradouro é obrigatório.' })
      .min(1, 'Campo logradouro é obrigatório.')
      .max(100, 'Logradouro não pode ter mais de 100 caracteres.'),
    numero: z
      .string()
      .max(60, 'Número não pode ter mais de 60 caracteres.')
      .optional(),
    uf: z
      .string({ required_error: 'Campo UF é obrigatório.' })
      .min(1, 'Campo UF é obrigatório.')
      .max(2, 'UF deve ter exatamente 2 caracteres.')
      .length(2, 'UF deve ter exatamente 2 caracteres.'),
    cidade: z
      .string({ required_error: 'Campo cidade é obrigatório.' })
      .min(1, 'Campo cidade é obrigatório.')
      .max(100, 'Cidade não pode ter mais de 100 caracteres.'),
    bairro: z
      .string({ required_error: 'Campo bairro é obrigatório.' })
      .min(1, 'Campo bairro é obrigatório.')
      .max(100, 'Bairro não pode ter mais de 100 caracteres.'),
    codpais: z.number({ required_error: 'Campo país é obrigatório.' }),
    tipocliente: z
      .string({
        required_error: 'Campo tipo cliente é obrigatório.',
      })
      .min(1, 'Campo tipo cliente é obrigatório.'),
    sit_tributaria: z.number({
      required_error: 'Campo situação tributária é obrigatório.',
    }),

    imun: z
      .object({
        isentoIm: z.boolean(),
        imun: z
          .string()
          .max(20, 'Inscrição Municipal não pode ter mais de 20 caracteres.')
          .optional(),
      })
      .refine((data) => data.isentoIm || (!data.isentoIm && data.imun), {
        message:
          'Campo Inscrição Municipal é obrigatório quando Isento IM está desmarcado.',
      }),

    iest: z
      .object({
        isentoIe: z.boolean(),
        iest: z
          .string()
          .max(20, 'Inscrição Estadual não pode ter mais de 20 caracteres.')
          .optional(),
      })
      .refine((data) => data.isentoIe || (!data.isentoIe && data.iest), {
        message:
          'Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado.',
      }),

    isuframa: z
      .object({
        isentoSuf: z.boolean(),
        isuframa: z
          .string()
          .max(20, 'Inscrição Suframa não pode ter mais de 20 caracteres.')
          .optional(),
      })
      .refine((data) => data.isentoSuf || (!data.isentoSuf && data.isuframa), {
        message:
          'Campo Inscrição Suframa é obrigatório quando Isento Suframa está desmarcado.',
      }),

    claspgto: z
      .string({
        required_error: 'Campo classificação de pagamento é obrigatório.',
      })
      .min(1, 'Campo classificação de pagamento é obrigatório.')
      .max(1, 'Classificação de pagamento deve ter 1 caractere.')
      .length(1, 'Classificação de pagamento deve ter 1 caractere.'),

    faixafin: z
      .string({
        required_error: 'Campo Faixa Financeira é obrigatório.',
      })
      .min(1, 'Campo Faixa Financeira é obrigatório.')
      .max(2, 'Faixa Financeira não pode ter mais de 2 caracteres.'),

    atraso: z
      .object({
        aceitarAtraso: z.boolean(),
        atraso: z.number().optional(),
      })
      .refine(
        (data) => !data.aceitarAtraso || (data.atraso && data.atraso > 0),
        {
          message:
            'Campo Dias em Atraso é obrigatório quando Aceitar Atraso está marcado.',
        },
      ),

    icms: z
      .string({ required_error: 'Campo ICMS é obrigatório.' })
      .min(1, 'Campo ICMS é obrigatório.')
      .max(1, 'ICMS deve ter 1 caractere.')
      .length(1, 'ICMS deve ter 1 caractere.'),
    banco: z
      .string({ required_error: 'Campo banco é obrigatório.' })
      .max(1, 'Banco deve ter 1 caractere.')
      .optional(), // TODO: Opcional por enquanto.
    mesmoEndereco: z.boolean(),

    // Endereço de cobrança
    cepcobr: z
      .string()
      .max(9, 'CEP cobrança não pode ter mais de 9 caracteres.')
      .optional(),
    endercobr: z
      .string()
      .max(100, 'Logradouro cobrança não pode ter mais de 100 caracteres.')
      .optional(),
    numcobr: z
      .string()
      .max(60, 'Número cobrança não pode ter mais de 60 caracteres.')
      .optional(),
    ufcobr: z.string().max(2, 'UF cobrança deve ter 2 caracteres.').optional(),
    cidadecobr: z
      .string()
      .max(100, 'Cidade cobrança não pode ter mais de 100 caracteres.')
      .optional(),
    bairrocobr: z
      .string()
      .max(100, 'Bairro cobrança não pode ter mais de 100 caracteres.')
      .optional(),
    codpaiscobr: z.number().optional(),

    prvenda: z
      .string({
        required_error: 'Campo preço de venda é obrigatório.',
      })
      .min(1, 'Campo preço de venda é obrigatório.')
      .max(1, 'Preço de venda deve ter 1 caractere.')
      .length(1, 'Preço de venda deve ter 1 caractere.'),
    kickback: z.number({ required_error: 'Campo kickback é obrigatório.' }),
    bloquear_preco: z
      .string({
        required_error: 'Campo bloquear preço é obrigatório.',
      })
      .min(1, 'Campo bloquear preço é obrigatório.')
      .max(1, 'Bloquear preço deve ter 1 caractere.')
      .length(1, 'Bloquear preço deve ter 1 caractere.'),
    vendedor_externo: z
      .string({ required_error: 'Campo vendedor externo é obrigatório.' })
      .max(1, 'Vendedor externo deve ter 1 caractere.')
      .optional(), // TODO: Opcional por enquanto.
    limite: z.number().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (!data.mesmoEndereco) {
      if (!data.cepcobr)
        ctx.addIssue({
          path: ['cepcobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo CEP cobrança é obrigatório.',
        });

      if (!data.endercobr)
        ctx.addIssue({
          path: ['endercobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo logradouro cobrança é obrigatório.',
        });

      if (!data.ufcobr)
        ctx.addIssue({
          path: ['ufcobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo UF cobrança é obrigatório.',
        });

      if (!data.cidadecobr)
        ctx.addIssue({
          path: ['cidadecobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo cidade cobrança é obrigatório.',
        });

      if (!data.bairrocobr)
        ctx.addIssue({
          path: ['bairrocobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo bairro cobrança é obrigatório.',
        });

      if (!data.codpaiscobr)
        ctx.addIssue({
          path: ['codpaiscobr'],
          code: z.ZodIssueCode.custom,
          message: 'Campo país cobrança é obrigatório.',
        });
    }
  });
