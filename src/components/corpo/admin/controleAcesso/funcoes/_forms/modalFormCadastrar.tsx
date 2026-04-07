import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput'; // Maiúscula
import FormInput2 from '@/components/common/FormInput2'; // Normal
import FormFooter from '@/components/common/FormFooter2';

interface FormFuncaoContainerProps {
  titulo: string;
  onClose: () => void;
  isSaving?: boolean;
  error?: { [p: string]: string };
  handleSubmitPai: (funcao: {
    descricao: string;
    sigla: string;
    usadoEm: string;
  }) => void;
}

const ModalFormCadastrarFuncao: React.FC<FormFuncaoContainerProps> = ({
  titulo,
  handleSubmitPai,

  onClose,
  isSaving,
  error,
}) => {
  const [descricao, setDescricao] = useState('');
  const [sigla, setSigla] = useState('');
  const [usadoEm, setUsadoEm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Refs para armazenar os valores iniciais
  const descricaoInicialRef = useRef('');
  const siglaInicialRef = useRef('');
  const usadoEmInicialRef = useRef('');

  /**
   * Função para verificar se houve mudanças em qualquer campo
   */
  const checkChanges = useCallback(() => {
    const hasChanged =
      descricao !== descricaoInicialRef.current ||
      sigla !== siglaInicialRef.current ||
      usadoEm !== usadoEmInicialRef.current;

    setHasChanges(hasChanged);
  }, [descricao, sigla, usadoEm]);

  /**
   * useEffect para monitorar mudanças nos campos e atualizar `hasChanges`
   */
  useEffect(() => {
    checkChanges();
  }, [checkChanges]);

  /**
   * Função para limpar os campos
   */
  const handleClearLocal = () => {
    setDescricao('');
    setSigla('');
    setUsadoEm('');
    setHasChanges(false);
  };

  /**
   * Função para submissão
   */
  const handleLocalSubmit = () => {
    const funcaoAtualizada = {
      descricao,
      sigla,
      usadoEm,
    };

    handleSubmitPai(funcaoAtualizada);
  };

  /**
   * Função centralizada para atualizar campos
   */
  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string,
  ) => {
    setter(value);
  };

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
              onSubmit={handleLocalSubmit}
              onClear={handleClearLocal}
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
            {/* Descrição */}
            <FormInput
              name="descricao"
              type="text"
              label="Descrição"
              defaultValue=""
              autoComplete="off"
              onChange={(e) => handleInputChange(setDescricao, e.target.value)}
              error={error?.descricao}
              required
            />

            {/* Sigla */}
            <FormInput2
              uppercase
              name="sigla"
              type="text"
              label="Sigla"
              defaultValue=""
              autoComplete="off"
              onChange={(e) => handleInputChange(setSigla, e.target.value)}
              error={error?.sigla}
              required
            />

            {/* Usado Em */}
            <FormInput2
              uppercase
              name="usadoEm"
              type="text"
              label="Usado Em"
              defaultValue=""
              autoComplete="off"
              onChange={(e) => handleInputChange(setUsadoEm, e.target.value)}
              error={error?.usadoEm}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalFormCadastrarFuncao;
