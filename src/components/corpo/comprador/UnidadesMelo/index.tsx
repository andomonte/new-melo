// Compras > Unidades Melo (cad_unidade_melo)
//
// Estabelecimentos da Melo (cada um com seu CNPJ) usados em "Entrega em" e
// "Destinado para" da Requisição e da Ordem de Compra. Regras:
//   - nome, sigla e CNPJ (14 dígitos) obrigatórios; nome e sigla não repetem;
//   - "Filial do sistema" (opcional) liga a unidade a uma filial (tb_filial):
//     é a unidade que já vem escolhida para quem está logado nessa filial;
//   - sem exclusão (requisições/ordens antigas apontam para a unidade): para
//     tirar das listas, Inativar. Inativa some da nova requisição, mas continua
//     aparecendo onde já estava gravada.

import React, { useState } from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import FormSelect from '@/components/common/FormSelect';
import { CrudColumn, GenericCrudPage } from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { paraCrudApi } from '@/data/financeiro/arquivos';
import api from '@/components/services/api';
import { useLookup } from '@/components/corpo/admin/financeiro/arquivos/useLookup';

export interface UnidadeMelo {
  unm_id?: string;
  unm_nome: string;
  unm_sigla: string;
  unm_cnpj: string;
  unm_ativo: string;
  unm_codigo_filial?: string | null;
  nome_filial?: string | null;
}

const crud = paraCrudApi<UnidadeMelo>('unidades', '/api/compras');

const formatarCnpj = (v?: string) => {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const ativa = (u: UnidadeMelo) => (u.unm_ativo ?? 'S') === 'S';

const colunas: CrudColumn<UnidadeMelo>[] = [
  { header: 'unm_id', cell: (u) => u.unm_id },
  { header: 'unm_nome', cell: (u) => u.unm_nome },
  { header: 'unm_sigla', cell: (u) => u.unm_sigla },
  { header: 'unm_cnpj', cell: (u) => formatarCnpj(u.unm_cnpj) },
  { header: 'nome_filial', cell: (u) => u.nome_filial || '—' },
  {
    header: 'unm_ativo',
    cell: (u) =>
      ativa(u) ? (
        <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs font-semibold">
          ATIVA
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 text-xs font-semibold">
          INATIVA
        </span>
      ),
  },
];

const rotulos = {
  unm_id: 'CÓDIGO',
  unm_nome: 'NOME',
  unm_sigla: 'SIGLA',
  unm_cnpj: 'CNPJ',
  nome_filial: 'FILIAL DO SISTEMA',
  unm_ativo: 'SITUAÇÃO',
  unm_codigo_filial: 'CÓD. FILIAL',
};

const schema = z.object({
  unm_id: z.union([z.string(), z.number()]).optional(),
  unm_nome: z.string().trim().min(1, 'Informe o nome da unidade.').max(30, 'O nome deve ter no máximo 30 caracteres.'),
  unm_sigla: z.string().trim().min(1, 'Informe a sigla.').max(5, 'A sigla deve ter no máximo 5 caracteres.'),
  unm_cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, { message: 'Informe o CNPJ com 14 dígitos.' }),
  unm_ativo: z.string().optional(),
  unm_codigo_filial: z.union([z.string(), z.number()]).nullable().optional(),
  nome_filial: z.string().nullable().optional(),
});

const vazio: UnidadeMelo = {
  unm_id: '',
  unm_nome: '',
  unm_sigla: '',
  unm_cnpj: '',
  unm_ativo: 'S',
  unm_codigo_filial: '',
};

const Formulario: React.FC<FormComponentProps<UnidadeMelo>> = ({ formData, onFormChange, errors }) => {
  const filiais = useLookup<{ codigo_filial: string | number; nome_filial: string }>(async () => {
    const { data } = await api.get('/api/filiais/get/todasFiliais');
    return data?.data ?? [];
  });

  const opcoesFilial = [
    { value: '', label: 'Sem ligação' },
    ...filiais.map((f) => ({ value: String(f.codigo_filial), label: `${f.codigo_filial} - ${f.nome_filial}` })),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <FormInput
          name="unm_nome"
          label="Nome"
          value={formData.unm_nome || ''}
          onChange={(e) => onFormChange('unm_nome', e.target.value.toUpperCase())}
          error={errors.unm_nome}
          required
          maxLength={30}
          placeholder="Ex.: MELO MAO"
          type=""
        />
      </div>
      <FormInput
        name="unm_sigla"
        label="Sigla"
        value={formData.unm_sigla || ''}
        onChange={(e) => onFormChange('unm_sigla', e.target.value.toUpperCase())}
        error={errors.unm_sigla}
        required
        maxLength={5}
        placeholder="Ex.: MAO"
        type=""
      />
      <FormInput
        name="unm_cnpj"
        label="CNPJ"
        value={formatarCnpj(formData.unm_cnpj)}
        onChange={(e) => onFormChange('unm_cnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
        error={errors.unm_cnpj}
        required
        inputMode="numeric"
        placeholder="00.000.000/0000-00"
        type=""
      />
      <FormSelect
        name="unm_codigo_filial"
        label="Filial do sistema (ligação)"
        options={opcoesFilial}
        value={formData.unm_codigo_filial == null ? '' : String(formData.unm_codigo_filial)}
        onChange={(e) => onFormChange('unm_codigo_filial', e.target.value)}
        error={errors.unm_codigo_filial}
      />
      <FormSelect
        name="unm_ativo"
        label="Situação"
        options={[
          { value: 'S', label: 'Ativa' },
          { value: 'N', label: 'Inativa' },
        ]}
        value={formData.unm_ativo || 'S'}
        onChange={(e) => onFormChange('unm_ativo', e.target.value)}
        error={errors.unm_ativo}
      />
      <p className="md:col-span-3 text-xs text-gray-500 dark:text-gray-400">
        A filial do sistema define qual unidade já vem escolhida em &quot;Entrega em&quot; e &quot;Destinado para&quot;
        para quem está logado nela. Unidade inativa não aparece na nova requisição, mas continua nas requisições e
        ordens em que já foi usada.
      </p>
    </div>
  );
};

const UnidadesMeloPage = () => {
  const [alternando, setAlternando] = useState(false);
  return (
    <GenericCrudPage
      title="Unidades Melo"
      entityName="unidade"
      idKey="unm_id"
      api={crud}
      columns={colunas}
      columnLabels={rotulos}
      permissions={{ canCreate: true, canEdit: true, canDelete: false }}
      FormComponent={Formulario}
      validationSchema={schema as unknown as z.Schema<UnidadeMelo>}
      emptyState={vazio}
      statusFilter={{
        campo: 'unm_ativo',
        opcoes: [
          { label: 'Ativas', valor: 'S' },
          { label: 'Inativas', valor: 'N' },
          { label: 'Todas', valor: null },
        ],
        defaultValor: null,
      }}
      rowActions={(u, reload) => (
        <button
          disabled={alternando}
          onClick={async () => {
            try {
              setAlternando(true);
              await crud.update(u.unm_id as string, { ...u, unm_ativo: ativa(u) ? 'N' : 'S' });
              reload();
            } finally {
              setAlternando(false);
            }
          }}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
        >
          {ativa(u) ? 'Inativar' : 'Ativar'}
        </button>
      )}
    />
  );
};

export default UnidadesMeloPage;
