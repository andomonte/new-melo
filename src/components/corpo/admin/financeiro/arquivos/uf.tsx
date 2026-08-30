// Financeiro > Arquivos > UF
// Delphi: Formularios/UF_N/UniUF_N.pas — tabela DBUF_N.
// Campos e limites do Delphi: UF (mask 'AA', 2), Situação Tributária (S/N),
// Zona Insentivada (S/N), ICMS Antecipado (S/N) e as três alíquotas com
// mask '99.99'. É o único cadastro do menu, junto com o CFOP, que exclui.

import React, { useEffect } from 'react';
import { z } from 'zod';
import FormInput from '@/components/common/FormInput';
import FormSelect from '@/components/common/FormSelect';
import {
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { UnidadeFederacao, paraCrudApi } from '@/data/financeiro/arquivos';
import { OPCOES_SIM_NAO } from './useLookup';
import {
  completarPercentual,
  mascararPercentual,
  normalizarPercentual,
} from './percentual';

const api = paraCrudApi<UnidadeFederacao>('uf');

const pct = (v: unknown) =>
  `${Number(v ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const colunas: CrudColumn<UnidadeFederacao>[] = [
  { header: 'uf', cell: (i) => i.uf },
  { header: 'st', cell: (i) => (i.st === 'S' ? 'Sim' : 'Não') },
  { header: 'zona_isentivada', cell: (i) => (i.zona_isentivada === 'S' ? 'Sim' : 'Não') },
  { header: 'icms_antecipado', cell: (i) => (i.icms_antecipado === 'S' ? 'Sim' : 'Não') },
  { header: 'icmsinterno', cell: (i) => pct(i.icmsinterno) },
  { header: 'icmsexterno', cell: (i) => pct(i.icmsexterno) },
  { header: 'icmscorredor', cell: (i) => pct(i.icmscorredor) },
];

const rotulos = {
  uf: 'UF',
  st: 'SITUAÇÃO TRIBUTÁRIA',
  zona_isentivada: 'ZONA INSENTIVADA',
  icms_antecipado: 'ICMS ANTECIPADO',
  icmsinterno: 'ALÍQ. ICMS INTERNA',
  icmsexterno: 'ALÍQ. ICMS EXTERNA',
  icmscorredor: 'ALÍQ. ICMS CORREDOR',
};

const aliquota = (rotulo: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(String(v).replace(',', '.')))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 99.99, {
      message: `${rotulo} deve estar entre 0 e 99,99.`,
    });

const schema = z.object({
  uf: z
    .string()
    .trim()
    .length(2, 'A UF deve ter exatamente 2 caracteres.')
    .regex(/^[A-Za-z]{2}$/, 'A UF deve conter apenas letras.'),
  st: z.enum(['S', 'N']),
  zona_isentivada: z.enum(['S', 'N']),
  icms_antecipado: z.enum(['S', 'N']),
  icmsinterno: aliquota('A alíquota interna'),
  icmsexterno: aliquota('A alíquota externa'),
  icmscorredor: aliquota('A alíquota corredor'),
});

const vazio: UnidadeFederacao = {
  uf: '',
  st: 'N',
  zona_isentivada: 'N',
  icms_antecipado: 'N',
  icmsinterno: '00.00',
  icmsexterno: '00.00',
  icmscorredor: '00.00',
};

const ALIQUOTAS = ['icmsinterno', 'icmsexterno', 'icmscorredor'] as const;

const Formulario: React.FC<FormComponentProps<UnidadeFederacao>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  // A UF é a chave: uma vez gravada não muda (no Delphi a aba Alterar já abre
  // com a UF vinda do grid).
  const editando = Boolean(formData.uf);

  // O banco devolve numeric(5,2) como "5.00"; a máscara posicional precisa de
  // "05.00". Roda só na montagem — depois quem manda é o que o usuário digita.
  useEffect(() => {
    ALIQUOTAS.forEach((campo) => {
      const atual = String(formData[campo] ?? '');
      const normalizado = normalizarPercentual(atual);
      if (atual !== normalizado) onFormChange(campo, normalizado);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Props comuns dos três campos de alíquota (mesma máscara '99.99'). */
  const aliquotaProps = (campo: (typeof ALIQUOTAS)[number]) => ({
    name: campo,
    value: String(formData[campo] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onFormChange(campo, mascararPercentual(e.target.value)),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      onFormChange(campo, completarPercentual(e.target.value)),
    error: errors[campo],
    maxLength: 5,
    inputMode: 'numeric' as const,
    placeholder: '00.00',
    type: '',
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        name="uf"
        label="UF"
        value={formData.uf || ''}
        onChange={(e) => onFormChange('uf', e.target.value)}
        error={errors.uf}
        required
        maxLength={2}
        disabled={editando}
        type=""
      />
      <FormSelect
        name="st"
        label="Situação Tributária"
        options={OPCOES_SIM_NAO}
        value={formData.st || 'N'}
        onChange={(e) => onFormChange('st', e.target.value)}
        error={errors.st}
        required
      />
      <FormSelect
        name="zona_isentivada"
        label="Zona Insentivada"
        options={OPCOES_SIM_NAO}
        value={formData.zona_isentivada || 'N'}
        onChange={(e) => onFormChange('zona_isentivada', e.target.value)}
        error={errors.zona_isentivada}
        required
      />
      <FormSelect
        name="icms_antecipado"
        label="ICMS Antecipado"
        options={OPCOES_SIM_NAO}
        value={formData.icms_antecipado || 'N'}
        onChange={(e) => onFormChange('icms_antecipado', e.target.value)}
        error={errors.icms_antecipado}
        required
      />
      <FormInput label="Alíq. ICMS Interna (%)" {...aliquotaProps('icmsinterno')} />
      <FormInput label="Alíq. ICMS Externa (%)" {...aliquotaProps('icmsexterno')} />
      <FormInput label="Alíq. ICMS Corredor (%)" {...aliquotaProps('icmscorredor')} />
    </div>
  );
};

const UfPage = () => (
  <GenericCrudPage
    title="UF"
    entityName="UF"
    idKey="uf"
    api={api}
    columns={colunas}
    columnLabels={rotulos}
    permissions={{ canCreate: true, canEdit: true, canDelete: true }}
    FormComponent={Formulario}
    validationSchema={schema as unknown as z.Schema<UnidadeFederacao>}
    emptyState={vazio}
  />
);

export default UfPage;
