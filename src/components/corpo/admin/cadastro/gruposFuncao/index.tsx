import React from 'react';
import CrudSimplesPage, { CrudConfig } from '@/components/common/CrudSimplesPage';

const config: CrudConfig = {
  titulo: 'Grupos de Função',
  screenKey: 'cadastro-grupos-funcao',
  chave: 'codgpf',
  chaveAuto: true,
  endpoints: {
    list: '/api/gruposFuncao/get',
    add: '/api/gruposFuncao/add',
    update: '/api/gruposFuncao/update',
    del: '/api/gruposFuncao/delete',
  },
  colunas: [
    { key: 'codgpf', label: 'Código' },
    { key: 'descr', label: 'Descrição' },
  ],
  campos: [
    { key: 'codgpf', label: 'Código', bloqueadoNaEdicao: true, span: 1 },
    { key: 'descr', label: 'Descrição', required: true, upper: true, span: 2 },
  ],
  searchPlaceholder: 'Pesquisar por descrição...',
};

export default function GruposFuncao() {
  return <CrudSimplesPage config={config} />;
}
