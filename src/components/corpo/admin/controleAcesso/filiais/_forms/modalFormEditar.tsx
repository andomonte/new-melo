import React, { useRef } from 'react';
import { Filial } from '@/data/filiais/filiais';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface FormFilialContainerProps {
  titulo: string;
  onClose: () => void;
  filial: Filial;
  isSaving?: boolean; // Adicione a prop isSaving
  filialId?: number | null;
  error?: { [p: string]: string };
  handleFilialChange: (filial: Filial) => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
}

const FormFilialContainer: React.FC<FormFilialContainerProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  filial,
  isSaving,
  error,
  handleFilialChange,
  loading = false,
}) => {
  const [hasChanges, setHasChanges] = React.useState(false);
  const valorInicialRef = useRef(filial.nome_filial); // Usando useRef para armazenar o valor inicial

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
              hasChanges={hasChanges}
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
              <FormInput
                autoComplete="off"
                name="NOME_FILIAL"
                type="text"
                label="Nome Filial"
                defaultValue={filial.nome_filial || ''}
                onChange={(e) => {
                  const valorAtual = e.target.value;
                  if (valorAtual !== valorInicialRef.current) {
                    setHasChanges(true);
                  } else {
                    setHasChanges(false);
                  }

                  handleFilialChange({
                    ...filial,
                    nome_filial: valorAtual,
                  });
                }}
                error={error?.nome_filial}
                required
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormFilialContainer;
