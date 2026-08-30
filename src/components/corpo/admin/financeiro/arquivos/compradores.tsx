// Financeiro > Arquivos > Compradores
// Delphi: Geral/uniCompradores.pas — tabela DBCOMPRADORES (CODCOMPRADOR, NOME).
// O código é gerado pelo package COMPRADOR.INC_COMPRADOR; o nome precisa ter
// pelo menos 5 caracteres e não pode repetir.

import React from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { Comprador, paraCrudApi } from '@/data/financeiro/arquivos';

const api = paraCrudApi<Comprador>('compradores');

const colunas: CrudColumn<Comprador>[] = [
  { header: 'codcomprador', cell: (i) => i.codcomprador },
  { header: 'nome', cell: (i) => i.nome },
];

const rotulos = { codcomprador: 'CÓDIGO', nome: 'NOME DO COMPRADOR' };

const schema = z.object({
  codcomprador: z.string().optional(),
  nome: z
    .string()
    .trim()
    .min(5, 'Digite nome do comprador válido (mínimo 5 caracteres).')
    .max(40, 'O nome deve ter no máximo 40 caracteres.'),
});

const vazio: Comprador = { codcomprador: '', nome: '' };

const Formulario: React.FC<FormComponentProps<Comprador>> = ({
  formData,
  onFormChange,
  errors,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <FormInput
      name="codcomprador"
      label="Código"
      value={formData.codcomprador || ''}
      placeholder="Gerado automaticamente"
      disabled
      type=""
    />
    <div className="md:col-span-2">
      <FormInput
        name="nome"
        label="Nome do Comprador"
        value={formData.nome || ''}
        onChange={(e) => onFormChange('nome', e.target.value)}
        error={errors.nome}
        required
        maxLength={40}
        type=""
      />
    </div>
  </div>
);

const CompradoresPage = () => (
  <GenericCrudPage
    title="Compradores"
    entityName="comprador"
    idKey="codcomprador"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<Comprador>}
    emptyState={vazio}
  />
);

export default CompradoresPage;
