import { z } from 'zod';
import { isValidCpfCnpj } from '@/utils/validacoes';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

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
  // Código é gerado automaticamente no backend (invisível ao usuário)
  codtransp: z.string().max(5).optional().or(z.literal('')),
  nome: requiredStringField(50, 'Nome da transportadora'),
  nomefant: requiredStringField(40, 'Nome Fantasia'),
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
      // Obs.: transportadora PODE usar o CNPJ da própria empresa (ex.: "CLIENTE RETIRA").
    ),
  tipo: optionalStringField(1, 'Tipo').optional(),
  ender: requiredStringField(100, 'Logradouro'),
  numero: requiredStringField(60, 'Número'),
  complemento: optionalStringField(100, 'Complemento').optional(),
  bairro: requiredStringField(100, 'Bairro'),
  cidade: requiredStringField(100, 'Cidade'),
  uf: requiredStringField(2, 'UF'),
  cep: requiredStringField(9, 'CEP'),
  codpais: z
    .union([z.number(), z.null(), z.undefined(), z.string()])
    .transform((val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? undefined : num;
    })
    .refine((val) => val !== undefined && val !== null, {
      message: 'País é obrigatório',
    }),
  referencia: optionalStringField(200, 'Referência').optional(),
  tipoemp: optionalStringField(5, 'Tipo de empresa').optional(),
  contatos: optionalStringField(50, 'Contatos').optional(),
  iest: optionalStringField(20, 'Inscrição estadual').optional(),
  isuframa: optionalStringField(20, 'Inscrição SUFRAMA').optional(),
  imun: optionalStringField(20, 'Inscrição municipal').optional(),
  cc: optionalStringField(10, 'Conta corrente').optional(),
  banco: optionalStringField(20, 'Banco').optional(),
  n_agencia: optionalStringField(6, 'Número da agência').optional(),
  cod_ident: optionalStringField(5, 'Código de identificação').optional(),
}).superRefine((data, ctx) => {
  // Documento deve corresponder ao Tipo (J=CNPJ 14 díg., F=CPF 11 díg.). X=Exterior não valida.
  const tipo = (data as any).tipo || 'J';
  const doc = limparDocumentoAlfa(String((data as any).cpfcgc || ''));
  if (tipo === 'J' && doc.length !== 14) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Pessoa Jurídica, informe um CNPJ (14 dígitos).',
      path: ['cpfcgc'],
    });
  }
  if (tipo === 'F' && doc.length !== 11) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Para Pessoa Física, informe um CPF (11 dígitos).',
      path: ['cpfcgc'],
    });
  }
});

// Schema mais flexível para edição que não valida todos os campos
export const edicaoTransportadoraSchema = z
  .object({
    codtransp: z.string().min(1, 'Código da transportadora é obrigatório'),
    nome: z.string().min(1, 'Nome da transportadora é obrigatório'),
  })
  .passthrough(); // Permite campos adicionais sem validação rígida
