import { z } from 'zod';
import { validarCPF, validarCNPJ } from '@/utils/validarDocumento';

// Campo string obrigatório que trata undefined/null como vazio (evita a mensagem
// padrão "Required" do zod — mostra sempre a mensagem amigável).
const obrigatorio = (msg: string, max: number) =>
  z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().min(1, msg).max(max, `Não pode exceder ${max} caracteres`),
  );

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

  nome: obrigatorio('Apelido é obrigatório', 30), // dbvend.nome VARCHAR(30)

  codcv: obrigatorio('Classe do vendedor é obrigatória', 3), // VARCHAR(3)

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

  // Dados detalhados do vendedor (tabela dbdados_vend).
  // Obrigatórios fiéis ao Delphi (UniVendedor.Btn2Click): Nome completo, Endereço,
  // Bairro, CEP, Cidade, UF, Tipo pessoa e CPF/CNPJ. Celular é opcional.
  detalhado_vendedor: z
    .object({
      bairro: obrigatorio('Bairro é obrigatório', 5),
      cep: obrigatorio('CEP é obrigatório', 9),
      cidade: obrigatorio('Cidade é obrigatória', 50),
      estado: obrigatorio('UF é obrigatória', 2),
      celular: z.string().max(15).nullable().optional(),
      logradouro: obrigatorio('Endereço é obrigatório', 100),
      nome: obrigatorio('Nome completo é obrigatório', 100),
      tipo: obrigatorio('Tipo de pessoa é obrigatório', 20),
      cpf_cnpj: obrigatorio('CPF/CNPJ é obrigatório', 18),
    })
    .refine(
      (d) => {
        const doc = (d.cpf_cnpj || '').replace(/\D/g, '');
        if (d.tipo === 'F') return validarCPF(doc);
        if (d.tipo === 'J') return validarCNPJ(doc);
        return true; // outros tipos (ex.: exterior) não validam documento
      },
      { message: 'CPF/CNPJ inválido', path: ['cpf_cnpj'] },
    ),

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
