import { z } from 'zod';

export const cadastroGrupoSchema = z.object({
  LOGIN_GROUP_NAME: z.string({ required_error: 'Nome do grupo é obrigatório' }).nonempty({ message: 'Nome do grupo é obrigatório' }),
  LOGIN_GROUP_IS_ADMIN: z.boolean({ required_error: 'Grupo Admin é obrigatório' }),
});