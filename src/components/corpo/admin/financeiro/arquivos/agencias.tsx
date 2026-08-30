// Financeiro > Arquivos > Agências
// Delphi: Geral/UniBanco.pas (package BANCO.INC_AGENCIA / ALT_AGENCIA) —
// tabela DBBANCO. O código da agência é gerado; o banco central é escolhido
// pelo botão "..." (dmConsulta.Consulta(18)) e é obrigatório, assim como o
// número da agência (ambos com 3+ caracteres).

import React from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import FormSelect from '@/components/common/FormSelect';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import {
  Agencia,
  buscarBancosCentrais,
  paraCrudApi,
} from '@/data/financeiro/arquivos';
import { useLookup } from './useLookup';

const api = paraCrudApi<Agencia>('agencias');

const colunas: CrudColumn<Agencia>[] = [
  { header: 'cod_banco', cell: (i) => i.cod_banco },
  { header: 'cod_bc', cell: (i) => i.cod_bc },
  { header: 'banco_central', cell: (i) => i.banco_central || '-' },
  { header: 'n_agencia', cell: (i) => i.n_agencia },
  { header: 'nome', cell: (i) => i.nome },
  { header: 'cidade', cell: (i) => i.cidade },
  { header: 'uf', cell: (i) => i.uf },
];

const rotulos = {
  cod_banco: 'CÓDIGO',
  cod_bc: 'Nº BANCO',
  codbc: 'Nº BANCO',
  banco_central: 'BANCO CENTRAL',
  n_agencia: 'Nº AGÊNCIA',
  nome: 'NOME DA AGÊNCIA',
  endereco: 'ENDEREÇO',
  cidade: 'CIDADE',
  uf: 'UF',
  cep: 'CEP',
  contatos: 'CONTATOS',
};

const schema = z.object({
  cod_banco: z.string().optional(),
  cod_bc: z.string().trim().min(1, 'Informe o banco.'),
  codbc: z.string().optional(),
  banco_central: z.string().optional(),
  nome: z.string().trim().max(45, 'O nome deve ter no máximo 45 caracteres.'),
  n_agencia: z
    .string()
    .trim()
    .min(3, 'Informe o número da agência (mínimo 3 caracteres).')
    .max(10, 'O número da agência deve ter no máximo 10 caracteres.'),
  endereco: z.string().trim().max(50, 'O endereço deve ter no máximo 50 caracteres.'),
  cidade: z.string().trim().max(20, 'A cidade deve ter no máximo 20 caracteres.'),
  uf: z.string().trim().max(2, 'A UF deve ter no máximo 2 caracteres.'),
  cep: z.string().trim().max(9, 'O CEP deve ter no máximo 9 caracteres.'),
  contatos: z.string().trim().max(25, 'Os contatos devem ter no máximo 25 caracteres.'),
});

const vazio: Agencia = {
  cod_banco: '',
  cod_bc: '',
  nome: '',
  n_agencia: '',
  endereco: '',
  cidade: '',
  uf: '',
  cep: '',
  contatos: '',
};

const Formulario: React.FC<FormComponentProps<Agencia>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const bancos = useLookup(() => buscarBancosCentrais());

  const opcoes = [
    { value: '', label: 'Selecione o banco...' },
    ...bancos.map((b) => ({ value: b.codbc, label: `${b.codbc} - ${b.descr}` })),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        name="cod_banco"
        label="Código"
        value={formData.cod_banco || ''}
        placeholder="Gerado automaticamente"
        disabled
        type=""
      />
      <div className="md:col-span-2">
        <FormSelect
          name="cod_bc"
          label="Banco Central"
          options={opcoes}
          value={formData.cod_bc || ''}
          onChange={(e) => onFormChange('cod_bc', e.target.value)}
          error={errors.cod_bc}
          required
        />
      </div>
      <FormInput
        name="n_agencia"
        label="Nº da Agência"
        value={formData.n_agencia || ''}
        onChange={(e) => onFormChange('n_agencia', e.target.value)}
        error={errors.n_agencia}
        required
        maxLength={10}
        type=""
      />
      <div className="md:col-span-2">
        <FormInput
          name="nome"
          label="Nome da Agência"
          value={formData.nome || ''}
          onChange={(e) => onFormChange('nome', e.target.value)}
          error={errors.nome}
          maxLength={45}
          type=""
        />
      </div>
      <div className="md:col-span-2">
        <FormInput
          name="endereco"
          label="Endereço"
          value={formData.endereco || ''}
          onChange={(e) => onFormChange('endereco', e.target.value)}
          error={errors.endereco}
          maxLength={50}
          type=""
        />
      </div>
      <FormInput
        name="cep"
        label="CEP"
        value={formData.cep || ''}
        onChange={(e) => onFormChange('cep', e.target.value)}
        error={errors.cep}
        maxLength={9}
        type=""
      />
      <FormInput
        name="cidade"
        label="Cidade"
        value={formData.cidade || ''}
        onChange={(e) => onFormChange('cidade', e.target.value)}
        error={errors.cidade}
        maxLength={20}
        type=""
      />
      <FormInput
        name="uf"
        label="UF"
        value={formData.uf || ''}
        onChange={(e) => onFormChange('uf', e.target.value)}
        error={errors.uf}
        maxLength={2}
        type=""
      />
      <FormInput
        name="contatos"
        label="Contatos"
        value={formData.contatos || ''}
        onChange={(e) => onFormChange('contatos', e.target.value)}
        error={errors.contatos}
        maxLength={25}
        type=""
      />
    </div>
  );
};

const AgenciasPage = () => (
  <GenericCrudPage
    title="Agências"
    entityName="agência"
    idKey="cod_banco"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<Agencia>}
    emptyState={vazio}
  />
);

export default AgenciasPage;
