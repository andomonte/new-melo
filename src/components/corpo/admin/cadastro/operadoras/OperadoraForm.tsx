// Form de cadastro/edição de Operadora de Cartão (dbopera).
import React from 'react';
import FormInput from '@/components/common/FormInput';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { OperadoraCartao } from '@/data/operadoras/operadoraCrud';

export const OperadoraForm: React.FC<FormComponentProps<OperadoraCartao>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof OperadoraCartao, e.target.value);
  };

  const ehEdicao = !!formData.codopera;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Código é automático (MAX+1). Só exibe (desabilitado); na criação fica em branco. */}
      <FormInput
        name="codopera"
        label="Código"
        value={ehEdicao ? formData.codopera : ''}
        onChange={() => {}}
        disabled
        placeholder={ehEdicao ? '' : '(gerado automaticamente)'}
        type={''}
      />

      <div className="hidden md:block" />

      <FormInput
        name="descr"
        label="Descrição"
        value={formData.descr || ''}
        onChange={handleInputChange}
        error={errors.descr}
        required
        maxLength={60}
        className="md:col-span-2"
        placeholder="Ex.: GETNET - MASTERCARD"
        type={''}
      />

      <FormInput
        name="txopera"
        label="Taxa (%)"
        value={String(formData.txopera ?? '')}
        onChange={handleInputChange}
        error={errors.txopera}
        placeholder="Ex.: 2.32"
        type={''}
      />

      <FormInput
        name="pzopera"
        label="Prazo (dias)"
        value={String(formData.pzopera ?? '')}
        onChange={handleInputChange}
        error={errors.pzopera}
        placeholder="Ex.: 31"
        type={''}
      />

      <FormInput
        name="cond_pagto"
        label="Condição de Pagamento"
        value={formData.cond_pagto || ''}
        onChange={handleInputChange}
        error={errors.cond_pagto}
        maxLength={20}
        placeholder="Opcional"
        type={''}
      />

      <FormInput
        name="codcli"
        label="Cliente Vinculado (cód.)"
        value={formData.codcli || ''}
        onChange={handleInputChange}
        error={errors.codcli}
        maxLength={10}
        placeholder="Opcional"
        type={''}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Situação</span>
        <select
          name="desativado"
          value={String(formData.desativado ?? '0')}
          onChange={(e) => onFormChange('desativado', e.target.value)}
          className="border border-gray-300 dark:border-zinc-600 rounded-md px-3 py-2 bg-white dark:bg-zinc-800 text-sm"
        >
          <option value="0">Ativo</option>
          <option value="1">Inativo</option>
        </select>
      </label>
    </div>
  );
};
