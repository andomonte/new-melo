import { z } from 'zod';

export const cadastroFilialSchema = z.object({
  nome_filial: z
    .string({ required_error: 'Nome da filial é obrigatório' })
    .min(1, { message: 'Nome da filial é obrigatório' }),
});
