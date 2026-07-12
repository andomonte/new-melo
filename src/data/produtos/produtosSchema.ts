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
    .string({
      required_error: 'Referência é obrigatória',
      invalid_type_error: 'Referência é obrigatória',
    })
    .min(1, 'Referência é obrigatória')
    .max(20, 'Referência não pode ter mais de 20 caracteres'),
  descr: z
    .string({
      required_error: 'Descrição é obrigatória',
      invalid_type_error: 'Descrição é obrigatória',
    })
    .min(1, 'Descrição é obrigatória')
    .max(200, 'Descrição não pode ter mais de 200 caracteres'),
  unimed: z
    .string()
    .min(1, 'Unidade de medida é obrigatória')
    .max(2, 'Unidade de medida não pode ter mais de 2 caracteres'),

  // Campos obrigatórios com valores padrão
  codmarca: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z
      .string()
      .min(1, 'Marca é obrigatória')
      .max(5, 'Código marca não pode ter mais de 5 caracteres'),
  ),
  codgpf: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z
      .string()
      .min(1, 'Grupo de Função é obrigatório')
      .max(5, 'Código grupo função não pode ter mais de 5 caracteres'),
  ),
  codgpp: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z
      .string()
      .min(1, 'Grupo de Produto é obrigatório')
      .max(5, 'Código grupo produto não pode ter mais de 5 caracteres'),
  ),
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
  trib: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().min(1, 'Tributado é obrigatório').max(1),
  ),
  strib: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z
      .string()
      .min(1, 'Situação Tributária é obrigatória')
      .max(3, 'Situação tributária não pode ter mais de 3 caracteres'),
  ),
  isentopiscofins: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().min(1, 'Isento PIS/COFINS é obrigatório').max(1),
  ),
  isentoipi: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().min(1, 'Situação IPI é obrigatória').max(1),
  ),

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
    .string({ required_error: 'Aplicação Extendida é obrigatória' })
    .trim()
    .min(1, 'Aplicação Extendida é obrigatória')
    .max(255, 'Aplicação extendida não pode ter mais de 255 caracteres'),
  obs: z
    .string()
    .max(100, 'Observações não pode ter mais de 100 caracteres')
    .optional()
    .nullable(),
  inf: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().min(1, 'Informativo é obrigatório').max(1),
  ),
  pesoliq: numberOrNull.optional(),
  qtembal: numberWithDefault(1),
  qtestmin: numberOrNull.optional(),
  qtestmax: numberOrNull.optional(),
  coddesc: numberOrNull.optional(),
  tabelado: z.string().max(1).optional().nullable(),
  dolar: z.string().max(1).optional().nullable(),
  multiplocompra: z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return 1;
    const num = Number(val);
    return isNaN(num) ? 1 : num;
  }, z.number().min(1, 'Múltiplo de compra não pode ser menor que 1')),
  clasfiscal: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z
      .string()
      .min(8, 'Classificação Fiscal (NCM) deve ter no mínimo 8 caracteres')
      .max(10, 'Classificação fiscal não pode ter mais de 10 caracteres')
      .refine(
        (val) => {
          // Rejeita NCMs com padrões falsos (dígitos repetidos)
          const fakePatterns = [
            '00000000', '11111111', '22222222', '33333333', '44444444',
            '55555555', '66666666', '77777777', '88888888', '99999999',
            '0000.0.0',
          ];
          return !fakePatterns.includes(val);
        },
        { message: 'NCM inválido: não é permitido usar dígitos repetidos ou padrões fictícios' }
      ),
  ),
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
    // Validação: Grupo de Produto vs Tipo (conforme Delphi)
    // MC (Material de Consumo): grupo DEVE começar com 'Z'
    // ME (Mercadoria de Revenda): grupo NÃO pode começar com 'Z'

    const tipo = data.tipo?.toUpperCase();
    const codgpp = data.codgpp?.toUpperCase();

    if (!tipo || !codgpp || codgpp === '00000') {
      return true;
    }

    const comecaComZ = codgpp.startsWith('Z');

    if (tipo === 'MC' && !comecaComZ) {
      return false; // MC (Material de Consumo) deve começar com Z
    }

    if (tipo === 'ME' && comecaComZ) {
      return false; // ME (Mercadoria de Revenda) não pode começar com Z
    }

    return true;
  },
  {
    message: 'Grupo de Produto inválido: Material de Consumo (MC) deve começar com "Z" e Mercadoria de Revenda (ME) não pode começar com "Z"',
    path: ['codgpp'],
  }
)
.refine(
  (data) => {
    // PIS obrigatório quando não isento
    if (data.isentopiscofins === 'N' && (data.pis === null || data.pis === undefined)) {
      return false;
    }
    return true;
  },
  { message: 'PIS é obrigatório quando não isento', path: ['pis'] }
)
.refine(
  (data) => {
    // COFINS obrigatório quando não isento
    if (data.isentopiscofins === 'N' && (data.cofins === null || data.cofins === undefined)) {
      return false;
    }
    return true;
  },
  { message: 'COFINS é obrigatório quando não isento', path: ['cofins'] }
)
.refine(
  (data) => {
    // % Agregado (MVA): quando tributado = SIM e percsubst = 0, apenas avisa (não bloqueia)
    // O aviso "Deseja salvar sem essa informação?" é tratado no componente de formulário
    // conforme comportamento Delphi (MessageDlg mtWarning com mbYes/mbNo)
    return true;
  },
  { message: '% Agregado (MVA) é obrigatório quando Tributado = SIM', path: ['percsubst'] }
);

// Nota: validação de Compra Direta SIM exige Ref. Fábrica é feita no modal (não no schema)
// porque o campo referenciasFabrica não faz parte do schema Zod (é gerenciado separadamente)

export type ProdutoSchema = z.infer<typeof cadastroProdutoSchema>;
