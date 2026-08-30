// Financeiro > Arquivos > Serviços
// Delphi: Formularios/SERVIÇO/UnitFormServico.pas (package COBRANCA_NF_SERVICO)
// — cadastro de serviços da NFS-e (colunas SEN_*). Regras replicadas:
//   - código, CNAE, atividade e grupo contábil são obrigatórios;
//   - SEN_CODUNICO = código + CNAE sem sinais (calculado na API);
//   - na EDIÇÃO o Delphi trava código, CNAE e atividade — só grupo contábil e
//     ISSQN podem mudar (btnAlterarServicoClick);
//   - alíquota de ISSQN zerada apenas avisa, não impede.

import React, { useEffect } from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import FormSelect from '@/components/common/FormSelect';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import {
  ServicoNfs,
  buscarGruposContabeis,
  paraCrudApi,
} from '@/data/financeiro/arquivos';
import { useLookup } from './useLookup';
import {
  completarPercentual,
  mascararPercentual,
  normalizarPercentual,
} from './percentual';

const api = paraCrudApi<ServicoNfs>('servicos');

const colunas: CrudColumn<ServicoNfs>[] = [
  { header: 'sen_codigo', cell: (i) => i.sen_codigo },
  { header: 'sen_cnae', cell: (i) => i.sen_cnae },
  { header: 'sen_atividade', cell: (i) => i.sen_atividade },
  { header: 'gpcontabil', cell: (i) => i.gpcontabil || i.sen_codgpc || '-' },
  {
    header: 'sen_issqn',
    cell: (i) =>
      `${Number(i.sen_issqn ?? 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`,
  },
];

const rotulos = {
  sen_id: 'ID',
  sen_codigo: 'CÓDIGO',
  sen_cnae: 'CNAE',
  sen_codunico: 'CÓD. ÚNICO',
  sen_atividade: 'ATIVIDADE',
  sen_codgpc: 'CÓD. GP. CONTÁBIL',
  gpcontabil: 'GRUPO CONTÁBIL',
  sen_issqn: 'ALÍQ. ISSQN',
  sen_excluido: 'EXCLUÍDO',
};

const schema = z.object({
  sen_id: z.string().optional(),
  sen_codigo: z
    .string()
    .trim()
    .min(1, 'Informe o código do serviço.')
    .max(5, 'O código deve ter no máximo 5 caracteres.'),
  sen_cnae: z
    .string()
    .trim()
    .min(1, 'Informe o CNAE do serviço.')
    .max(9, 'O CNAE deve ter no máximo 9 caracteres.'),
  sen_codunico: z.string().optional(),
  sen_atividade: z
    .string()
    .trim()
    .min(1, 'Informe a atividade do serviço.')
    .max(150, 'A atividade deve ter no máximo 150 caracteres.'),
  sen_issqn: z
    .union([z.string(), z.number()])
    .transform((v) => Number(String(v).replace(',', '.')))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 99.99, {
      message: 'A alíquota de ISSQN deve estar entre 0 e 99,99.',
    }),
  sen_codgpc: z.string().trim().min(1, 'Informe o grupo contábil do serviço.'),
  gpcontabil: z.string().optional(),
  sen_excluido: z.union([z.string(), z.number()]).optional(),
});

const vazio: ServicoNfs = {
  sen_id: '',
  sen_codigo: '',
  sen_cnae: '',
  sen_atividade: '',
  sen_issqn: '00.00',
  sen_codgpc: '',
  sen_excluido: 0,
};

const Formulario: React.FC<FormComponentProps<ServicoNfs>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const grupos = useLookup(() => buscarGruposContabeis());
  const editando = Boolean(formData.sen_id);

  // Mesma normalização da tela de UF: numeric(5,2) vem como "5.00" e a máscara
  // posicional '99.99' precisa de "05.00".
  useEffect(() => {
    const atual = String(formData.sen_issqn ?? '');
    const normalizado = normalizarPercentual(atual);
    if (atual !== normalizado) onFormChange('sen_issqn', normalizado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opcoes = [
    { value: '', label: 'Selecione o grupo contábil...' },
    ...grupos.map((g) => ({
      value: g.codgpc,
      label: `${g.codgpc} - ${g.descr}`,
    })),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        name="sen_codigo"
        label="Código"
        value={formData.sen_codigo || ''}
        onChange={(e) => onFormChange('sen_codigo', e.target.value)}
        error={errors.sen_codigo}
        required
        maxLength={5}
        disabled={editando}
        placeholder="Ex.: 14.01"
        type=""
      />
      <FormInput
        name="sen_cnae"
        label="CNAE"
        value={formData.sen_cnae || ''}
        onChange={(e) => onFormChange('sen_cnae', e.target.value)}
        error={errors.sen_cnae}
        required
        maxLength={9}
        disabled={editando}
        type=""
      />
      <FormInput
        name="sen_issqn"
        label="Alíq. ISSQN (%)"
        value={String(formData.sen_issqn ?? '')}
        onChange={(e) => onFormChange('sen_issqn', mascararPercentual(e.target.value))}
        onBlur={(e) => onFormChange('sen_issqn', completarPercentual(e.target.value))}
        error={errors.sen_issqn}
        maxLength={5}
        inputMode="numeric"
        placeholder="00.00"
        type=""
      />
      <div className="md:col-span-3">
        <FormInput
          name="sen_atividade"
          label="Atividade"
          value={formData.sen_atividade || ''}
          onChange={(e) => onFormChange('sen_atividade', e.target.value)}
          error={errors.sen_atividade}
          required
          maxLength={150}
          disabled={editando}
          type=""
        />
      </div>
      <div className="md:col-span-3">
        <FormSelect
          name="sen_codgpc"
          label="Grupo Contábil"
          options={opcoes}
          value={formData.sen_codgpc || ''}
          onChange={(e) => onFormChange('sen_codgpc', e.target.value)}
          error={errors.sen_codgpc}
          required
        />
      </div>
    </div>
  );
};

const ServicosPage = () => (
  <GenericCrudPage
    title="Serviços"
    entityName="serviço"
    idKey="sen_id"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: false }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<ServicoNfs>}
    emptyState={vazio}
  />
);

export default ServicosPage;
