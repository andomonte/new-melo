// Financeiro > Arquivos > Operador Caixa
// Delphi: Formularios/OPERADOR CAIXA/UniOperador_Caixa.pas (CAIXA.OPERADOR),
// que amarra CONTA + USUÁRIO. No web a amarração mora em
// tb_user_perfil.cod_conta, então "vincular" é escolher um usuário/perfil já
// existente e apontar a conta. Na alteração o usuário fica travado, como no
// Delphi (meAltCodUsuario.ReadOnly := True).
//
// Além do vínculo, esta tela também:
//  - CADASTRA uma conta nova em dbconta (o Delphi não tinha isso aqui);
//  - BLOQUEIA/LIBERA a conta (dbconta.bloqueio) — é esse flag que o Caixa lê
//    para decidir se o operador pode ABRIR/RECEBER (antes era lista fixa).

import React from 'react';
import { z } from 'zod';
import { Lock, LockOpen } from 'lucide-react';
import FormSelect from '@/components/common/FormSelect';
import FormInput from '@/components/common/FormInput';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';
import {
  OperadorCaixa,
  buscarContas,
  buscarUsuariosPerfil,
  paraCrudApi,
  setBloqueioOperador,
} from '@/data/financeiro/arquivos';
import { useLookup } from './useLookup';

const api = paraCrudApi<OperadorCaixa>('operador-caixa');

const ehBloqueado = (i: OperadorCaixa) => Number(i.bloqueio) !== 0;

const colunas: CrudColumn<OperadorCaixa>[] = [
  { header: 'usuario', cell: (i) => i.usuario },
  { header: 'perfil', cell: (i) => i.perfil },
  { header: 'filial', cell: (i) => i.filial || i.codigo_filial },
  { header: 'cod_conta', cell: (i) => i.cod_conta },
  {
    header: 'nro_conta',
    cell: (i) => (i.nro_conta ? `${i.nro_conta}-${i.digito ?? ''}` : '-'),
  },
  {
    header: 'bloqueio',
    cell: (i) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          ehBloqueado(i)
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
        }`}
      >
        {ehBloqueado(i) ? 'Bloqueado' : 'Liberado'}
      </span>
    ),
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
  bloqueio: 'SITUAÇÃO',
};

const schema = z
  .object({
    id: z.string().optional(),
    usuario: z.string().trim().min(1, 'Informe o usuário.'),
    perfil: z.string().trim().min(1, 'Informe o usuário.'),
    codigo_filial: z.union([z.string(), z.number()]),
    filial: z.string().optional(),
    cod_conta: z.string().optional(),
    nro_conta: z.string().optional(),
    digito: z.string().optional(),
    oficial: z.string().optional(),
    bloqueio: z.union([z.string(), z.number()]).optional(),
    nova_conta: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.nova_conta) {
      const nome = String(v.nro_conta ?? '').trim();
      if (!nome) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nro_conta'],
          message: 'Informe o nome da conta/operador.',
        });
      } else if (nome.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nro_conta'],
          message: 'Máximo de 15 caracteres.',
        });
      }
      if (String(v.digito ?? '').trim().length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['digito'],
          message: 'Apenas 1 caractere.',
        });
      }
    } else if (!String(v.cod_conta ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cod_conta'],
        message: 'Informe a conta.',
      });
    }
  });

const vazio: OperadorCaixa = {
  id: '',
  usuario: '',
  perfil: '',
  codigo_filial: '',
  cod_conta: '',
  bloqueio: 0,
  nova_conta: false,
};

const Formulario: React.FC<FormComponentProps<OperadorCaixa>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const usuarios = useLookup(() => buscarUsuariosPerfil());
  const contas = useLookup(() => buscarContas());

  const editando = Boolean(formData.id);
  const novaConta = Boolean(formData.nova_conta);

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

      {/* Só na inclusão: escolher entre vincular conta existente ou cadastrar uma nova. */}
      {!editando && (
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={novaConta}
            onChange={(e) => {
              onFormChange('nova_conta', e.target.checked);
              // limpa o campo que deixa de valer para não enviar lixo
              if (e.target.checked) onFormChange('cod_conta', '');
              else {
                onFormChange('nro_conta', '');
                onFormChange('digito', '');
              }
            }}
          />
          Cadastrar nova conta (operador)
        </label>
      )}

      {novaConta ? (
        <>
          <FormInput
            name="nro_conta"
            label="Nome da conta / operador (máx. 15)"
            value={formData.nro_conta ?? ''}
            onChange={(e) => onFormChange('nro_conta', e.target.value)}
            error={errors.nro_conta}
            maxLength={15}
            required
            type=""
          />
          <FormInput
            name="digito"
            label="Dígito (opcional, 1 caractere)"
            value={formData.digito ?? ''}
            onChange={(e) => onFormChange('digito', e.target.value)}
            error={errors.digito}
            maxLength={1}
            type=""
          />
          <FormSelect
            name="oficial"
            label="Oficial"
            options={[
              { value: 'N', label: 'Não' },
              { value: 'S', label: 'Sim' },
            ]}
            value={formData.oficial ?? 'N'}
            onChange={(e) => onFormChange('oficial', e.target.value)}
          />
        </>
      ) : (
        <FormSelect
          name="cod_conta"
          label="Conta (Operador)"
          options={opcoesConta}
          value={formData.cod_conta || ''}
          onChange={(e) => onFormChange('cod_conta', e.target.value)}
          error={errors.cod_conta}
          required
        />
      )}

      {/* Bloqueio da conta — é o que o Caixa consulta para abrir/receber. */}
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={Number(formData.bloqueio) !== 0}
          onChange={(e) => onFormChange('bloqueio', e.target.checked ? 1 : 0)}
        />
        Bloquear este operador (impede abrir e receber no caixa)
      </label>
    </div>
  );
};

// Ação de linha com confirmação estilizada (useConfirmarSalvar) + ícone.
const AcaoBloquear: React.FC<{ item: OperadorCaixa; reload: () => void }> = ({
  item,
  reload,
}) => {
  const bloqueado = ehBloqueado(item);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  const executar = () =>
    pedirConfirmacao(
      async () => {
        await setBloqueioOperador(String(item.id), !bloqueado);
        reload();
      },
      {
        title: bloqueado ? 'Desbloquear operador' : 'Bloquear operador',
        message: bloqueado
          ? `Liberar o operador "${item.usuario}" (conta ${item.cod_conta}) para abrir e receber no caixa?`
          : `Bloquear o operador "${item.usuario}" (conta ${item.cod_conta})? Ele não poderá abrir nem receber no caixa.`,
        type: bloqueado ? 'info' : 'warning',
        confirmText: bloqueado ? 'Sim, desbloquear' : 'Sim, bloquear',
        cancelText: 'Cancelar',
      },
    );

  return (
    <>
      <button
        type="button"
        onClick={executar}
        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
      >
        {bloqueado ? (
          <LockOpen className="mr-2" size={16} />
        ) : (
          <Lock className="mr-2" size={16} />
        )}
        {bloqueado ? 'Desbloquear' : 'Bloquear'}
      </button>
      {ConfirmacaoSalvarModal}
    </>
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
    dataTableVariant="padrao"
    screenKey="operador_caixa"
    statusFilter={{
      campo: 'bloqueio',
      opcoes: [
        { label: 'Todos', valor: null },
        { label: 'Desbloqueados', valor: '0' },
        { label: 'Bloqueados', valor: '1' },
      ],
      defaultValor: null,
    }}
    rowActions={(item, reload) => (
      <AcaoBloquear item={item} reload={reload} />
    )}
  />
);

export default OperadorCaixaPage;
