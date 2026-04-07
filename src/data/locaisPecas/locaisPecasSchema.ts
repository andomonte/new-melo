// src/data/locaisPecas/locaisPecasSchema.ts

import { z } from 'zod';

export const localPecaSchema = z.object({
  id_local: z
    .string()
    .min(1, 'ID do local é obrigatório')
    .max(15, 'ID do local deve ter no máximo 15 caracteres')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'ID do local deve conter apenas letras, números, hífen ou underscore',
    ),

  id_armazem: z.number().min(1, 'Armazém é obrigatório'),

  descricao: z
    .string()
    .max(50, 'Descrição deve ter no máximo 50 caracteres')
    .optional()
    .nullable(),

  tipo_local: z
    .string()
    .max(20, 'Tipo do local deve ter no máximo 20 caracteres')
    .optional()
    .nullable(),

  capacidade: z
    .number()
    .min(0, 'Capacidade deve ser maior ou igual a zero')
    .optional()
    .nullable(),

  unidade: z
    .string()
    .max(5, 'Unidade deve ter no máximo 5 caracteres')
    .optional()
    .nullable(),
});

export type LocalPecaSchema = z.infer<typeof localPecaSchema>;
