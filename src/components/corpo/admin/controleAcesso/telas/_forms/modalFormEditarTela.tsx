import React, { useState, useEffect } from 'react';
import { Tela } from '@/data/telas/telas'; // Remova a importação de getTela
import { X } from 'lucide-react';
import FormInput2 from '@/components/common/FormInput2';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface FormTelaContainerProps {
  titulo: string;
  onClose: () => void;
  isSaving?: boolean;
  telaData?: Tela | null; // Agora recebe telaData diretamente
  error?: { [p: string]: string };
  handleSubmitPai: (tela: Tela) => void;
}

const FormTelaContainer: React.FC<FormTelaContainerProps> = ({
  titulo,
  handleSubmitPai,
  onClose,
  isSaving,
  error,
  telaData, // Recebe os dados da tela do pai
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [nomeTela, setNomeTela] = useState('');
  const [pathTela, setPathTela] = useState('');

  const [nomeTelaInicial, setNomeTelaInicial] = useState<string | null>(null);
  const [pathTelaInicial, setPathTelaInicial] = useState<string | null>(null);

  const [telaLocal, setTelaLocal] = useState<Tela>({} as Tela);
  const [loading, setLoading] = useState<boolean>(false); // Inicialmente não carregando

  // Remova a função fetchTela

  const handleClear = () => {
    setNomeTela('');
    setPathTela('');
    setNomeTelaInicial('');
    setPathTelaInicial('');
  };

  useEffect(() => {
    if (telaData) {
      // Use os dados recebidos via prop telaData
      setTelaLocal(telaData);
      setNomeTela(telaData.NOME_TELA || '');
      setPathTela(telaData.PATH_TELA || '');
      setNomeTelaInicial(telaData.NOME_TELA || '');
      setPathTelaInicial(telaData.PATH_TELA || '');
      setLoading(false); // Dados carregados da prop
    } else {
      // Caso telaData seja null (para criação de nova tela)
      setTelaLocal({} as Tela);
      setNomeTela('');
      setPathTela('');
      setNomeTelaInicial('');
      setPathTelaInicial('');
      setLoading(false);
    }
  }, [telaData]);

  useEffect(() => {
    const nomeChanged =
      nomeTela.trim() !== (nomeTelaInicial ? nomeTelaInicial.trim() : '');
    const pathChanged =
      pathTela.trim() !== (pathTelaInicial ? pathTelaInicial.trim() : '');
    setHasChanges(nomeChanged || pathChanged);
  }, [nomeTela, pathTela, nomeTelaInicial, pathTelaInicial]);

  const handleLocalSubmit = () => {
    const telaAtualizada = {
      ...telaLocal,
      NOME_TELA: nomeTela,
      PATH_TELA: pathTela,
    };

    handleSubmitPai(telaAtualizada);
  };

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
              onSubmit={handleLocalSubmit}
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
              {/* Nome Tela */}
              <FormInput2
                uppercase
                autoComplete="off"
                name="NOME_TELA"
                type="text"
                label="Nome Tela"
                value={nomeTela}
                onChange={(e) => setNomeTela(e.target.value)}
                error={error?.NOME_TELA}
                required
              />

              {/* Caminho Tela */}
              <FormInput2
                uppercase
                autoComplete="off"
                name="PATH_TELA"
                type="text"
                label="Caminho Tela"
                value={pathTela}
                onChange={(e) => setPathTela(e.target.value)}
                error={error?.PATH_TELA}
                required
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormTelaContainer;
