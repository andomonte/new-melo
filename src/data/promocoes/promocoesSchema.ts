import { z } from 'zod';

// Função auxiliar para validar o formato datetime-local (YYYY-MM-DDTHH:mm)
// e também garantir que é uma data válida.
const isValidDateTimeLocal = (value: string) => {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!regex.test(value)) {
    return false; // Não corresponde ao formato esperado
  }
  // Tenta criar um objeto Date. Se for inválido, new Date() resultará em "Invalid Date"
  // e getTime() retornará NaN.
  const date = new Date(value);
  return !isNaN(date.getTime()); // Retorna true se a data é válida
};

export const promocaoSchema = z
  .object({
    id_promocao: z.number().int().optional(),
    nome_promocao: z
      .string()
      .min(3, 'O nome da promoção deve ter pelo menos 3 caracteres.'),
    descricao_promocao: z
      .string()
      .max(255, 'A descrição deve ter no máximo 255 caracteres.') // Adicionado max length
      .nullable()
      .optional(),

    // ✨ MODIFICAÇÃO PRINCIPAL AQUI PARA DATA_INICIO ✨
    data_inicio: z
      .string()
      .min(1, 'Data de Início é obrigatória.') // Adicionado min(1) para garantir que não é vazio
      .refine(isValidDateTimeLocal, {
        message:
          'Formato de data e hora de início inválido. Use AAAA-MM-DDTHH:MM.',
      })
      .transform((str) => new Date(str).toISOString()), // Transforma para ISO completo (com segundos e 'Z') para backend

    // ✨ MODIFICAÇÃO PRINCIPAL AQUI PARA DATA_FIM ✨
    data_fim: z
      .string()
      .min(1, 'Data de Fim é obrigatória.') // Adicionado min(1) para garantir que não é vazio
      .refine(isValidDateTimeLocal, {
        message:
          'Formato de data e hora de término inválido. Use AAAA-MM-DDTHH:MM.',
      })
      .transform((str) => new Date(str).toISOString()), // Transforma para ISO completo (com segundos e 'Z') para backend

    tipo_promocao: z.enum(['PROD', 'GRUPO'], {
      message: 'Tipo de promoção inválido.',
    }),

    valor_desconto: z.preprocess(
      (val) => (val !== '' ? Number(val) : undefined),
      z.number().gt(0, { message: 'Desconto deve ser maior que zero' }),
    ),

    tipo_desconto: z.enum(['PERC', 'VALO', 'PREF'], {
      message: 'Tipo de desconto inválido.',
    }),
    qtde_minima_ativacao: z
      .number()
      .int()
      .min(1, 'Quantidade mínima de ativação deve ser ao menos 1.'),
    qtde_maxima_total: z
      .number()
      .int()
      .min(0, 'Quantidade máxima total não pode ser negativa.') // Adicionado min(0)
      .nullable()
      .optional(),
    qtde_maxima_por_cliente: z
      .number()
      .int()
      .min(0, 'Quantidade máxima por cliente não pode ser negativa.') // Adicionado min(0)
      .nullable()
      .optional(),
    ativa: z.boolean().default(true),
    criado_em: z.string().datetime().optional(), // Este campo geralmente é gerado pelo backend na criação
    criado_por: z.string().min(1, 'Criador da promoção é obrigatório.'),
    observacoes: z
      .string()
      .max(500, 'Observações devem ter no máximo 500 caracteres.') // Adicionado max length
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // É importante que esta validação ocorra APÓS os `transform` dos campos individuais,
    // pois `data.data_inicio` e `data.data_fim` já virão como strings ISO completas aqui.

    // A validação de formato já foi feita pelo `.refine` acima.
    // Aqui, apenas verificamos se a data de fim é posterior à de início.
    const inicio = new Date(data.data_inicio);
    const fim = new Date(data.data_fim);

    // O check isNaN já foi implicitamente tratado pelo .refine na string original,
    // e o .transform só ocorre se a string é válida.
    // Portanto, aqui, esperamos que inicio e fim sejam datas válidas.

    if (fim.getTime() <= inicio.getTime()) {
      // Usar getTime() para comparação numérica é mais seguro
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de término deve ser posterior à data de início.',
        path: ['data_fim'],
      });
    }
  });
