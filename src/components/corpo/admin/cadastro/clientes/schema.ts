import { z } from 'zod';

export const clientSchema = z.object({
  // Identificação
  codcli: z.string().optional(),
  tipoPessoa: z.enum(['F', 'J', 'E']),
  documento: z
    .string()
    .min(1, 'Documento é obrigatório')
    .refine((val) => {
      // Simple length check as proxy for mask completion,
      // strictly we should check typePessoa and validate CPF/CNPJ
      const clean = val.replace(/\D/g, '');
      if (clean.length === 0) return false;
      return true;
    }, 'Documento inválido'),
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
  tipoCliente: z.enum(['R', 'F', 'L', 'S', 'X']).optional().nullable(),
  situacaoTributaria: z.enum(['1', '2', '3', '4']).optional().nullable(),
  tipoEmpresa: z.enum(['EPP', 'ME', 'NL', 'PF']).optional().nullable(),
  classeCliente: z.string().optional().nullable(),

  // Inscrições
  inscricaoEstadual: z.string().max(20).optional().nullable(),
  isentoIE: z.boolean().default(false),
  inscricaoMunicipal: z.string().max(20).optional().nullable(),
  isentoIM: z.boolean().default(false),
  suframa: z.string().max(20).optional().nullable(),
  isentoSuframa: z.boolean().default(false),

  // Endereço
  cep: z.string().max(9).optional().nullable(),
  endereco: z.string().max(100).optional().nullable(),
  numero: z.string().max(10).optional().nullable(),
  complemento: z.string().max(50).optional().nullable(),
  bairro: z.string().max(50).optional().default(''),
  cidade: z.string().max(60).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),

  // País: Aceita string ou number, mas converte para number se possível
  pais: z
    .union([z.string(), z.number()])
    .optional()
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
  classePagamento: z.enum(['A', 'B', 'C', 'X']).optional().nullable(),
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
  bairrocobr: z.string().max(50).optional().nullable(),
  cidadecobr: z.string().max(60).optional().nullable(),
  ufcobr: z.string().max(2).optional().nullable(),
  cepcobr: z.string().max(9).optional().nullable(),
  complementocobr: z.string().max(100).optional().nullable(),
  referenciacobr: z.string().max(200).optional().nullable(),

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
