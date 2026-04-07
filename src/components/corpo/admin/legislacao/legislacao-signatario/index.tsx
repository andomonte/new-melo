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
import { LegislacaoSignatarioForm } from './LegislacaoSignatarioForm';
import {
  LegislacaoSignatario,
  getLegislacoesSignatario,
  getLegislacaoSignatario,
  createLegislacaoSignatario,
  updateLegislacaoSignatario,
  deleteLegislacaoSignatario,
} from '@/data/legislacao_signatario/legislacaoSignatario';

// Passo 1: Criar o Objeto da API
const legislacaoSignatarioApi: CrudApi<LegislacaoSignatario> = {
  list: getLegislacoesSignatario,
  getById: getLegislacaoSignatario,
  create: createLegislacaoSignatario,
  update: updateLegislacaoSignatario,
  remove: deleteLegislacaoSignatario,
};

// Passo 2: Definir as Colunas da Tabela
const legislacaoSignatarioColumns: CrudColumn<LegislacaoSignatario>[] = [
  { header: 'ID', cell: (item) => item.LES_ID },
  { header: 'ID da Lei', cell: (item) => item.LES_LEI_ID },
  { header: 'UF', cell: (item) => item.LES_UF },
  {
    header: 'MVA Original',
    cell: (item) => `${item.LES_MVA_ST_ORIGINAL}%`,
  },
];

// Passo 4: Definir Schema de Validação e Estado Vazio
const legislacaoSignatarioSchema = z.object({
  LES_ID: z.coerce.number().optional(), // ID será auto-incrementado
  LES_LEI_ID: z.coerce
    .number()
    .positive('O ID da Legislação deve ser um número positivo.'),
  LES_UF: z
    .string()
    .length(2, 'A UF deve ter exatamente 2 caracteres.')
    .regex(/^[A-Z]{2}$/, 'A UF deve conter apenas letras maiúsculas.'),
  LES_MVA_ST_ORIGINAL: z.coerce
    .number()
    .min(0, 'MVA não pode ser negativo (mínimo: 0%)')
    .max(100, 'MVA não pode ser maior que 100% (máximo: 100%)'),
});

const legislacaoSignatarioEmptyState: LegislacaoSignatario = {
  LES_LEI_ID: 0,
  LES_UF: '',
  LES_MVA_ST_ORIGINAL: '',
};

// Passo 5: Montar a Página Final
const LegislacaoSignatarioPage = () => {
  // A lógica de permissões pode vir do seu hook de autenticação
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Signatários da Legislação"
      entityName="signatário"
      idKey="LES_ID" // Chave primária do objeto LegislacaoSignatario
      api={legislacaoSignatarioApi}
      columns={legislacaoSignatarioColumns}
      permissions={userPermissions}
      FormComponent={LegislacaoSignatarioForm}
      validationSchema={legislacaoSignatarioSchema}
      emptyState={legislacaoSignatarioEmptyState}
    />
  );
};

export default LegislacaoSignatarioPage;
