import React from 'react';
import CrudSimplesPage, { CrudConfig } from '@/components/common/CrudSimplesPage';

const config: CrudConfig = {
  titulo: 'Classificação Fiscal',
  screenKey: 'cadastro-classif-fiscal',
  chave: 'id',
  chaveAuto: true,
  endpoints: {
    list: '/api/classificacaoFiscal/get',
    add: '/api/classificacaoFiscal/add',
    update: '/api/classificacaoFiscal/update',
    del: '/api/classificacaoFiscal/delete',
  },
  colunas: [
    { key: 'ncm', label: 'NCM' },
    { key: 'ipi', label: 'IPI' },
    { key: 'pis', label: 'PIS' },
    { key: 'cofins', label: 'COFINS' },
    { key: 'agregado', label: 'MVA' },
    { key: 'descricao', label: 'Descrição' },
  ],
  campos: [
    { key: 'ncm', label: 'NCM', required: true, span: 1 },
    { key: 'ipi', label: 'IPI (%)', tipo: 'number', decimais: 2, span: 1 },
    { key: 'pis', label: 'PIS (%)', tipo: 'number', decimais: 2, span: 1 },
    { key: 'cofins', label: 'COFINS (%)', tipo: 'number', decimais: 2, span: 1 },
    { key: 'agregado', label: 'MVA / Agregado (%)', tipo: 'number', decimais: 2, span: 1 },
    { key: 'descricao', label: 'Descrição', upper: true, span: 2 },
  ],
  searchPlaceholder: 'Pesquisar por NCM ou descrição...',
};

export default function ClassificacaoFiscal() {
  return <CrudSimplesPage config={config} />;
}
