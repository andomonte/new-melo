import { z } from 'zod';

export const cadastroPerfilSchema = z.object({
  nome_perfil: z
    .string({ required_error: 'Nome do perfil é obrigatório' })
    .min(1, { message: 'Nome do perfil é obrigatório' }),
});
