import { z } from 'zod';

// Função auxiliar para validar o formato datetime-local (YYYY-MM-DDTHH:mm)
const isValidDateTimeLocal = (value: string) => {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!regex.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
};

// Função auxiliar para pré-processar inputs numéricos que podem vir como strings vazias de formulários
const preprocessNumber = (val: unknown) =>
  val !== '' && val !== null ? Number(val) : undefined;

/**
 * Schema para um item individual da venda, baseado na interface `ItemVenda`.
 */
export const itemVendaSchema = z.object({
  codprod: z.string().min(1, 'O código do produto é obrigatório.'),
  descr: z
    .string()
    .max(60, 'A descrição do item deve ter no máximo 60 caracteres.')
    .nullable()
    .optional(),
  qtd: z.preprocess(
    preprocessNumber,
    z
      .number({
        required_error: 'A quantidade é obrigatória.',
        invalid_type_error: 'Quantidade inválida.',
      })
      .int('A quantidade deve ser um número inteiro.')
      .positive('A quantidade deve ser maior que zero.'),
  ),
  prunit: z.preprocess(
    preprocessNumber,
    z
      .number({
        required_error: 'O preço unitário é obrigatório.',
        invalid_type_error: 'Preço unitário inválido.',
      })
      .positive('O preço unitário deve ser maior que zero.'),
  ),
  desconto: z.preprocess(
    preprocessNumber,
    z
      .number({ invalid_type_error: 'Desconto inválido.' })
      .min(0, 'O desconto não pode ser um valor negativo.')
      .nullable()
      .optional(),
  ),
  ref: z
    .string()
    .max(20, 'A referência deve ter no máximo 20 caracteres.')
    .nullable()
    .optional(),
});

/**
 * Schema principal para a venda, baseado na interface `Venda`.
 */
export const vendaSchema = z.object({
  // O codvenda é opcional na criação, pois geralmente é gerado pelo backend.
  codvenda: z.string().optional(),
  codcliente: z.string().min(1, 'O código do cliente é obrigatório.'),
  codvend: z
    .string()
    .min(1, 'O código do vendedor é obrigatório.')
    .nullable()
    .optional(),

  data_venda: z
    .string()
    .min(1, 'A data da venda é obrigatória.')
    .refine(isValidDateTimeLocal, {
      message: 'Formato de data e hora inválido. Use AAAA-MM-DDTHH:MM.',
    })
    .transform((str) => new Date(str).toISOString()), // Transforma para o formato ISO padrão

  status: z.enum(['ABERTA', 'FECHADA', 'CANCELADA'], {
    errorMap: () => ({ message: 'Selecione um status válido para a venda.' }),
  }),

  // O valor total pode ser calculado no backend, mas a validação pode ser útil se ele for enviado pelo frontend.
  valor_total: z.preprocess(
    preprocessNumber,
    z
      .number({ invalid_type_error: 'Valor total inválido.' })
      .min(0, 'O valor total não pode ser negativo.')
      .optional(), // Opcional, caso seja sempre calculado no backend
  ),

  observacoes: z
    .string()
    .max(500, 'As observações devem ter no máximo 500 caracteres.')
    .nullable()
    .optional(),

  // Validação para o array de itens da venda.
  itens: z
    .array(itemVendaSchema)
    .min(1, 'A venda precisa ter pelo menos um item.'),
});

// Exporta os tipos inferidos pelo Zod, o que é uma ótima prática para usar no seu código.
export type VendaSchema = z.infer<typeof vendaSchema>;
export type ItemVendaSchema = z.infer<typeof itemVendaSchema>;
