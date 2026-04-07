import { z } from 'zod';

// Função helper para preprocessar campos numéricos
const preprocessNumericField = (val: unknown) => {
  if (val === '' || val === null || val === undefined) {
    return null;
  }
  const num = Number(val);
  return isNaN(num) ? null : num;
};

export const cadastroVendedorSchema = z.object({
  // Campo obrigatório baseado em dbvend
  // codvend: VARCHAR(5) @id - gerado automaticamente pela API

  nome: z
    .string({ required_error: 'Campo nome é obrigatório' })
    .min(1, 'Nome é obrigatório')
    .max(30, 'Nome não pode exceder 30 caracteres'), // VARCHAR(30)

  codcv: z
    .string()
    .max(3, 'Código da classe não pode exceder 3 caracteres') // VARCHAR(3)
    .optional()
    .nullable(),

  status: z
    .string()
    .max(1, 'Status não pode exceder 1 caractere') // VARCHAR(1)
    .optional()
    .nullable(),

  ra_mat: z
    .string()
    .max(6, 'RA/MAT não pode exceder 6 caracteres') // VARCHAR(6)
    .optional()
    .nullable(),

  // Campos numéricos DECIMAL
  valobj: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Valor objetivo deve ser um número',
      })
      .max(999999.99, 'Valor objetivo não pode exceder 999999.99')
      .optional()
      .nullable(),
  ),

  comnormal: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Comissão normal deve ser um número',
      })
      .max(9999.99, 'Comissão normal não pode exceder 9999.99')
      .optional()
      .nullable(),
  ),

  comtele: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Comissão televendas deve ser um número',
      })
      .max(9999.99, 'Comissão televendas não pode exceder 9999.99')
      .optional()
      .nullable(),
  ),

  debito: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Débito deve ser um número',
      })
      .max(9999999.99, 'Débito não pode exceder 9999999.99')
      .optional()
      .nullable(),
  ),

  credito: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Crédito deve ser um número',
      })
      .max(9999999.99, 'Crédito não pode exceder 9999999.99')
      .optional()
      .nullable(),
  ),

  limite: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Limite deve ser um número',
      })
      .max(9999999.99, 'Limite não pode exceder 9999999.99')
      .optional()
      .nullable(),
  ),

  comobj: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Comissão objetivo deve ser um número',
      })
      .max(9999.99, 'Comissão objetivo não pode exceder 9999.99')
      .optional()
      .nullable(),
  ),

  valobjf: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Valor objetivo final deve ser um número',
      })
      .max(999999.99, 'Valor objetivo final não pode exceder 999999.99')
      .optional()
      .nullable(),
  ),

  valobjm: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Valor objetivo mensal deve ser um número',
      })
      .max(999999.99, 'Valor objetivo mensal não pode exceder 999999.99')
      .optional()
      .nullable(),
  ),

  valobjsf: z.preprocess(
    preprocessNumericField,
    z
      .number({
        invalid_type_error: 'Valor objetivo sem fiscal deve ser um número',
      })
      .max(999999.99, 'Valor objetivo sem fiscal não pode exceder 999999.99')
      .optional()
      .nullable(),
  ),

  // Dados detalhados do vendedor (tabela dbdados_vend)
  detalhado_vendedor: z
    .object({
      bairro: z.string().max(50).nullable().optional(),
      cep: z.string().max(9).nullable().optional(),
      cidade: z.string().max(50).nullable().optional(),
      estado: z.string().max(2).nullable().optional(),
      celular: z.string().max(15).nullable().optional(),
      logradouro: z.string().max(100).nullable().optional(),
      nome: z.string().max(100).nullable().optional(),
      tipo: z.string().max(20).nullable().optional(),
      cpf_cnpj: z.string().max(18).nullable().optional(),
    })
    .optional(),

  // Grupos de produtos (tabela dbvendgpp)
  grupos_produto: z
    .array(
      z.object({
        codgpp: z.string().nullable().optional(),
        exclusivo: z.string().nullable().optional(),
        comdireta: z.preprocess(
          preprocessNumericField,
          z
            .number({
              invalid_type_error: 'Comissão direta deve ser um número',
            })
            .optional()
            .nullable(),
        ),
        comindireta: z.preprocess(
          preprocessNumericField,
          z
            .number({
              invalid_type_error: 'Comissão indireta deve ser um número',
            })
            .optional()
            .nullable(),
        ),
      }),
    )
    .optional(),

  // PST (tabela dbvend_pst)
  pst: z
    .object({
      codpst: z.string().nullable().optional(),
      local: z.string().max(10).nullable().optional(),
    })
    .optional(),
});
