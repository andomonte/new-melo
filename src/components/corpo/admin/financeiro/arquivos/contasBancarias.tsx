// Financeiro > Arquivos > Contas Bancárias
// Delphi: Formularios/CONTA/UniConta.pas (package CONTA.INC_CONTA / ALT_CONTA)
// — tabela DBCONTA. A agência é obrigatória (lookup Consulta(3)), o nº da conta
// precisa de 3+ caracteres, o dígito é obrigatório e o RadioGroup grava
// 'Oficial' -> S / 'Não Oficial' -> N.
//
// Regra do Delphi replicada na API: cadastro e alteração só na Matriz (a tela
// bloqueia quando DADOS_EMPRESA.UF <> 'AM').

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
  ContaBancaria,
  buscarAgencias,
  paraCrudApi,
} from '@/data/financeiro/arquivos';
import { useLookup } from './useLookup';

const api = paraCrudApi<ContaBancaria>('contas-bancarias');

const TIPOS_CONTA = [
  { value: 'S', label: 'Oficial' },
  { value: 'N', label: 'Não Oficial' },
];

const colunas: CrudColumn<ContaBancaria>[] = [
  { header: 'cod_conta', cell: (i) => i.cod_conta },
  { header: 'cod_banco', cell: (i) => i.cod_banco },
  { header: 'n_agencia', cell: (i) => i.n_agencia || '-' },
  { header: 'agencia', cell: (i) => i.agencia || '-' },
  { header: 'nro_conta', cell: (i) => `${i.nro_conta}-${i.digito ?? ''}` },
  { header: 'oficial', cell: (i) => (i.oficial === 'S' ? 'Oficial' : 'Não Oficial') },
];

const rotulos = {
  cod_conta: 'CÓDIGO',
  cod_banco: 'CÓD. AGÊNCIA',
  n_agencia: 'Nº AGÊNCIA',
  agencia: 'AGÊNCIA',
  nro_conta: 'Nº DA CONTA',
  digito: 'DÍGITO',
  oficial: 'TIPO DE CONTA',
};

const schema = z.object({
  cod_conta: z.string().optional(),
  cod_banco: z.string().trim().min(1, 'Informe a agência.'),
  agencia: z.string().optional(),
  n_agencia: z.string().optional(),
  nro_conta: z
    .string()
    .trim()
    .min(3, 'Informe o nº da conta (mínimo 3 caracteres).')
    .max(15, 'O nº da conta deve ter no máximo 15 caracteres.'),
  digito: z
    .string()
    .trim()
    .length(1, 'Informe o dígito da conta (1 caractere).'),
  oficial: z.enum(['S', 'N']),
});

const vazio: ContaBancaria = {
  cod_conta: '',
  cod_banco: '',
  nro_conta: '',
  digito: '',
  oficial: 'S',
};

const Formulario: React.FC<FormComponentProps<ContaBancaria>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const agencias = useLookup(() => buscarAgencias());

  const opcoes = [
    { value: '', label: 'Selecione a agência...' },
    ...agencias.map((a) => ({
      value: a.cod_banco ?? '',
      label: `${a.n_agencia} - ${a.nome || a.banco_central || ''}`.trim(),
    })),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        name="cod_conta"
        label="Código"
        value={formData.cod_conta || ''}
        placeholder="Gerado automaticamente"
        disabled
        type=""
      />
      <div className="md:col-span-2">
        <FormSelect
          name="cod_banco"
          label="Agência"
          options={opcoes}
          value={formData.cod_banco || ''}
          onChange={(e) => onFormChange('cod_banco', e.target.value)}
          error={errors.cod_banco}
          required
        />
      </div>
      <FormInput
        name="nro_conta"
        label="Nº da Conta"
        value={formData.nro_conta || ''}
        onChange={(e) => onFormChange('nro_conta', e.target.value)}
        error={errors.nro_conta}
        required
        maxLength={15}
        type=""
      />
      <FormInput
        name="digito"
        label="Dígito"
        value={formData.digito || ''}
        onChange={(e) => onFormChange('digito', e.target.value)}
        error={errors.digito}
        required
        maxLength={1}
        type=""
      />
      <FormSelect
        name="oficial"
        label="Tipo de Conta"
        options={TIPOS_CONTA}
        value={formData.oficial || 'S'}
        onChange={(e) => onFormChange('oficial', e.target.value)}
        error={errors.oficial}
        required
      />
    </div>
  );
};

const ContasBancariasPage = () => (
  <GenericCrudPage
    title="Contas Bancárias"
    entityName="conta bancária"
    idKey="cod_conta"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<ContaBancaria>}
    emptyState={vazio}
  />
);

export default ContasBancariasPage;
