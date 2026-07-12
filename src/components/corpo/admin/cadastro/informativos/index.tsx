import React from 'react';
import CrudSimplesPage, { CrudConfig } from '@/components/common/CrudSimplesPage';

const config: CrudConfig = {
  titulo: 'Informativos',
  screenKey: 'cadastro-informativos',
  chave: 'simbolo',
  endpoints: {
    list: '/api/informativos/get',
    add: '/api/informativos/add',
    update: '/api/informativos/update',
    del: '/api/informativos/delete',
  },
  colunas: [
    { key: 'simbolo', label: 'Símbolo' },
    { key: 'descr', label: 'Descrição' },
  ],
  campos: [
    { key: 'simbolo', label: 'Símbolo', required: true, bloqueadoNaEdicao: true, span: 1 },
    { key: 'descr', label: 'Descrição', required: true, upper: true, span: 2 },
  ],
  searchPlaceholder: 'Pesquisar por símbolo ou descrição...',
};

export default function Informativos() {
  return <CrudSimplesPage config={config} />;
}
