import React from 'react';
import { z } from 'zod';

// 1. Importando o componente genérico e seus tipos

// 2. Importando as funções da API e tipos de dados que criamos
import {
  LegislacaoIcmsst,
  getLegislacoesIcmsst,
  getLegislacaoIcmsst,
  createLegislacaoIcmsst,
  updateLegislacaoIcmsst,
  deleteLegislacaoIcmsst,
} from '@/data/legislacao/legislacao';

// 3. Importando o componente de formulário específico
import { LegislacaoIcmsstForm } from './LegislacaoIcmsstForm';
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';

// Passo 1: Criar o Objeto da API
const legislacaoApi: CrudApi<LegislacaoIcmsst> = {
  list: getLegislacoesIcmsst,
  getById: getLegislacaoIcmsst,
  create: createLegislacaoIcmsst,
  update: updateLegislacaoIcmsst,
  remove: deleteLegislacaoIcmsst,
};

// Passo 2: Definir as Colunas da Tabela
const legislacaoColumns: CrudColumn<LegislacaoIcmsst>[] = [
  { header: 'ID', cell: (item) => item.LEI_ID },
  { header: 'Protocolo', cell: (item) => item.LEI_PROTOCOLO },
  { header: 'Status', cell: (item) => item.LEI_STATUS },
  {
    header: 'Vigência',
    cell: (item) =>
      new Date(item.LEI_DATA_VIGENCIA).toLocaleDateString('pt-BR'),
  },
  {
    header: 'Publicação',
    cell: (item) =>
      new Date(item.LEI_DATA_PUBLICACAO).toLocaleDateString('pt-BR'),
  },
];

// Passo 4: Definir Schema de Validação e Estado Vazio
const legislacaoSchema = z.object({
  LEI_ID: z.coerce.number().positive('O ID deve ser um número positivo.'),
  LEI_PROTOCOLO: z.coerce
    .number()
    .positive('O Protocolo deve ser um número positivo.'),
  LEI_STATUS: z.string().min(1, 'O Status é obrigatório.'),
  LEI_DATA_VIGENCIA: z.string().min(1, 'A Data de Vigência é obrigatória.'),
  LEI_DATA_PUBLICACAO: z.string().min(1, 'A Data de Publicação é obrigatória.'),
  LEI_MVA_AJUSTADA: z.string().min(1, 'O MVA é obrigatório.'),
  LEI_TIPO: z.string().nullable().optional(), // Mantido como opcional
  LEI_DATA_CADASTRO: z.string(), // Removido o .optional() para bater com a interface
});

const legislacaoEmptyState: LegislacaoIcmsst = {
  LEI_ID: 0,
  LEI_PROTOCOLO: 0,
  LEI_DATA_CADASTRO: '',
  LEI_STATUS: '',
  LEI_DATA_VIGENCIA: '',
  LEI_DATA_PUBLICACAO: '',
  LEI_MVA_AJUSTADA: '',
  LEI_TIPO: '',
};

// Passo 5: Montar a Página Final
const LegislacaoIcmsstPage = () => {
  // Aqui você pode buscar as permissões do usuário logado
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Legislação de ICMS ST"
      entityName="legislação"
      idKey="LEI_ID"
      api={legislacaoApi}
      columns={legislacaoColumns}
      permissions={userPermissions}
      FormComponent={LegislacaoIcmsstForm}
      validationSchema={legislacaoSchema}
      emptyState={legislacaoEmptyState}
    />
  );
};

export default LegislacaoIcmsstPage;
