import { z } from 'zod';
import { validarDocumento, limparDocumento } from '@/utils/validarDocumento';

export const clientSchema = z.object({
  // Identificação
  codcli: z.string().optional(),
  tipoPessoa: z.enum(['F', 'J', 'E']),
  documento: z
    .string()
    .min(1, 'Documento é obrigatório')
    .refine((val) => {
      const clean = limparDocumento(val);
      if (clean.length === 0) return false;
      // Exterior não valida CPF/CNPJ
      if (clean.length !== 11 && clean.length !== 14) return clean.length > 0;
      return validarDocumento(val);
    }, 'CPF ou CNPJ inválido'),
  nome: z
    .string()
    .min(2, 'Nome / Razão Social é obrigatório')
    .max(40, 'Máximo 40 caracteres (limite do sistema)'),
  nomeFantasia: z
    .string()
    .max(30, 'Máximo 30 caracteres (limite do sistema)')
    .optional()
    .nullable()
    .or(z.literal('')),

  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal('')),

  // Classificação Tributária e Comercial
  tipoCliente: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['R', 'F', 'L', 'S', 'X'], {
      required_error: 'Tipo de cliente é obrigatório',
      invalid_type_error: 'Tipo de cliente é obrigatório',
    }),
  ),
  situacaoTributaria: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['1', '2', '3', '4'], {
      required_error: 'Situação tributária é obrigatória',
      invalid_type_error: 'Situação tributária é obrigatória',
    }),
  ),
  tipoEmpresa: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['EPP', 'ME', 'NL', 'PF'], {
      required_error: 'Tipo de empresa é obrigatório',
      invalid_type_error: 'Tipo de empresa é obrigatório',
    }),
  ),
  classeCliente: z.string().min(1, 'Classe de cliente é obrigatória'),

  // Inscrições
  inscricaoEstadual: z.string().max(20).optional().nullable(),
  isentoIE: z.boolean().default(false),
  inscricaoMunicipal: z.string().max(20).optional().nullable(),
  isentoIM: z.boolean().default(false),
  suframa: z.string().max(20).optional().nullable(),
  isentoSuframa: z.boolean().default(false),

  // Endereço
  cep: z.string().min(1, 'CEP é obrigatório').max(9),
  endereco: z.string().min(1, 'Logradouro é obrigatório').max(100),
  numero: z.string().max(10).optional().nullable(),
  complemento: z.string().max(50).optional().nullable(),
  referencia: z.string().max(100).optional().nullable(),
  bairro: z.string().min(1, 'Bairro é obrigatório').max(20, 'Máximo 20 caracteres').default(''),
  cidade: z.string().min(1, 'Cidade é obrigatória').max(20, 'Máximo 20 caracteres'),
  uf: z.string().min(1, 'UF é obrigatória').max(2),

  // País: Aceita string ou number
  pais: z
    .union([z.string().min(1, 'País é obrigatório'), z.number()])
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }),

  // Contatos (telefones, emails, etc)
  contatos: z
    .array(
      z.object({
        type: z.enum(['celular', 'fixo', 'comercial', 'whatsapp', 'email']),
        value: z.string().min(1, 'Contato obrigatório'),
        obs: z.string().optional(),
      }),
    )
    .default([]),

  // Pessoas de Contato (funcionários/responsáveis do cliente)
  pessoasContato: z
    .array(
      z.object({
        nome: z.string().min(1, 'Nome obrigatório'),
        cargo: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        aniversario: z.string().optional(), // formato DD/MM
      }),
    )
    .default([]),

  // Vendedores (Lista de IDs)
  vendedores: z.array(z.string()).optional().default([]),

  // Vendedores por Segmento (vincula vendedor a segmento para este cliente)
  vendedores_list: z
    .array(
      z.object({
        sellerId: z.string(),
        segmentoId: z.string().optional(), // código do segmento (dbsegmento.codsegmento)
      }),
    )
    .optional()
    .default([]),

  // Financeiro / Outros (Mapeando campos do banco)
  limiteCredito: z.union([z.string(), z.number()]).optional().nullable(),
  credito: z.enum(['S', 'N']).optional().nullable(),
  classePagamento: z.enum(['A', 'B', 'C', 'D', 'E', 'V', 'I', 'F', 'N', 'O', 'P', 'Z', 'X']).optional().nullable(),
  aceitaAtraso: z.boolean().default(false),
  diasAtraso: z.union([z.string(), z.number()]).optional().nullable(),
  icms: z.enum(['S', 'N']).optional().nullable(),
  faixaFinanceira: z.string().optional().nullable(),
  // Banco no DB é numérico (ex: bigint). No Select do frontend, "" significa "não selecionado".
  // Validamos aqui para que o erro apareça no FinancialTab, em vez de estourar no backend.
  banco: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || val === 0)
        return undefined;
      return val;
    },
    z.coerce
      .number({
        required_error: 'Banco é obrigatório',
        invalid_type_error: 'Banco é obrigatório',
      })
      .int('Banco inválido')
      .positive('Banco inválido')
      .optional()
      .refine((val) => val !== undefined, {
        message: 'Banco é obrigatório',
      }),
  ),

  formaPagamento: z.string().optional().nullable(),

  // Campos extras que podem vir do form mas precisam ser tratados ou ignorados pelo backend
  // Se o backend usa ALLOWED_COLUMNS, podemos ser mais permissivos aqui ou strict.
  // Vamos manter permissive para UI fields.

  obs: z.string().max(100).optional().nullable(),

  // Campos de Cobrança
  enderecoCobrancaIgual: z.boolean().default(true),
  endercobr: z.string().max(100).optional().nullable(),
  numerocobr: z.string().max(60).optional().nullable(),
  bairrocobr: z.string().max(20, 'Máximo 20 caracteres').optional().nullable(),
  cidadecobr: z.string().max(20, 'Máximo 20 caracteres').optional().nullable(),
  ufcobr: z.string().max(2).optional().nullable(),
  cepcobr: z.string().max(9).optional().nullable(),
  complementocobr: z.string().max(100).optional().nullable(),
  referenciacobr: z.string().max(200).optional().nullable(),

  // Entrega
  tipoPessoaEntrega: z.enum(['F', 'J']).optional().nullable(),
  nomeEntrega: z.string().max(100).optional().nullable(),
  emailEntrega: z.string().max(100).optional().nullable(),
  cepEntrega: z.string().max(9).optional().nullable(),
  enderecoEntrega: z.string().max(100).optional().nullable(),
  numeroEntrega: z.string().max(10).optional().nullable(),
  complementoEntrega: z.string().max(50).optional().nullable(),
  referenciaEntrega: z.string().max(100).optional().nullable(),
  bairroEntrega: z.string().max(50).optional().nullable(),
  cidadeEntrega: z.string().max(60).optional().nullable(),
  ufEntrega: z.string().max(2).optional().nullable(),
  paisEntrega: z.string().max(60).optional().nullable(),
  iestEntrega: z.string().max(20).optional().nullable(),
  imunEntrega: z.string().max(20).optional().nullable(),
  suframaEntrega: z.string().max(20).optional().nullable(),

  // Comercial
  acrescimo: z.union([z.string(), z.number()]).optional().nullable(),
  desconto: z.union([z.string(), z.number()]).optional().nullable(),
  precoVenda: z.union([z.string(), z.number()]).optional().nullable(),
  kickback: z.union([z.string(), z.number()]).optional().nullable(),
  descontoAplicado: z.enum(['S', 'N']).optional().nullable(),
  benmd: z.enum(['S', 'N']).optional().nullable(), // Bloqueio de preço de venda
  habilitarLocalEntrega: z.enum(['0', '1']).optional().nullable(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
