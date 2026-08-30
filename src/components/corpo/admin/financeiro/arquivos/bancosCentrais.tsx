// Financeiro > Arquivos > Bancos Centrais
// Delphi: Formularios/BANCO CENTRAL/uniBancoCentrais.pas — tabela DBBANCOCENTRAL
// (CODBC, DESCR). É o topo da hierarquia bancária: Banco Central -> Agência
// (dbbanco) -> Conta (dbconta).
//
// Diferença consciente em relação ao Delphi: lá o nome é limitado a 20
// caracteres (MaxLength do MaskEdit), o que trunca nomes reais como
// "CAIXA ECONOMICA FEDERAL". Aqui a coluna e o campo aceitam 60.

import React from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { BancoCentral, paraCrudApi } from '@/data/financeiro/arquivos';

const api = paraCrudApi<BancoCentral>('bancos-centrais');

const colunas: CrudColumn<BancoCentral>[] = [
  { header: 'codbc', cell: (i) => i.codbc },
  { header: 'descr', cell: (i) => i.descr },
];

const rotulos = { codbc: 'Nº BANCO CENTRAL', descr: 'NOME DO BANCO' };

const schema = z.object({
  codbc: z
    .string()
    .trim()
    .min(1, 'Informe o nº do banco central.')
    .max(4, 'O nº do banco central deve ter no máximo 4 dígitos.')
    .regex(/^\d+$/, 'O nº do banco central deve conter apenas números.'),
  descr: z
    .string()
    .trim()
    .min(3, 'Informe o nome do banco central (mínimo 3 caracteres).')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
});

const vazio: BancoCentral = { codbc: '', descr: '' };

const Formulario: React.FC<FormComponentProps<BancoCentral>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const editando = Boolean(formData.codbc);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        name="codbc"
        label="Nº do Banco Central"
        value={formData.codbc || ''}
        onChange={(e) => onFormChange('codbc', e.target.value)}
        error={errors.codbc}
        required
        maxLength={4}
        // No Delphi a aba Alterar só edita o nome; o número vem travado.
        disabled={editando}
        placeholder="Ex.: 237"
        type=""
      />
      <div className="md:col-span-2">
        <FormInput
          name="descr"
          label="Nome do Banco"
          value={formData.descr || ''}
          onChange={(e) => onFormChange('descr', e.target.value)}
          error={errors.descr}
          required
          maxLength={60}
          type=""
        />
      </div>
    </div>
  );
};

const BancosCentraisPage = () => (
  <GenericCrudPage
    title="Bancos Centrais"
    entityName="banco central"
    idKey="codbc"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<BancoCentral>}
    emptyState={vazio}
  />
);

export default BancosCentraisPage;
