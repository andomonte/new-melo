import { z } from 'zod';
import { validarDocumento, limparDocumento } from '@/utils/validarDocumento';

export const clientSchema = z.object({
  // Identificação
  codcli: z.string().optional(),
  tipoPessoa: z.enum(['F', 'J', 'E'], { required_error: 'Tipo de pessoa é obrigatório', invalid_type_error: 'Tipo de pessoa é obrigatório' }),
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
    z.enum(
      ['EPP', 'EP', 'EF', 'ME', 'NL', 'PF', 'MEI', 'EI', 'LTDA', 'SLU', 'S/S', 'S/A', 'MGP'],
      {
        required_error: 'Tipo de empresa é obrigatório',
        invalid_type_error: 'Tipo de empresa é obrigatório',
      },
    ),
  ),
  classeCliente: z.string({ required_error: 'Classe de cliente é obrigatória' }).min(1, 'Classe de cliente é obrigatória'),

  // Inscrições (obrigatórias no Delphi — ou preenchidas ou marcadas como ISENTO)
  inscricaoEstadual: z.string().max(20).optional().nullable(),
  isentoIE: z.boolean().default(false),
  inscricaoMunicipal: z.string().max(20).optional().nullable(),
  isentoIM: z.boolean().default(false),
  suframa: z.string().max(20).optional().nullable(),
  isentoSuframa: z.boolean().default(false),

  // Endereço
  cep: z.string({ required_error: 'CEP é obrigatório' }).min(1, 'CEP é obrigatório').max(9),
  endereco: z.string({ required_error: 'Logradouro é obrigatório' }).min(1, 'Logradouro é obrigatório').max(100),
  numero: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.string({ required_error: 'Número é obrigatório' }).min(1, 'Número é obrigatório').max(10),
  ),
  complemento: z.string().max(50).optional().nullable(),
  referencia: z.string().max(100).optional().nullable(),
  bairro: z.string({ required_error: 'Bairro é obrigatório' }).min(1, 'Bairro é obrigatório').max(20, 'Máximo 20 caracteres').default(''),
  cidade: z.string({ required_error: 'Cidade é obrigatória' }).min(1, 'Cidade é obrigatória').max(20, 'Máximo 20 caracteres'),
  uf: z.string({ required_error: 'UF é obrigatória' }).min(1, 'UF é obrigatória').max(2),

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
  // No Delphi, vendedor externo é obrigatório — validamos que tenha pelo menos 1
  vendedores_list: z
    .array(
      z.object({
        sellerId: z.string().min(1, 'Código do vendedor é obrigatório'),
        segmentoId: z.string().optional(),
        tipoVendedor: z.enum(['externo', 'tmk']).optional().default('externo'),
      }),
    )
    .min(1, 'Informe pelo menos um vendedor externo')
    .default([]),

  // Financeiro / Outros (Mapeando campos do banco)
  limiteCredito: z.union([z.string(), z.number()]).optional().nullable(),
  credito: z.enum(['S', 'N']).optional().nullable(),
  classePagamento: z.enum(['A', 'B', 'C', 'D', 'E', 'V', 'I', 'F', 'N', 'O', 'P', 'Z', 'X']).optional().nullable(),
  aceitaAtraso: z.boolean().default(false),
  diasAtraso: z.union([z.string(), z.number()]).optional().nullable(),
  icms: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['S', 'N'], {
      required_error: 'ICMS é obrigatório',
      invalid_type_error: 'ICMS é obrigatório',
    }),
  ),
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

  obs: z.string().max(500, 'Observações: máximo 500 caracteres (limite do banco)').optional().nullable(),

  // Campos de Cobrança (obrigatórios no Delphi quando endereço diferente)
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
  precoVenda: z.preprocess(
    (val) => (val === null || val === '' ? undefined : String(val)),
    z.string({ required_error: 'Preço de venda é obrigatório' }).min(1, 'Preço de venda é obrigatório'),
  ),
  kickback: z.union([z.string(), z.number()]).optional().nullable(),
  precoVendaKickback: z.union([z.boolean(), z.string(), z.number()]).optional().nullable(),
  descontoAplicado: z.enum(['S', 'N']).optional().nullable(),
  benmd: z.enum(['S', 'N']).optional().nullable(), // Bloqueio de preço de venda
  habilitasuframa: z.enum(['S', 'N']).optional().nullable(), // Hab. Suframa (Sim/Não no Delphi)
  habilitarLocalEntrega: z.enum(['0', '1']).optional().nullable(),
}).superRefine((data, ctx) => {
  // Inscrições: obrigatório preencher OU marcar isento
  if (!data.isentoIE && (!data.inscricaoEstadual || data.inscricaoEstadual.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inscrição Estadual é obrigatória (ou marque como Isento)', path: ['inscricaoEstadual'] });
  }
  if (!data.isentoIM && (!data.inscricaoMunicipal || data.inscricaoMunicipal.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inscrição Municipal é obrigatória (ou marque como Isento)', path: ['inscricaoMunicipal'] });
  }
  if (!data.isentoSuframa && (!data.suframa || data.suframa.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Suframa é obrigatório (ou marque como Isento)', path: ['suframa'] });
  }

  // Cobrança: obrigatório quando endereço diferente
  if (!data.enderecoCobrancaIgual) {
    if (!data.endercobr || data.endercobr.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Logradouro de cobrança é obrigatório', path: ['endercobr'] });
    }
    if (!data.numerocobr || data.numerocobr.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Número de cobrança é obrigatório', path: ['numerocobr'] });
    }
    if (!data.bairrocobr || data.bairrocobr.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bairro de cobrança é obrigatório', path: ['bairrocobr'] });
    }
    if (!data.cidadecobr || data.cidadecobr.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cidade de cobrança é obrigatória', path: ['cidadecobr'] });
    }
    if (!data.ufcobr || data.ufcobr.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UF de cobrança é obrigatória', path: ['ufcobr'] });
    }
  }

  // Dias de atraso: campo opcional — validação removida pois o Delphi aceita 0 ou vazio
});

export type ClientFormValues = z.infer<typeof clientSchema>;
