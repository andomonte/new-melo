// src/components/gruposDeProdutos/_forms/modalFormCadastrarGrupoProduto.tsx
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CreateGrupoProdutoFormInput } from '@/data/gruposDeProdutos/gruposProdutoSchema';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface ModalFormCadastrarGrupoProdutoProps {
  titulo: string;
  onClose: () => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
  register: UseFormRegister<CreateGrupoProdutoFormInput>;
  errors: FieldErrors<CreateGrupoProdutoFormInput>;
  isDirty: boolean;
}

const ModalFormCadastrarGrupoProduto: React.FC<
  ModalFormCadastrarGrupoProdutoProps
> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  register,
  errors,
  loading = false,
  isDirty,
}) => {
  return (
    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Cabeçalho fixo */}
      <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
        <header className="mb-0 w-[60%]">
          <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
        </header>
        <div className="w-[35%] flex justify-end">
          <FormFooter
            onSubmit={handleSubmit}
            onClear={handleClear}
            isSaving={loading}
            hasChanges={isDirty}
          />
        </div>
        <div className="w-[5%] flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-100 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Conteúdo com scroll */}
      <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
        {loading ? (
          <Carregamento />
        ) : (
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 max-w-4xl mx-auto">
            {/* Informações Principais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Informações Principais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Código Grupo de Produto */}
                <FormInput
                  label="Código Grupo de Produto"
                  type="text"
                  id="codgpp"
                  {...register('codgpp')}
                  error={errors.codgpp?.message}
                  required
                  maxLength={5}
                />

                {/* Descrição */}
                <FormInput
                  label="Descrição"
                  type="text"
                  id="descr"
                  {...register('descr')}
                  error={errors.descr?.message}
                  required
                  maxLength={30}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Código Vendedor */}
                <FormInput
                  label="Código Vendedor"
                  type="text"
                  id="codvend"
                  {...register('codvend')}
                  error={errors.codvend?.message}
                  maxLength={5}
                />

                {/* Código Segmento */}
                <FormInput
                  label="Código Segmento"
                  type="text"
                  id="codseg"
                  {...register('codseg')}
                  error={errors.codseg?.message}
                  maxLength={5}
                />

                {/* Código Comprador */}
                <FormInput
                  label="Código Comprador"
                  type="text"
                  id="codcomprador"
                  {...register('codcomprador')}
                  error={errors.codcomprador?.message}
                  maxLength={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ramo Negócio */}
                <FormInput
                  label="Ramo Negócio"
                  type="text"
                  id="ramonegocio"
                  {...register('ramonegocio')}
                  error={errors.ramonegocio?.message}
                  maxLength={1}
                />

                {/* Dias Reposição */}
                <FormInput
                  label="Dias Reposição"
                  type="number"
                  id="diasreposicao"
                  {...register('diasreposicao', { valueAsNumber: true })}
                  error={errors.diasreposicao?.message}
                />

                {/* Bloquear Preço */}
                <FormInput
                  label="Bloquear Preço (S/N)"
                  type="text"
                  id="bloquear_preco"
                  {...register('bloquear_preco')}
                  error={errors.bloquear_preco?.message}
                  maxLength={1}
                />
              </div>
            </div>

            {/* Descontos - Balcão */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Descontos - Balcão
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormInput
                  label="Desc. Balcão"
                  type="number"
                  id="descbalcao"
                  {...register('descbalcao', { valueAsNumber: true })}
                  error={errors.descbalcao?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Balcão 30d"
                  type="number"
                  id="dscbv30"
                  {...register('dscbv30', { valueAsNumber: true })}
                  error={errors.dscbv30?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Balcão 45d"
                  type="number"
                  id="dscbv45"
                  {...register('dscbv45', { valueAsNumber: true })}
                  error={errors.dscbv45?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Balcão 60d"
                  type="number"
                  id="dscbv60"
                  {...register('dscbv60', { valueAsNumber: true })}
                  error={errors.dscbv60?.message}
                  step="0.01"
                />
              </div>

              <FormInput
                label="DSCBALCAO"
                type="number"
                id="DSCBALCAO"
                {...register('DSCBALCAO', { valueAsNumber: true })}
                error={errors.DSCBALCAO?.message}
                step="0.01"
              />
            </div>

            {/* Descontos - Revisão */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Descontos - Revisão
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Desc. Rev. 30d"
                  type="number"
                  id="dscrev30"
                  {...register('dscrev30', { valueAsNumber: true })}
                  error={errors.dscrev30?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Rev. 45d"
                  type="number"
                  id="dscrev45"
                  {...register('dscrev45', { valueAsNumber: true })}
                  error={errors.dscrev45?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Rev. 60d"
                  type="number"
                  id="dscrev60"
                  {...register('dscrev60', { valueAsNumber: true })}
                  error={errors.dscrev60?.message}
                  step="0.01"
                />
              </div>
            </div>

            {/* Descontos - Revenda */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Descontos - Revenda
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Desc. Revenda 30d"
                  type="number"
                  id="dscrv30"
                  {...register('dscrv30', { valueAsNumber: true })}
                  error={errors.dscrv30?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Revenda 45d"
                  type="number"
                  id="dscrv45"
                  {...register('dscrv45', { valueAsNumber: true })}
                  error={errors.dscrv45?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Revenda 60d"
                  type="number"
                  id="dscrv60"
                  {...register('dscrv60', { valueAsNumber: true })}
                  error={errors.dscrv60?.message}
                  step="0.01"
                />
              </div>
            </div>

            {/* Descontos - Prazo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Descontos - Prazo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Desc. Prazo 30d"
                  type="number"
                  id="dscpv30"
                  {...register('dscpv30', { valueAsNumber: true })}
                  error={errors.dscpv30?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Prazo 45d"
                  type="number"
                  id="dscpv45"
                  {...register('dscpv45', { valueAsNumber: true })}
                  error={errors.dscpv45?.message}
                  step="0.01"
                />

                <FormInput
                  label="Desc. Prazo 60d"
                  type="number"
                  id="dscpv60"
                  {...register('dscpv60', { valueAsNumber: true })}
                  error={errors.dscpv60?.message}
                  step="0.01"
                />
              </div>
            </div>

            {/* Comissões */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Comissões
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Comissão GPP"
                  type="number"
                  id="comgpp"
                  {...register('comgpp', { valueAsNumber: true })}
                  error={errors.comgpp?.message}
                  step="0.01"
                />

                <FormInput
                  label="Comissão GPP TMK"
                  type="number"
                  id="comgpptmk"
                  {...register('comgpptmk', { valueAsNumber: true })}
                  error={errors.comgpptmk?.message}
                  step="0.01"
                />

                <FormInput
                  label="Comissão GPP Ext. TMK"
                  type="number"
                  id="comgppextmk"
                  {...register('comgppextmk', { valueAsNumber: true })}
                  error={errors.comgppextmk?.message}
                  step="0.01"
                />
              </div>
            </div>

            {/* Margens de Venda */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Margens de Venda
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Margem Mín. Venda"
                  type="number"
                  id="margem_min_venda"
                  {...register('margem_min_venda', { valueAsNumber: true })}
                  error={errors.margem_min_venda?.message}
                  step="0.01"
                />

                <FormInput
                  label="Margem Média Venda"
                  type="number"
                  id="margem_med_venda"
                  {...register('margem_med_venda', { valueAsNumber: true })}
                  error={errors.margem_med_venda?.message}
                  step="0.01"
                />

                <FormInput
                  label="Margem Ideal Venda"
                  type="number"
                  id="margem_ide_venda"
                  {...register('margem_ide_venda', { valueAsNumber: true })}
                  error={errors.margem_ide_venda?.message}
                  step="0.01"
                />
              </div>
            </div>

            {/* Outros Campos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">
                Informações Adicionais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="GPP ID"
                  type="number"
                  id="gpp_id"
                  {...register('gpp_id', { valueAsNumber: true })}
                  error={errors.gpp_id?.message}
                  step="0.01"
                />

                <FormInput
                  label="P. Comercial"
                  type="number"
                  id="p_comercial"
                  {...register('p_comercial', { valueAsNumber: true })}
                  error={errors.p_comercial?.message}
                />

                <FormInput
                  label="Valor Marketing"
                  type="number"
                  id="v_marketing"
                  {...register('v_marketing', { valueAsNumber: true })}
                  error={errors.v_marketing?.message}
                  step="0.01"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Código GPC"
                  type="text"
                  id="codgpc"
                  {...register('codgpc')}
                  error={errors.codgpc?.message}
                  maxLength={4}
                />

                <FormInput
                  label="Código Grupo Pai"
                  type="number"
                  id="codgrupai"
                  {...register('codgrupai', { valueAsNumber: true })}
                  error={errors.codgrupai?.message}
                  step="0.01"
                />

                <FormInput
                  label="Código Grupo Produto"
                  type="number"
                  id="codgrupoprod"
                  {...register('codgrupoprod', { valueAsNumber: true })}
                  error={errors.codgrupoprod?.message}
                  step="0.01"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalFormCadastrarGrupoProduto;
