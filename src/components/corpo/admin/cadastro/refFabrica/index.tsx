import React from 'react';
import CrudSimplesPage, { CrudConfig } from '@/components/common/CrudSimplesPage';

const config: CrudConfig = {
  titulo: 'Referência de Fábrica',
  screenKey: 'cadastro-ref-fabrica',
  chave: 'cod_id',
  chaveAuto: true,
  endpoints: {
    list: '/api/refFabrica/get',
    add: '/api/refFabrica/add',
    update: '/api/refFabrica/update',
    del: '/api/refFabrica/delete',
  },
  colunas: [
    { key: 'cod_id', label: 'Código' },
    { key: 'referencia', label: 'Referência' },
    { key: 'marca', label: 'Marca' },
    { key: 'codcredor', label: 'Fornecedor' },
  ],
  campos: [
    { key: 'referencia', label: 'Referência', required: true, upper: true, span: 2 },
    { key: 'codmarca', label: 'Marca (código)', required: true, span: 1 },
    { key: 'codcredor', label: 'Fornecedor (código)', span: 1 },
  ],
  searchPlaceholder: 'Pesquisar por referência ou marca...',
};

export default function RefFabrica() {
  return <CrudSimplesPage config={config} />;
}
