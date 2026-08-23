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
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
                <select
                  value={(filial as any).timezone || 'America/Manaus'}
                  onChange={(e) => {
                    setHasChanges(true);
                    handleFilialChange({ ...filial, timezone: e.target.value } as any);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="America/Manaus">America/Manaus (UTC-4)</option>
                  <option value="America/Boa_Vista">America/Boa_Vista (UTC-4)</option>
                  <option value="America/Porto_Velho">America/Porto_Velho (UTC-4)</option>
                  <option value="America/Cuiaba">America/Cuiabá (UTC-4)</option>
                  <option value="America/Sao_Paulo">America/São_Paulo (UTC-3)</option>
                  <option value="America/Recife">America/Recife (UTC-3)</option>
                  <option value="America/Fortaleza">America/Fortaleza (UTC-3)</option>
                  <option value="America/Belem">America/Belém (UTC-3)</option>
                  <option value="America/Rio_Branco">America/Rio_Branco (UTC-5)</option>
                  <option value="America/Noronha">America/Noronha (UTC-2)</option>
                  <option value="America/Bogota">America/Bogotá (UTC-5)</option>
                  <option value="America/Lima">America/Lima (UTC-5)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="Europe/Lisbon">Europe/Lisboa (UTC+0)</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código de acesso (telas soltas)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  style={{ textTransform: 'none' }}
                  defaultValue={(filial as any).codigo_acesso || ''}
                  placeholder="deixe vazio para manter o código atual"
                  onChange={(e) => {
                    setHasChanges(true);
                    handleFilialChange({ ...filial, codigo_acesso: e.target.value } as any);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Segredo compartilhado do setor, pedido ao abrir Separação / Conferência / TV. Vazio = filial sem código.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormFilialContainer;
