import { z } from 'zod';
import { isValidCpfCnpj } from '@/utils/validacoes';

export const cadastroFornecedorSchema = z.object({
  cpf_cgc: z
    .string({ required_error: 'Campo CNPJ/CPF é obrigatório.' })
    .min(1, 'Campo CNPJ/CPF é obrigatório.')
    .refine((value) => isValidCpfCnpj(value), {
      message: 'CNPJ/CPF inválido.',
    }),
  nome: z
    .string({ required_error: 'Campo nome é obrigatório.' })
    .min(1, 'Campo nome é obrigatório.'),
  cep: z
    .string({ required_error: 'Campo CEP é obrigatório.' })
    .min(8, 'CEP deve ter 8 dígitos.')
    .max(9, 'CEP deve ter no máximo 9 caracteres.'),
  endereco: z
    .string({ required_error: 'Campo logradouro é obrigatório.' })
    .min(1, 'Campo logradouro é obrigatório.'),
  numero: z
    .string({ required_error: 'Campo número é obrigatório.' })
    .min(1, 'Campo número é obrigatório.'),
  uf: z
    .string({ required_error: 'Campo UF é obrigatório.' })
    .min(2, 'UF deve ter 2 caracteres.')
    .max(2, 'UF deve ter 2 caracteres.'),
  cidade: z
    .string({ required_error: 'Campo cidade é obrigatório.' })
    .min(1, 'Campo cidade é obrigatório.'),
  bairro: z
    .string({ required_error: 'Campo bairro é obrigatório.' })
    .min(1, 'Campo bairro é obrigatório.'),
  tipo: z
    .string({ required_error: 'Campo tipo é obrigatório.' })
    .min(1, 'Campo tipo é obrigatório.'),
  tipoemp: z
    .string({ required_error: 'Campo tipo empresa é obrigatório.' })
    .min(1, 'Campo tipo empresa é obrigatório.'),
  tipofornecedor: z
    .string({ required_error: 'Campo tipo fornecedor é obrigatório.' })
    .min(1, 'Campo tipo fornecedor é obrigatório.'),
  codcf: z
    .string({ required_error: 'Campo classe de fornecedor é obrigatório.' })
    .min(1, 'Campo classe de fornecedor é obrigatório.')
    .max(5, 'Código da classe de fornecedor deve ter no máximo 5 caracteres.'),
  codpais: z
    .union([z.string(), z.number()])
    .refine((val) => val !== '' && val !== null && val !== undefined, {
      message: 'Campo país é obrigatório.',
    }),
  imun: z
    .object({
      isentoIm: z.boolean(),
      imun: z.string().optional(),
    })
    .refine((data) => data.isentoIm || (!data.isentoIm && data.imun), {
      message:
        'Campo Inscrição Municipal é obrigatório quando Isento IM está desmarcado.',
    }),
  iest: z
    .object({
      isentoIe: z.boolean(),
      iest: z.string().optional(),
    })
    .refine((data) => data.isentoIe || (!data.isentoIe && data.iest), {
      message:
        'Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado.',
    }),
  isuframa: z
    .object({
      isentoSuf: z.boolean(),
      isuframa: z.string().optional(),
    })
    .refine((data) => data.isentoSuf || (!data.isentoSuf && data.isuframa), {
      message:
        'Campo Inscrição Suframa é obrigatório quando Isento Suframa está desmarcado.',
    }),
});

// ✅ CORREÇÃO: Schema específico para edição - mais flexível com campos opcionais
export const edicaoFornecedorSchema = z.object({
  cpf_cgc: z
    .string({ required_error: 'Campo CNPJ/CPF é obrigatório.' })
    .min(1, 'Campo CNPJ/CPF é obrigatório.')
    .refine((value) => isValidCpfCnpj(value), {
      message: 'CNPJ/CPF inválido.',
    }),
  nome: z
    .string({ required_error: 'Campo nome é obrigatório.' })
    .min(1, 'Campo nome é obrigatório.'),
  cep: z
    .string({ required_error: 'Campo CEP é obrigatório.' })
    .min(8, 'CEP deve ter 8 dígitos.')
    .max(9, 'CEP deve ter no máximo 9 caracteres.'),
  endereco: z
    .string({ required_error: 'Campo logradouro é obrigatório.' })
    .min(1, 'Campo logradouro é obrigatório.'),
  numero: z
    .string({ required_error: 'Campo número é obrigatório.' })
    .min(1, 'Campo número é obrigatório.'),
  uf: z
    .string({ required_error: 'Campo UF é obrigatório.' })
    .min(2, 'UF deve ter 2 caracteres.')
    .max(2, 'UF deve ter 2 caracteres.'),
  cidade: z
    .string({ required_error: 'Campo cidade é obrigatório.' })
    .min(1, 'Campo cidade é obrigatório.'),
  bairro: z
    .string({ required_error: 'Campo bairro é obrigatório.' })
    .min(1, 'Campo bairro é obrigatório.'),
  tipo: z
    .string({ required_error: 'Campo tipo é obrigatório.' })
    .min(1, 'Campo tipo é obrigatório.'),
  tipoemp: z
    .string({ required_error: 'Campo tipo empresa é obrigatório.' })
    .min(1, 'Campo tipo empresa é obrigatório.'),
  // Campos opcionais para edição
  tipofornecedor: z.string().optional().or(z.literal('')),
  codcf: z
    .string()
    .max(5, 'Código da classe de fornecedor deve ter no máximo 5 caracteres.')
    .optional()
    .or(z.literal('')),
  codpais: z
    .union([z.string(), z.number()])
    .refine((val) => val !== '' && val !== null && val !== undefined, {
      message: 'Campo país é obrigatório.',
    }),
  imun: z
    .object({
      isentoIm: z.boolean(),
      imun: z.string().optional(),
    })
    .refine((data) => data.isentoIm || (!data.isentoIm && data.imun), {
      message:
        'Campo Inscrição Municipal é obrigatório quando Isento IM está desmarcado.',
    }),
  iest: z
    .object({
      isentoIe: z.boolean(),
      iest: z.string().optional(),
    })
    .refine((data) => data.isentoIe || (!data.isentoIe && data.iest), {
      message:
        'Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado.',
    }),
  isuframa: z
    .object({
      isentoSuf: z.boolean(),
      isuframa: z.string().optional(),
    })
    .refine((data) => data.isentoSuf || (!data.isentoSuf && data.isuframa), {
      message:
        'Campo Inscrição Suframa é obrigatório quando Isento Suframa está desmarcado.',
    }),
});

export type CadastroFornecedor = z.infer<typeof cadastroFornecedorSchema>;
export type EdicaoFornecedor = z.infer<typeof edicaoFornecedorSchema>;
