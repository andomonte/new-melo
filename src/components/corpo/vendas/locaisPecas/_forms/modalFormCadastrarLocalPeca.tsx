import React from 'react';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import { NovoLocalPeca } from '@/data/locaisPecas/locaisPecas';

interface ArmazemOption {
  id_armazem: number;
  nome: string;
  filial: string;
  ativo: boolean;
}

interface ModalFormCadastrarLocalPecaProps {
  titulo: string;
  handleSubmit: () => void;
  handleClear: () => void;
  handleLocalPecaChange: (updatedFields: Partial<NovoLocalPeca>) => void;
  onClose: () => void;
  localPeca: NovoLocalPeca;
  error: { [key: string]: string };
  isSaving: boolean;
  loading?: boolean;
  isFormValid: boolean;
  armazens: ArmazemOption[];
  loadingArmazens: boolean;
  isEditMode?: boolean;
}

const ModalFormCadastrarLocalPeca: React.FC<
  ModalFormCadastrarLocalPecaProps
> = ({
  titulo,
  handleSubmit,
  handleClear,
  handleLocalPecaChange,
  onClose,
  localPeca,
  error,
  isSaving,
  loading = false,
  isFormValid,
  armazens,
  loadingArmazens,
  isEditMode = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
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
              isSaving={isSaving}
              hasChanges={isFormValid}
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
              disabled={isSaving}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          {loading ? (
            <Carregamento />
          ) : (
            <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">
              {/* Grid geral responsivo */}
              {/* Primeira linha: ID Local + Armazém */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* ID do Local (50%) */}
                <div className="w-full md:w-1/2">
                  {isEditMode ? (
                    <>
                      <label htmlFor="id_local" className="text-sm font-medium">
                        ID do Local
                      </label>
                      <input
                        type="text"
                        id="id_local"
                        name="id_local"
                        value={localPeca.id_local}
                        className="mt-1 w-full rounded-md shadow-sm p-2 border bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 dark:text-white cursor-not-allowed"
                        readOnly
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        O ID do local não pode ser alterado
                      </p>
                    </>
                  ) : (
                    <FormInput
                      autoComplete="off"
                      name="id_local"
                      type="text"
                      label="ID do Local"
                      defaultValue={localPeca.id_local || ''}
                      onChange={(e) =>
                        handleLocalPecaChange({ id_local: e.target.value })
                      }
                      error={error.id_local}
                      required
                      disabled={isSaving}
                      maxLength={15}
                      placeholder="Ex: EST-A-01"
                    />
                  )}
                </div>

                {/* Armazém (50%) */}
                <div className="w-full md:w-1/2">
                  <label htmlFor="id_armazem" className="text-sm font-medium">
                    Armazém <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="id_armazem"
                    name="id_armazem"
                    value={localPeca.id_armazem}
                    onChange={(e) =>
                      handleLocalPecaChange({
                        id_armazem: parseInt(e.target.value) || 0,
                      })
                    }
                    className={`mt-1 w-full rounded-md shadow-sm p-2 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500 ${
                      error.id_armazem ? 'border-red-500' : ''
                    }`}
                    disabled={loadingArmazens || isSaving}
                  >
                    <option value={0}>
                      {loadingArmazens
                        ? 'Carregando...'
                        : 'Selecione um armazém'}
                    </option>
                    {armazens.map((armazem) => (
                      <option
                        key={armazem.id_armazem}
                        value={armazem.id_armazem}
                      >
                        {armazem.nome}
                      </option>
                    ))}
                  </select>
                  {error.id_armazem && (
                    <p className="text-sm text-red-500 mt-1">
                      {error.id_armazem}
                    </p>
                  )}
                </div>
              </div>

              {/* Segunda linha: Descrição + Tipo de Local */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Descrição (60%) */}
                <div className="w-full md:w-3/5">
                  <FormInput
                    autoComplete="off"
                    name="descricao"
                    type="text"
                    label="Descrição"
                    defaultValue={localPeca.descricao || ''}
                    onChange={(e) =>
                      handleLocalPecaChange({ descricao: e.target.value })
                    }
                    error={error.descricao}
                    disabled={isSaving}
                    maxLength={50}
                    placeholder="Ex: Estante A - Prateleira 1"
                  />
                </div>

                {/* Tipo de Local (40%) */}
                <div className="w-full md:w-2/5">
                  <FormInput
                    autoComplete="off"
                    name="tipo_local"
                    type="text"
                    label="Tipo do Local"
                    defaultValue={localPeca.tipo_local || ''}
                    onChange={(e) =>
                      handleLocalPecaChange({ tipo_local: e.target.value })
                    }
                    error={error.tipo_local}
                    disabled={isSaving}
                    maxLength={20}
                    placeholder="Ex: Estante, Prateleira, Box"
                  />
                </div>
              </div>

              {/* Terceira linha: Capacidade + Unidade */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Capacidade (50%) */}
                <div className="w-full md:w-1/2">
                  <label htmlFor="capacidade" className="text-sm font-medium">
                    Capacidade
                  </label>
                  <input
                    type="number"
                    id="capacidade"
                    name="capacidade"
                    value={localPeca.capacidade || ''}
                    onChange={(e) =>
                      handleLocalPecaChange({
                        capacidade:
                          e.target.value === ''
                            ? null
                            : parseFloat(e.target.value),
                      })
                    }
                    className={`mt-1 w-full rounded-md shadow-sm p-2 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500 ${
                      error.capacidade ? 'border-red-500' : ''
                    }`}
                    placeholder="Ex: 100"
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                  />
                  {error.capacidade && (
                    <p className="text-sm text-red-500 mt-1">
                      {error.capacidade}
                    </p>
                  )}
                </div>

                {/* Unidade (50%) */}
                <div className="w-full md:w-1/2">
                  <FormInput
                    autoComplete="off"
                    name="unidade"
                    type="text"
                    label="Unidade"
                    defaultValue={localPeca.unidade || ''}
                    onChange={(e) =>
                      handleLocalPecaChange({ unidade: e.target.value })
                    }
                    error={error.unidade}
                    disabled={isSaving}
                    maxLength={5}
                    placeholder="Ex: KG, UN, M³"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalFormCadastrarLocalPeca;
