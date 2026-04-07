import { z } from 'zod';
import { isValidCpfCnpj } from '@/utils/validacoes';

// Schema para validação mais flexível que aceita null e converte para string
const optionalStringField = (maxLength: number, fieldName: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => val ?? '')
    .pipe(
      z
        .string()
        .max(
          maxLength,
          `${fieldName} deve ter no máximo ${maxLength} caracteres`,
        ),
    );

const requiredStringField = (maxLength: number, fieldName: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => val ?? '')
    .pipe(
      z
        .string()
        .min(1, `${fieldName} é obrigatório`)
        .max(
          maxLength,
          `${fieldName} deve ter no máximo ${maxLength} caracteres`,
        ),
    );

export const cadastroTransportadoraSchema = z.object({
  codtransp: requiredStringField(5, 'Código da transportadora'),
  nome: requiredStringField(50, 'Nome da transportadora'),
  nomefant: optionalStringField(50, 'Nome fantasia').optional(),
  cpfcgc: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => val ?? '')
    .pipe(
      z
        .string()
        .min(1, 'CPF/CNPJ é obrigatório')
        .refine((val) => {
          if (!val) return false;
          return isValidCpfCnpj(val);
        }, 'CPF ou CNPJ inválido'),
    ),
  tipo: optionalStringField(1, 'Tipo').optional(),
  ender: optionalStringField(100, 'Endereço').optional(),
  numero: optionalStringField(60, 'Número').optional(),
  complemento: optionalStringField(100, 'Complemento').optional(),
  bairro: optionalStringField(100, 'Bairro').optional(),
  cidade: optionalStringField(100, 'Cidade').optional(),
  uf: optionalStringField(2, 'UF').optional(),
  cep: optionalStringField(9, 'CEP').optional(),
  codpais: z
    .union([z.number(), z.null(), z.undefined(), z.string()])
    .transform((val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? undefined : num;
    })
    .optional(),
  referencia: optionalStringField(200, 'Referência').optional(),
  tipoemp: optionalStringField(2, 'Tipo de empresa').optional(),
  contatos: optionalStringField(50, 'Contatos').optional(),
  iest: optionalStringField(20, 'Inscrição estadual').optional(),
  isuframa: optionalStringField(20, 'Inscrição SUFRAMA').optional(),
  imun: optionalStringField(20, 'Inscrição municipal').optional(),
  cc: optionalStringField(10, 'Conta corrente').optional(),
  banco: optionalStringField(20, 'Banco').optional(),
  n_agencia: optionalStringField(6, 'Número da agência').optional(),
  cod_ident: optionalStringField(5, 'Código de identificação').optional(),
});

// Schema mais flexível para edição que não valida todos os campos
export const edicaoTransportadoraSchema = z
  .object({
    codtransp: z.string().min(1, 'Código da transportadora é obrigatório'),
    nome: z.string().min(1, 'Nome da transportadora é obrigatório'),
  })
  .passthrough(); // Permite campos adicionais sem validação rígida
