import React, { useRef } from 'react';
import { Banco } from '@/data/bancos/bancos';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface FormBancoContainerProps {
  titulo: string;
  onClose: () => void;
  banco: Banco;
  isSaving?: boolean; // Adicione a prop isSaving
  bancoId?: string | null;
  error?: { [p: string]: string };
  handleBancoChange: (banco: Banco) => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
}

const FormBancoContainer: React.FC<FormBancoContainerProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  banco,
  isSaving,
  error,
  handleBancoChange,
  loading = false,
}) => {
  const [hasChanges, setHasChanges] = React.useState(false);
  const valorInicialNomeRef = useRef(banco.nome); // Usando useRef para armazenar o valor inicial do nome
  const valorInicialBancoRef = useRef(banco.banco); // Usando useRef para armazenar o valor inicial do código do banco

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
                name="BANCO"
                type="text"
                label="Código Banco"
                defaultValue={banco.banco || ''}
                onChange={(e) => {
                  const valorAtual = e.target.value;
                  if (valorAtual !== valorInicialBancoRef.current) {
                    setHasChanges(true);
                  } else if (banco.nome !== valorInicialNomeRef.current) {
                    setHasChanges(true);
                  } else {
                    setHasChanges(false);
                  }
                  handleBancoChange({
                    ...banco,
                    banco: valorAtual,
                  });
                }}
                error={error?.banco}
                required
              />
              <FormInput
                autoComplete="off"
                name="NOME"
                type="text"
                label="Nome Banco"
                defaultValue={banco.nome || ''}
                onChange={(e) => {
                  const valorAtual = e.target.value;
                  if (valorAtual !== valorInicialNomeRef.current) {
                    setHasChanges(true);
                  } else if (banco.banco !== valorInicialBancoRef.current) {
                    setHasChanges(true);
                  } else {
                    setHasChanges(false);
                  }
                  handleBancoChange({
                    ...banco,
                    nome: valorAtual,
                  });
                }}
                error={error?.nome}
                required
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBancoContainer;
