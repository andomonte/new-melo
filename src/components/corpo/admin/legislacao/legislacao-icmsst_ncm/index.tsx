import React from 'react';
import { z } from 'zod';

// Importando o componente genérico e seus tipos
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';

// Importando as funções da API e tipos de dados da nova entidade

// Importando o componente de formulário que acabamos de criar
import { LegislacaoNcmForm } from './LegislacaoNcmForm';
import {
  LegislacaoNcm,
  getLegislacoesNcm,
  getLegislacaoNcm,
  createLegislacaoNcm,
  updateLegislacaoNcm,
  deleteLegislacaoNcm,
} from '@/data/legislacao_icmsst_ncm/legislacao_icmsst_ncm';

// Passo 1: Criar o Objeto da API
const legislacaoNcmApi: CrudApi<LegislacaoNcm> = {
  list: getLegislacoesNcm,
  getById: getLegislacaoNcm,
  create: createLegislacaoNcm,
  update: updateLegislacaoNcm,
  remove: deleteLegislacaoNcm,
};

// Passo 2: Definir as Colunas da Tabela
const legislacaoNcmColumns: CrudColumn<LegislacaoNcm>[] = [
  { header: 'ID', cell: (item) => item.LIN_ID },
  { header: 'ID Lei', cell: (item) => item.LIN_LEI_ID },
  { header: 'NCM', cell: (item) => item.LIN_NCM },
  { header: 'CEST', cell: (item) => item.LIN_CEST },
  { header: 'Status', cell: (item) => item.LIN_STATUS },
  { header: 'MVA Original', cell: (item) => `${item.LIN_MVA_ST_ORIGINAL}%` },
];

// Passo 4: Definir Schema de Validação e Estado Vazio
const legislacaoNcmSchema = z.object({
  LIN_ID: z.coerce.number().optional(), // ID será auto-incrementado
  LIN_LEI_ID: z.coerce
    .number()
    .positive('O ID da Legislação deve ser um número positivo.'),
  LIN_NCM: z
    .string()
    .min(8, 'O NCM deve ter pelo menos 8 caracteres.')
    .max(9, 'O NCM deve ter no máximo 9 caracteres.')
    .regex(/^\d+$/, 'O NCM deve conter apenas números.'),
  LIN_STATUS: z
    .string()
    .min(1, 'O Status é obrigatório.')
    .max(10, 'O Status deve ter no máximo 10 caracteres.'),
  LIN_MVA_ST_ORIGINAL: z.coerce
    .number()
    .min(0, 'MVA não pode ser negativo (mínimo: 0%)')
    .max(100, 'MVA não pode ser maior que 100% (máximo: 100%)'),
  LIN_CEST: z
    .string()
    .min(7, 'O CEST deve ter pelo menos 7 caracteres.')
    .max(8, 'O CEST deve ter no máximo 8 caracteres.')
    .regex(/^\d+$/, 'O CEST deve conter apenas números.')
    .optional()
    .or(z.literal('')),
});

const legislacaoNcmEmptyState: LegislacaoNcm = {
  LIN_LEI_ID: 0,
  LIN_NCM: '',
  LIN_STATUS: '',
  LIN_MVA_ST_ORIGINAL: '',
  LIN_CEST: '',
};

// Passo 5: Montar a Página Final
const LegislacaoNcmPage = () => {
  // A lógica de permissões pode vir do seu hook de autenticação
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="NCMs da Legislação de ICMS ST"
      entityName="NCM da legislação"
      idKey="LIN_ID" // Chave primária do objeto LegislacaoNcm
      api={legislacaoNcmApi}
      columns={legislacaoNcmColumns}
      permissions={userPermissions}
      FormComponent={LegislacaoNcmForm}
      validationSchema={legislacaoNcmSchema}
      emptyState={legislacaoNcmEmptyState}
    />
  );
};

export default LegislacaoNcmPage;
