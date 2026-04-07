import { z } from 'zod';

export const cadastroUsuarioSchema = z.object({
  login_group_name: z.string({ required_error: 'O campo grupo de usuário é obrigatório.' }),
  login_user_login: z.string({ required_error: 'O campo login é obrigatório.' }),
  login_user_name: z.string({ required_error: 'O campo nome é obrigatório.' }),
  login_user_password: z.string({ required_error: 'O campo senha é obrigatório.' }),
  login_user_obs: z.string({ required_error: 'O campo observação é obrigatório.' }),
});

export const editUsuarioSchema = z.object({
  login_group_name: z.string({ required_error: 'O campo grupo de usuário é obrigatório.' }),
  login_user_login: z.string({ required_error: 'O campo login é obrigatório.' }),
  login_user_name: z.string({ required_error: 'O campo nome é obrigatório.' }),
  login_user_obs: z.string({ required_error: 'O campo observação é obrigatório.' }),
});