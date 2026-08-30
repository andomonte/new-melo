// Financeiro > Arquivos > Operador Caixa
// Delphi: Formularios/OPERADOR CAIXA/UniOperador_Caixa.pas (CAIXA.OPERADOR),
// que amarra CONTA + USUÁRIO. No web a amarração mora em
// tb_user_perfil.cod_conta, então "cadastrar" é escolher um usuário/perfil já
// existente e apontar a conta. Na alteração o usuário fica travado, como no
// Delphi (meAltCodUsuario.ReadOnly := True).

import React from 'react';
import { z } from 'zod';
import FormSelect from '@/components/common/FormSelect';
import FormInput from '@/components/common/FormInput';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import {
  OperadorCaixa,
  buscarContas,
  buscarUsuariosPerfil,
  paraCrudApi,
} from '@/data/financeiro/arquivos';
import { useLookup } from './useLookup';

const api = paraCrudApi<OperadorCaixa>('operador-caixa');

const colunas: CrudColumn<OperadorCaixa>[] = [
  { header: 'usuario', cell: (i) => i.usuario },
  { header: 'perfil', cell: (i) => i.perfil },
  { header: 'filial', cell: (i) => i.filial || i.codigo_filial },
  { header: 'cod_conta', cell: (i) => i.cod_conta },
  {
    header: 'nro_conta',
    cell: (i) => (i.nro_conta ? `${i.nro_conta}-${i.digito ?? ''}` : '-'),
  },
];

const rotulos = {
  id: 'ID',
  usuario: 'USUÁRIO',
  perfil: 'PERFIL',
  codigo_filial: 'CÓD. FILIAL',
  filial: 'FILIAL',
  cod_conta: 'CÓD. CONTA',
  nro_conta: 'CONTA',
  digito: 'DÍGITO',
};

const schema = z.object({
  id: z.string().optional(),
  usuario: z.string().trim().min(1, 'Informe o usuário.'),
  perfil: z.string().trim().min(1, 'Informe o usuário.'),
  codigo_filial: z.union([z.string(), z.number()]),
  filial: z.string().optional(),
  cod_conta: z.string().trim().min(1, 'Informe a conta.'),
  nro_conta: z.string().optional(),
  digito: z.string().optional(),
});

const vazio: OperadorCaixa = {
  id: '',
  usuario: '',
  perfil: '',
  codigo_filial: '',
  cod_conta: '',
};

const Formulario: React.FC<FormComponentProps<OperadorCaixa>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const usuarios = useLookup(() => buscarUsuariosPerfil());
  const contas = useLookup(() => buscarContas());

  const editando = Boolean(formData.id);

  const opcoesUsuario = [
    { value: '', label: 'Selecione o usuário...' },
    ...usuarios.map((u) => ({
      value: u.id ?? '',
      label: `${u.usuario} — ${u.perfil} (${u.filial ?? u.codigo_filial})`,
    })),
  ];

  const opcoesConta = [
    { value: '', label: 'Selecione a conta...' },
    ...contas.map((c) => ({
      value: c.cod_conta,
      label: `${c.cod_conta} - ${c.nro_conta}`,
    })),
  ];

  // O <select> de usuário entrega o id composto; quebramos nos três campos
  // que a API espera.
  const selecionarUsuario = (id: string) => {
    const escolhido = usuarios.find((u) => u.id === id);
    onFormChange('usuario', escolhido?.usuario ?? '');
    onFormChange('perfil', escolhido?.perfil ?? '');
    onFormChange('codigo_filial', escolhido?.codigo_filial ?? '');
  };

  const idUsuarioAtual =
    formData.usuario && formData.perfil
      ? `${formData.usuario}|${formData.perfil}|${formData.codigo_filial}`
      : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {editando ? (
        <FormInput
          name="usuario"
          label="Usuário"
          value={`${formData.usuario} — ${formData.perfil} (${formData.filial ?? formData.codigo_filial})`}
          disabled
          type=""
        />
      ) : (
        <FormSelect
          name="usuario"
          label="Usuário"
          options={opcoesUsuario}
          value={idUsuarioAtual}
          onChange={(e) => selecionarUsuario(e.target.value)}
          error={errors.usuario}
          required
        />
      )}
      <FormSelect
        name="cod_conta"
        label="Conta (Operador)"
        options={opcoesConta}
        value={formData.cod_conta || ''}
        onChange={(e) => onFormChange('cod_conta', e.target.value)}
        error={errors.cod_conta}
        required
      />
    </div>
  );
};

const OperadorCaixaPage = () => (
  <GenericCrudPage
    title="Operador Caixa"
    entityName="operador de caixa"
    idKey="id"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: true }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<OperadorCaixa>}
    emptyState={vazio}
  />
);

export default OperadorCaixaPage;
