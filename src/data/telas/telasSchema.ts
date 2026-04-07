import { z } from 'zod';

export const cadastroTelaSchema = z.object({
  NOME_TELA: z
    .string({ required_error: 'Nome da tela é obrigatório' })
    .min(1, { message: 'Nome da tela é obrigatório' }),

  PATH_TELA: z
    .string({ required_error: 'Caminho da tela é obrigatório' })
    .min(1, { message: 'Caminho da tela é obrigatório' }),
});
