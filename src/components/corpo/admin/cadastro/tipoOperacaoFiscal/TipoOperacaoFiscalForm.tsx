import React, { useEffect, useState } from 'react';
import FormInput from '@/components/common/FormInput';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import {
  TipoOperacaoFiscal,
  MovimentacaoOption,
  getMovimentacoes,
} from '@/data/tipoOperacaoFiscal/tipoOperacaoFiscal';

const selectClass =
  'peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-500 ' +
  'bg-transparent px-3 py-2.5 text-sm font-normal text-gray-700 dark:text-gray-200 ' +
  'outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200';

export const TipoOperacaoFiscalForm: React.FC<
  FormComponentProps<TipoOperacaoFiscal>
> = ({ formData, onFormChange, errors }) => {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoOption[]>([]);

  useEffect(() => {
    getMovimentacoes()
      .then(setMovimentacoes)
      .catch(() => setMovimentacoes([]));
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof TipoOperacaoFiscal, e.target.value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput
        name="codigo"
        label="Código da operação"
        value={formData.codigo || ''}
        onChange={handleInput}
        error={errors.codigo}
        required
        maxLength={40}
        type={''}
        placeholder="Ex.: VENDA, TRANSFERENCIA"
      />

      <div className="relative h-[42px] w-full min-w-[200px]">
        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
          Movimentação
        </label>
        <select
          className={selectClass}
          value={formData.tipo_movimentacao || ''}
          onChange={(e) =>
            onFormChange('tipo_movimentacao', e.target.value)
          }
        >
          <option value="">Selecione…</option>
          {movimentacoes.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.descricao} ({m.codigo})
            </option>
          ))}
        </select>
        {errors.tipo_movimentacao && (
          <span className="text-red-500 text-xs">
            {errors.tipo_movimentacao}
          </span>
        )}
      </div>

      <FormInput
        name="descricao"
        label="Descrição (rótulo exibido)"
        value={formData.descricao || ''}
        onChange={handleInput}
        error={errors.descricao}
        required
        maxLength={80}
        className="md:col-span-2"
        type={''}
      />

      <FormInput
        name="ordem"
        label="Ordem"
        value={String(formData.ordem ?? '')}
        onChange={handleInput}
        error={errors.ordem}
        maxLength={4}
        type={''}
        placeholder="0"
      />

      <div className="relative h-[42px] w-full min-w-[200px]">
        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
          Ativo
        </label>
        <select
          className={selectClass}
          value={formData.ativo === false ? 'N' : 'S'}
          onChange={(e) => onFormChange('ativo', e.target.value === 'S')}
        >
          <option value="S">Sim</option>
          <option value="N">Não</option>
        </select>
      </div>

      <div className="md:col-span-2 text-[11px] text-gray-400">
        Obs.: o catálogo controla quais operações aparecem/ficam ativas na tela.
        Só operações que o motor fiscal conhece devem ficar ativas.
      </div>
    </div>
  );
};
