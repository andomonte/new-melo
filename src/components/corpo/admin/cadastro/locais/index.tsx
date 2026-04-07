import React from 'react';
import { z } from 'zod';

// Componente de formulário que criamos acima
import { LocaisForm } from './LocaisForm';
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import {
  Local,
  getLocais,
  getLocal,
  createLocal,
  updateLocal,
  deleteLocal,
} from '@/data/locais/locais';

// Passo 1: Criar o Objeto da API
const locaisApi: CrudApi<Local> = {
  list: getLocais,
  getById: getLocal,
  create: createLocal,
  update: updateLocal, // Nossas funções já batem com a assinatura esperada!
  remove: deleteLocal,
};

// Passo 2: Definir as Colunas da Tabela
const locaisColumns: CrudColumn<Local>[] = [
  { header: 'ID Local', cell: (item) => item.id_local },
  { header: 'Descrição', cell: (item) => item.descricao || '--' },
  { header: 'ID Armazém', cell: (item) => item.id_armazem },
  { header: 'Tipo', cell: (item) => item.tipo_local || '--' },
  {
    header: 'Capacidade',
    cell: (item) => `${item.capacidade || 0} ${item.unidade || ''}`,
  },
];

// Passo 4: Definir Schema de Validação e Estado Vazio
const locaisSchema = z.object({
  id_local: z
    .string()
    .min(1, 'O ID do local é obrigatório.')
    .max(15, 'O ID do local deve ter no máximo 15 caracteres.'),
  id_armazem: z.coerce.number().positive('O ID do armazém é obrigatório.'),
  descricao: z.string().optional(),
  tipo_local: z.string().optional(),
  capacidade: z.string().optional(),
  unidade: z.string().optional(),
});

// Objeto usado para abrir o formulário de criação
const locaisEmptyState: Local = {
  id_local: '',
  id_armazem: 0,
  descricao: '',
  tipo_local: '',
  capacidade: '',
  unidade: '',
};

// Passo 5: Montar a Página Final
const LocaisPage = () => {
  // A lógica de permissões pode vir de um hook de autenticação
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Cadastro de Locais"
      entityName="local"
      idKey="id_local" // 👈 Chave primária da nossa entidade 'Local'
      api={locaisApi}
      columns={locaisColumns}
      permissions={userPermissions}
      FormComponent={LocaisForm}
      validationSchema={locaisSchema}
      emptyState={locaisEmptyState}
    />
  );
};

export default LocaisPage;
