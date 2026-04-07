import React from 'react';
import { z } from 'zod';

// 1. IMPORTAÇÕES PRINCIPAIS
import {
  GenericCrudPage,
  CrudApi,
  CrudColumn,
} from '@/components/common/genericCrudPage';
import {
  FormacaoPrecoVenda,
  getFormacoesPrecoVenda,
  getFormacaoPrecoVenda,
  createFormacaoPrecoVenda,
  updateFormacaoPrecoVenda,
  deleteFormacaoPrecoVenda,
} from '@/data/formacaoPreco/formacaoPreco';
import { FormacaoPrecoVendaForm } from './FormacaoPrecoVendaForm';

// CORREÇÃO 2: Importar o componente do formulário

// 2. CRIAR O OBJETO DA API
const formacaoPrecoApi: CrudApi<FormacaoPrecoVenda> = {
  list: getFormacoesPrecoVenda,

  // CORREÇÃO 1: Fazer a ponte entre os tipos 'id' e 'codprod'
  getById: (id) => getFormacaoPrecoVenda(id as string),
  create: createFormacaoPrecoVenda,
  update: (id, data) => updateFormacaoPrecoVenda(id as string, data),
  remove: (id) => deleteFormacaoPrecoVenda(id as string),
};

// 3. DEFINIR AS COLUNAS DA TABELA
const formacaoPrecoColumns: CrudColumn<FormacaoPrecoVenda>[] = [
  { header: 'Cód. Produto', cell: (item) => item.CODPROD },
  {
    header: 'Preço Venda',
    cell: (item) =>
      Number(item.PRECOVENDA).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
  },
  {
    header: 'Margem Líquida',
    cell: (item) => `${Number(item.MARGEMLIQUIDA).toFixed(2)}%`,
  },
  {
    header: 'ICMS',
    cell: (item) => `${Number(item.ICMS).toFixed(2)}%`,
  },
  {
    header: 'IPI',
    cell: (item) => `${Number(item.IPI).toFixed(2)}%`,
  },
];

// 4. DEFINIR SCHEMA E ESTADO VAZIO
const formacaoPrecoSchema = z.object({
  CODPROD: z.string().min(1, 'O Cód. do Produto é obrigatório.').max(6),
  PRECOVENDA: z.coerce
    .number()
    .min(0.01, 'O preço de venda deve ser maior que zero.'),
  MARGEMLIQUIDA: z.coerce.number().min(0, 'A margem líquida é obrigatória.'),
  TIPOPRECO: z.coerce.number().min(0, 'O tipo de preço é obrigatório.'),
  ICMS: z.coerce.number().min(0, 'O ICMS é obrigatório.'),
  IPI: z.coerce.number().min(0, 'O IPI é obrigatório.'),
  PIS: z.coerce.number().min(0, 'O PIS é obrigatório.'),
  COFINS: z.coerce.number().min(0, 'O COFINS é obrigatório.'),
  ICMSDEVOL: z.coerce.number().min(0, 'O ICMS Devolução é obrigatório.'),
  DCI: z.coerce.number().min(0, 'O DCI é obrigatório.'),
  COMISSAO: z.coerce.number().min(0, 'A Comissão é obrigatória.'),
  FATORDESPESAS: z.coerce.number().min(0, 'O Fator Despesas é obrigatório.'),
  TAXACARTAO: z.coerce.number().min(0).nullable(),
});

const formacaoPrecoEmptyState: FormacaoPrecoVenda = {
  CODPROD: '',
  TIPOPRECO: 0,
  MARGEMLIQUIDA: 0,
  ICMSDEVOL: 0,
  ICMS: 0,
  IPI: 0,
  PIS: 0,
  COFINS: 0,
  DCI: 0,
  COMISSAO: 0,
  FATORDESPESAS: 0,
  PRECOVENDA: 0,
  TAXACARTAO: null,
};

// 5. MONTAR A PÁGINA FINAL
const FormacaoPrecoVendaPage = () => {
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Formação de Preço de Venda"
      entityName="Formação de Preço"
      idKey="CODPROD" // Chave primária do seu modelo
      api={formacaoPrecoApi}
      columns={formacaoPrecoColumns}
      permissions={userPermissions}
      FormComponent={FormacaoPrecoVendaForm}
      validationSchema={formacaoPrecoSchema}
      emptyState={formacaoPrecoEmptyState}
    />
  );
};

export default FormacaoPrecoVendaPage;
