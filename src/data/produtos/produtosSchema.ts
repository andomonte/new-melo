import { z } from 'zod';

// Helper para converter string para número ou retornar null
const numberOrNull = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}, z.number().nullable());

const numberWithDefault = (defaultValue: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }, z.number());

export const cadastroProdutoSchema = z.object({
  // Campos obrigatórios essenciais
  ref: z
    .string()
    .min(1, 'Referência é obrigatória')
    .max(20, 'Referência não pode ter mais de 20 caracteres'),
  descr: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(200, 'Descrição não pode ter mais de 200 caracteres'),
  unimed: z
    .string()
    .min(1, 'Unidade de medida é obrigatória')
    .max(2, 'Unidade de medida não pode ter mais de 2 caracteres'),

  // Campos obrigatórios com valores padrão
  codmarca: z
    .string()
    .max(5, 'Código marca não pode ter mais de 5 caracteres')
    .default('00000'),
  codgpf: z
    .string()
    .max(5, 'Código grupo função não pode ter mais de 5 caracteres')
    .default('00000'),
  codgpp: z
    .string()
    .max(5, 'Código grupo produto não pode ter mais de 5 caracteres')
    .default('00000'),
  curva: z
    .string()
    .max(1, 'Curva deve ter exatamente 1 caractere')
    .default('D'),
  multiplo: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return 1;
      const num = Number(val);
      return isNaN(num) ? 1 : num;
    }, z.number().min(1, 'Múltiplo não pode ser menor que 1')),
  compradireta: z.string().max(1).default('N'),
  tipo: z
    .string()
    .max(2, 'Tipo não pode ter mais de 2 caracteres')
    .default('ME'),
  trib: z.string().max(1).default('N'),
  strib: z
    .string()
    .max(3, 'Situação tributária não pode ter mais de 3 caracteres')
    .default('000'),
  isentopiscofins: z.string().max(1).default('N'),
  isentoipi: z.string().max(1).default('S'),

  // Campos opcionais
  codbar: z
    .string()
    .max(15, 'Código de barras não pode ter mais de 15 caracteres')
    .optional()
    .nullable(),
  reforiginal: z
    .string()
    .max(20, 'Referência original não pode ter mais de 20 caracteres')
    .optional()
    .nullable(),
  aplic_extendida: z
    .string()
    .max(255, 'Aplicação extendida não pode ter mais de 255 caracteres')
    .optional()
    .nullable(),
  obs: z
    .string()
    .max(100, 'Observações não pode ter mais de 100 caracteres')
    .optional()
    .nullable(),
  inf: z.string().max(1).optional().nullable(),
  pesoliq: numberOrNull.optional(),
  qtembal: numberOrNull.optional(),
  qtestmin: numberOrNull.optional(),
  qtestmax: numberOrNull.optional(),
  coddesc: numberOrNull.optional(),
  tabelado: z.string().max(1).optional().nullable(),
  dolar: z.string().max(1).optional().nullable(),
  multiplocompra: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return 1;
      const num = Number(val);
      return isNaN(num) ? 1 : num;
    }, z.number().min(1, 'Múltiplo de compra não pode ser menor que 1'))
    .optional(),
  clasfiscal: z
    .string()
    .max(10, 'Classificação fiscal não pode ter mais de 10 caracteres')
    .optional()
    .nullable(),
  percsubst: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().nonnegative('Percentual de substituição não pode ser negativo').max(100, 'Percentual de substituição não pode ser maior que 100%').nullable())
    .optional(),
  pis: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().nonnegative('PIS não pode ser negativo').max(100, 'PIS não pode ser maior que 100%').nullable())
    .optional(),
  cofins: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().nonnegative('COFINS não pode ser negativo').max(100, 'COFINS não pode ser maior que 100%').nullable())
    .optional(),
  ipi: z
    .preprocess((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    }, z.number().nonnegative('IPI não pode ser negativo').max(100, 'IPI não pode ser maior que 100%').nullable())
    .optional(),
  cest: z
    .string()
    .max(7, 'CEST não pode ter mais de 7 caracteres')
    .optional()
    .nullable(),
  consumo_interno: z.boolean().optional().nullable(),

  // Campos de Margem
  margemfe: numberOrNull.optional(),
  margempromofe: numberOrNull.optional(),
  margemzf: numberOrNull.optional(),
  margempromozf: numberOrNull.optional(),

  // Campos de Comissão Diferenciada
  comdifeext: numberOrNull.optional(),
  comdifeext_int: numberOrNull.optional(),
  comdifint: numberOrNull.optional(),

  // Campos de Taxa de Câmbio
  txdolarfabrica: numberOrNull.optional(),
  txdolarcompramedio: numberOrNull.optional(),

  // Campos Fiscais Especiais
  naotemst: z.string().max(1).optional().nullable(),
  prodepe: z.string().max(1).optional().nullable(),
  hanan: z.string().max(1).optional().nullable(),
})
.refine(
  (data) => {
    // Validação: Grupo de Produto vs Tipo
    // MC (Mercadoria Comercial) NÃO pode começar com 'Z'
    // ME (Mercadoria Especial) DEVE começar com 'Z'

    const tipo = data.tipo?.toUpperCase();
    const codgpp = data.codgpp?.toUpperCase();

    if (!tipo || !codgpp || codgpp === '00000') {
      return true; // Pula validação se campos vazios ou padrão
    }

    const comecaComZ = codgpp.startsWith('Z');

    if (tipo === 'MC' && comecaComZ) {
      return false; // MC não pode começar com Z
    }

    if (tipo === 'ME' && !comecaComZ) {
      return false; // ME deve começar com Z
    }

    return true;
  },
  {
    message: 'Grupo de Produto inválido: Mercadoria Comercial (MC) não pode começar com "Z" e Mercadoria Especial (ME) deve começar com "Z"',
    path: ['codgpp'], // Mostra erro no campo codgpp
  }
);

export type ProdutoSchema = z.infer<typeof cadastroProdutoSchema>;
