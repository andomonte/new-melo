import { z } from 'zod';

export const cadastroFuncaoSchema = z.object({
  descricao: z
    .string({ required_error: 'O campo descrição é obrigatório.' })
    .min(1, { message: 'O campo descrição é obrigatório.' })
    .max(100, { message: 'A descrição deve ter no máximo 100 caracteres.' }),
});
