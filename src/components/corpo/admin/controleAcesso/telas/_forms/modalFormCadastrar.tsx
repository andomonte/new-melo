import React, { useRef, useState } from 'react';
import { Tela } from '@/data/telas/telas';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput2'; // gera sempre maiuscula
import FormInput2 from '@/components/common/FormInput2'; // gera normal
import FormFooter from '@/components/common/FormFooter2';

interface FormTelaContainerProps {
  titulo: string;
  onClose: () => void;
  tela: Tela;
  isSaving?: boolean;
  error?: { [p: string]: string };
  handleTelaChange: (tela: Tela) => void;
  handleSubmit: () => void;
  handleClear: () => void;
}

const ModalFormCadastrarTela: React.FC<FormTelaContainerProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  tela,
  isSaving,
  error,
  handleTelaChange,
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const nomeTelaInicialRef = useRef('');
  const pathTelaInicialRef = useRef('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
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

        {/* Conteúdo */}
        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 max-w-4xl mx-auto">
            <FormInput
              uppercase
              autoComplete="off"
              name="NOME_TELA"
              type="text"
              label="Nome Tela"
              defaultValue={tela.NOME_TELA || ''}
              onChange={(e) => {
                const valorAtual = e.target.value;
                if (valorAtual !== nomeTelaInicialRef.current) {
                  setHasChanges(true);
                } else {
                  setHasChanges(false);
                }
                handleTelaChange({
                  ...tela,
                  NOME_TELA: valorAtual,
                });
              }}
              error={error?.NOME_TELA}
              required
            />

            <FormInput2
              autoComplete="off"
              name="PATH_TELA"
              type="text"
              label="Caminho Tela"
              defaultValue={tela.PATH_TELA || ''}
              onChange={(e) => {
                const valorAtual = e.target.value;
                if (valorAtual !== pathTelaInicialRef.current) {
                  setHasChanges(true);
                } else {
                  setHasChanges(false);
                }
                handleTelaChange({
                  ...tela,
                  PATH_TELA: valorAtual,
                });
              }}
              error={error?.PATH_TELA}
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalFormCadastrarTela;
