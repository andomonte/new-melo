import { z } from 'zod';

export const cadastroBancoSchema = z.object({
  banco: z
    .string({ required_error: 'Código do banco é obrigatório' })
    .min(1, { message: 'Código do banco é obrigatório' }),
  nome: z
    .string({ required_error: 'Nome do banco é obrigatório' })
    .min(1, { message: 'Nome do banco é obrigatório' }),
});

export const criarBancoSchema = z.object({
  nome: z
    .string({ required_error: 'Nome do banco é obrigatório' })
    .min(1, { message: 'Nome do banco é obrigatório' }),
});
