// Financeiro > Arquivos > Centro de Custos
// Delphi: Geral/UniCCusto.pas — tabela DBCCUSTO (COD_CCUSTO, DESCR, TIPO).
// O combo do Delphi tem 'Ativo' e 'Passivo' e grava a primeira letra (A / P).

import React from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import FormSelect from '@/components/common/FormSelect';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { CentroCusto, paraCrudApi } from '@/data/financeiro/arquivos';

const api = paraCrudApi<CentroCusto>('centros-custo');

const TIPOS = [
  { value: 'A', label: 'Ativo' },
  { value: 'P', label: 'Passivo' },
];

const colunas: CrudColumn<CentroCusto>[] = [
  { header: 'cod_ccusto', cell: (i) => i.cod_ccusto },
  { header: 'descr', cell: (i) => i.descr },
  { header: 'tipo', cell: (i) => (i.tipo === 'A' ? 'Ativo' : 'Passivo') },
];

const rotulos = { cod_ccusto: 'CÓDIGO', descr: 'DESCRIÇÃO', tipo: 'TIPO' };

const schema = z.object({
  cod_ccusto: z.string().optional(),
  descr: z
    .string()
    .trim()
    .min(1, 'Informe a descrição do centro de custo.')
    .max(20, 'A descrição deve ter no máximo 20 caracteres.'),
  tipo: z.enum(['A', 'P'], {
    message: 'Informe o tipo do centro de custo.',
  }),
});

const vazio: CentroCusto = { cod_ccusto: '', descr: '', tipo: 'A' };

const Formulario: React.FC<FormComponentProps<CentroCusto>> = ({
  formData,
  onFormChange,
  errors,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <FormInput
      name="cod_ccusto"
      label="Código"
      value={formData.cod_ccusto || ''}
      placeholder="Gerado automaticamente"
      disabled
      type=""
    />
    <FormInput
      name="descr"
      label="Descrição"
      value={formData.descr || ''}
      onChange={(e) => onFormChange('descr', e.target.value)}
      error={errors.descr}
      required
      maxLength={20}
      type=""
    />
    <FormSelect
      name="tipo"
      label="Tipo"
      options={TIPOS}
      value={formData.tipo || 'A'}
      onChange={(e) => onFormChange('tipo', e.target.value)}
      error={errors.tipo}
      required
    />
  </div>
);

const CentrosCustoPage = () => (
  <GenericCrudPage
    title="Centro de Custos"
    entityName="centro de custo"
    idKey="cod_ccusto"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<CentroCusto>}
    emptyState={vazio}
  />
);

export default CentrosCustoPage;
