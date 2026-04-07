// src/data/armazem/armazensSchema.ts

import { z } from 'zod';

// --- Schema para Cadastro de Armazém (POST) ---
// Inclui todos os campos necessários e opcionais para a criação de um novo armazém.
export const cadastroArmazemSchema = z.object({
  nome: z
    .string({ required_error: 'Nome do armazém é obrigatório' })
    .min(1, { message: 'Nome do armazém é obrigatório' })
    .max(50, { message: 'Nome do armazém deve ter no máximo 50 caracteres.' }),
  // Removi o `.optional()` e deixei `.string().min(1)` por padrão,
  // mas se a regra de negócio permitir criar um armazém sem nome, adicione `.optional()`

  filial: z
    .string({ required_error: 'Filial é obrigatória' })
    .min(1, { message: 'Filial é obrigatória' })
    .max(10, { message: 'Filial deve ter no máximo 10 caracteres.' }),

  ativo: z.boolean().optional(), // Default true no banco, mas pode ser enviado.

  // --- Campos de Endereço ---
  logradouro: z
    .string()
    .max(50, { message: 'Logradouro deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),
  numero: z
    .string()
    .max(5, { message: 'Número deve ter no máximo 5 caracteres.' })
    .nullable()
    .optional(),
  complemento: z
    .string()
    .max(50, { message: 'Complemento deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),
  bairro: z
    .string()
    .max(30, { message: 'Bairro deve ter no máximo 30 caracteres.' })
    .nullable()
    .optional(),
  cep: z
    .string()
    .max(10, { message: 'CEP deve ter no máximo 10 caracteres.' })
    // Adicione validação de formato de CEP se desejar, ex: .regex(/^\d{5}-\d{3}$/)
    .nullable()
    .optional(),
  municipio: z
    .string()
    .max(30, { message: 'Município deve ter no máximo 30 caracteres.' })
    .nullable()
    .optional(),
  uf: z
    .string()
    .length(2, { message: 'UF deve ter 2 caracteres.' })
    .nullable()
    .optional(),

  // --- NOVO CAMPO: Inscrição Estadual ---
  inscricaoestadual: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual deve ter no máximo 20 caracteres.',
    }) // Defina o max_length conforme seu DB
    .nullable() // Permite que seja nulo
    .optional(), // Permite que não seja enviado (para PATCH)
});

// --- Schema para Edição de Armazém (PUT/PATCH) ---
// Todos os campos, exceto o id_armazem, são opcionais para permitir atualizações parciais (PATCH).
export const edicaoArmazemSchema = z.object({
  // Para edição, o id_armazem é necessário e deve ser um número inteiro.
  id_armazem: z
    .number({ required_error: 'ID do armazém é obrigatório para edição' })
    .int('ID do armazém deve ser um número inteiro')
    .min(1, { message: 'ID do armazém deve ser um número positivo.' }),

  // Todos os outros campos são opcionais para a edição (PATCH),
  // o que permite atualizar apenas um subconjunto de campos.
  nome: z
    .string()
    .max(50, { message: 'Nome do armazém deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  filial: z
    .string()
    .max(10, { message: 'Filial deve ter no máximo 10 caracteres.' })
    .nullable()
    .optional(),

  ativo: z.boolean().nullable().optional(),

  // --- Campos de Endereço (Opcionais na Edição) ---
  logradouro: z
    .string()
    .max(50, { message: 'Logradouro deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),
  numero: z
    .string()
    .max(5, { message: 'Número deve ter no máximo 5 caracteres.' })
    .nullable()
    .optional(),
  complemento: z
    .string()
    .max(50, { message: 'Complemento deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),
  bairro: z
    .string()
    .max(30, { message: 'Bairro deve ter no máximo 30 caracteres.' })
    .nullable()
    .optional(),
  cep: z
    .string()
    .max(10, { message: 'CEP deve ter no máximo 10 caracteres.' })
    // .regex(/^\d{5}-\d{3}$/, { message: 'Formato de CEP inválido (xxxxx-xxx).' }) // Exemplo de validação de formato
    .nullable()
    .optional(),
  municipio: z
    .string()
    .max(30, { message: 'Município deve ter no máximo 30 caracteres.' })
    .nullable()
    .optional(),
  uf: z
    .string()
    .length(2, { message: 'UF deve ter 2 caracteres.' })
    .nullable()
    .optional(),

  // --- NOVO CAMPO: Inscrição Estadual (Opcional na Edição) ---
  inscricaoestadual: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual deve ter no máximo 20 caracteres.',
    }) // Defina o max_length conforme seu DB
    .nullable() // Permite que seja nulo
    .optional(), // Permite que não seja enviado (para PATCH)
});
