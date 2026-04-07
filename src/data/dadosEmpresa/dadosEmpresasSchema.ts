// src/data/dadosEmpresa/dadosEmpresasSchema.ts

import { z } from 'zod';

// --- Schema para Cadastro de Dados da Empresa (POST) ---
export const cadastroDadosEmpresaSchema = z.object({
  cgc: z
    .string({ required_error: 'CGC é obrigatório' })
    .min(1, { message: 'CGC é obrigatório' })
    .max(18, { message: 'CGC deve ter no máximo 18 caracteres.' }), // Permite formatação (pontos, traços, barras)

  inscricaoestadual: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  nomecontribuinte: z
    .string()
    .max(100, {
      message: 'Nome do contribuinte deve ter no máximo 100 caracteres.',
    })
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

  fax: z
    .string()
    .max(20, { message: 'Fax deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  codigoconvenio: z
    .string()
    .max(20, {
      message: 'Código de convênio deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  codigonatureza: z
    .string()
    .max(20, {
      message: 'Código de natureza deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  codigofinalidade: z
    .string()
    .max(20, {
      message: 'Código de finalidade deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  logradouro: z
    .string()
    .max(50, { message: 'Logradouro deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  numero: z
    .string()
    .max(10, { message: 'Número deve ter no máximo 10 caracteres.' })
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
    .nullable()
    .optional(),

  contato: z
    .string()
    .max(50, { message: 'Contato deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  telefone: z
    .string()
    .max(20, { message: 'Telefone deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  suframa: z
    .string()
    .max(20, { message: 'Suframa deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  email: z
    .string()
    .email({ message: 'Formato de e-mail inválido.' })
    .max(100, { message: 'E-mail deve ter no máximo 100 caracteres.' })
    .nullable()
    .optional(),

  inscricaoestadual_07: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual 07 deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  inscricaomunicipal: z
    .string()
    .max(20, {
      message: 'Inscrição Municipal deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  id_token: z
    .string()
    .max(50, { message: 'ID Token deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  token: z
    .string()
    .max(500, { message: 'Token deve ter no máximo 500 caracteres.' })
    .nullable()
    .optional(),

  certificado: z
    .string()
    .max(5000, { message: 'Certificado deve ter no máximo 5000 caracteres.' })
    .nullable()
    .optional(),
});

// --- Schema para Edição de Dados da Empresa (PUT/PATCH) ---
export const edicaoDadosEmpresaSchema = z.object({
  cgc: z
    .string({ required_error: 'CGC é obrigatório para edição' })
    .min(1, { message: 'CGC é obrigatório para edição' })
    .max(18, { message: 'CGC deve ter no máximo 18 caracteres.' }), // Permite formatação (pontos, traços, barras)

  inscricaoestadual: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  nomecontribuinte: z
    .string()
    .max(100, {
      message: 'Nome do contribuinte deve ter no máximo 100 caracteres.',
    })
    .nullable()
    .optional(),

  fax: z
    .string()
    .max(20, { message: 'Fax deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  codigoconvenio: z
    .string()
    .max(20, {
      message: 'Código de convênio deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  codigonatureza: z
    .string()
    .max(20, {
      message: 'Código de natureza deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  codigofinalidade: z
    .string()
    .max(20, {
      message: 'Código de finalidade deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  logradouro: z
    .string()
    .max(50, { message: 'Logradouro deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  numero: z
    .string()
    .max(10, { message: 'Número deve ter no máximo 10 caracteres.' })
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
    .nullable()
    .optional(),

  // REMOVIDA A DUPLICAÇÃO: municipio e uf
  // municipio: z
  //   .string()
  //   .max(30, { message: 'Município deve ter no máximo 30 caracteres.' })
  //   .nullable()
  //   .optional(),

  // uf: z
  //   .string()
  //   .length(2, { message: 'UF deve ter 2 caracteres.' })
  //   .nullable()
  //   .optional(),

  contato: z
    .string()
    .max(50, { message: 'Contato deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  telefone: z
    .string()
    .max(20, { message: 'Telefone deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  suframa: z
    .string()
    .max(20, { message: 'Suframa deve ter no máximo 20 caracteres.' })
    .nullable()
    .optional(),

  email: z
    .string()
    .email({ message: 'Formato de e-mail inválido.' })
    .max(100, { message: 'E-mail deve ter no máximo 100 caracteres.' })
    .nullable()
    .optional(),

  inscricaoestadual_07: z
    .string()
    .max(20, {
      message: 'Inscrição Estadual 07 deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  inscricaomunicipal: z
    .string()
    .max(20, {
      message: 'Inscrição Municipal deve ter no máximo 20 caracteres.',
    })
    .nullable()
    .optional(),

  id_token: z
    .string()
    .max(50, { message: 'ID Token deve ter no máximo 50 caracteres.' })
    .nullable()
    .optional(),

  token: z
    .string()
    .max(500, { message: 'Token deve ter no máximo 500 caracteres.' })
    .nullable()
    .optional(),

  certificadoKey: z.string().nullable().optional(),

  certificadoCrt: z.string().nullable().optional(),

  cadeiaCrt: z.string().nullable().optional(),
});
