import { z } from 'zod';
import { useState } from 'react';

import { OperadoraForm } from './OperadoraForm';
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import {
  OperadoraCartao,
  getOperadorasCrud,
  getOperadoraCrud,
  createOperadoraCrud,
  updateOperadoraCrud,
  deleteOperadoraCrud,
  setSituacaoOperadora,
} from '@/data/operadoras/operadoraCrud';

const operadoraApi: CrudApi<OperadoraCartao> = {
  list: getOperadorasCrud,
  getById: getOperadoraCrud,
  create: createOperadoraCrud,
  update: (_id, data) => updateOperadoraCrud(data),
  remove: deleteOperadoraCrud,
};

const brl = (n: any) =>
  n == null || n === ''
    ? '-'
    : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ativo = (o: OperadoraCartao) => Number(o.desativado || 0) === 0;

// Nomes amigáveis das colunas (chave = nome cru vindo da API).
const operadoraColumnLabels: Record<string, string> = {
  codopera: 'Código',
  descr: 'Descrição',
  txopera: 'Taxa (%)',
  pzopera: 'Prazo (dias)',
  cond_pagto: 'Cond. Pagamento',
  desativado: 'Situação',
  codcli: 'Cliente (cód.)',
  nome_cliente: 'Cliente',
};

// Sobrescreve a CÉLULA de algumas colunas (header = nome cru da coluna).
const operadoraColumns: CrudColumn<OperadoraCartao>[] = [
  { header: 'txopera', cell: (o) => brl(o.txopera) },
  {
    header: 'desativado',
    cell: (o) => (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          ativo(o)
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
        }`}
      >
        {ativo(o) ? 'Ativo' : 'Inativo'}
      </span>
    ),
  },
];

const operadoraSchema = z.object({
  descr: z.preprocess(
    (v) => (v == null ? '' : v),
    z.string().min(2, 'A descrição é obrigatória.').max(60, 'Máximo 60 caracteres.'),
  ),
  txopera: z
    .any()
    .optional()
    .refine((v) => v == null || v === '' || !isNaN(Number(v)), 'Taxa deve ser um número (ex.: 2.32).'),
  pzopera: z
    .any()
    .optional()
    .refine((v) => v == null || v === '' || Number.isInteger(Number(v)), 'Prazo deve ser inteiro (dias).'),
  cond_pagto: z.any().optional(),
  codcli: z.any().optional(),
  desativado: z.any().optional(),
});

const operadoraEmptyState: OperadoraCartao = {
  codopera: '',
  descr: '',
  txopera: '',
  pzopera: '',
  cond_pagto: '',
  codcli: '',
  desativado: '0',
};

const OperadorasPage = () => {
  const userPermissions = { canCreate: true, canEdit: true, canDelete: true };
  const [alternando, setAlternando] = useState(false);

  return (
    <GenericCrudPage
      title="Cadastro de Operadoras de Cartão"
      entityName="Operadora de Cartão"
      idKey="codopera"
      api={operadoraApi}
      columns={operadoraColumns}
      columnLabels={operadoraColumnLabels}
      permissions={userPermissions}
      FormComponent={OperadoraForm}
      validationSchema={operadoraSchema as unknown as z.Schema<OperadoraCartao>}
      emptyState={operadoraEmptyState}
      statusFilter={{
        campo: 'desativado',
        opcoes: [
          { label: 'Ativos', valor: '0' },
          { label: 'Inativos', valor: '1' },
          { label: 'Todos', valor: null },
        ],
        defaultValor: '0',
      }}
      rowActions={(o, reload) => (
        <button
          disabled={alternando}
          onClick={async () => {
            try {
              setAlternando(true);
              await setSituacaoOperadora(o.codopera, ativo(o) ? 1 : 0);
              reload();
            } finally {
              setAlternando(false);
            }
          }}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
        >
          {ativo(o) ? 'Inativar' : 'Ativar'}
        </button>
      )}
    />
  );
};

export default OperadorasPage;
