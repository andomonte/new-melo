import { z } from 'zod';

// Schema para cadastro de novas contas (sem ID)
// Limites baseados na estrutura real da tabela dbdados_banco do PostgreSQL
export const contaSchema = z.object({
  // Campos obrigatórios baseados na API add.ts
  banco: z
    .string({ required_error: 'Campo Código Banco é obrigatório.' })
    .min(1, 'Campo Código Banco é obrigatório.')
    .max(3, 'Código Banco não pode ter mais de 3 caracteres.'),

  tipo: z
    .string({ required_error: 'Campo Tipo da Conta é obrigatório.' })
    .min(1, 'Campo Tipo da Conta é obrigatório.')
    .max(10, 'Tipo da Conta não pode ter mais de 10 caracteres.'),

  nroconta: z
    .string({ required_error: 'Campo Número da Conta é obrigatório.' })
    .min(1, 'Campo Número da Conta é obrigatório.')
    .max(10, 'Número da Conta não pode ter mais de 10 caracteres.'),

  agencia: z
    .string({ required_error: 'Campo Agência é obrigatório.' })
    .min(1, 'Campo Agência é obrigatório.')
    .max(10, 'Agência não pode ter mais de 10 caracteres.'),

  // Campos opcionais
  convenio: z
    .string()
    .max(10, 'Convênio não pode ter mais de 10 caracteres.')
    .optional()
    .or(z.literal('')),

  variacao: z
    .string()
    .max(3, 'Variação não pode ter mais de 3 caracteres.')
    .optional()
    .or(z.literal('')),

  carteira: z
    .string()
    .max(3, 'Carteira não pode ter mais de 3 caracteres.')
    .optional()
    .or(z.literal('')),

  melo: z
    .string()
    .max(3, 'Melo não pode ter mais de 3 caracteres.')
    .optional()
    .or(z.literal('')),
});

// Schema para edição de contas (com ID)
export const contaUpdateSchema = contaSchema.extend({
  id: z.number({ required_error: 'ID da conta é obrigatório para edição.' }),
});
