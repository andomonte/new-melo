import { X } from 'lucide-react';
import { Toaster } from 'sonner';
import Carregamento from '@/utils/carregamento';
import FormFooter from './FormFooter';
import TabNavigation from './TabNavigation';

interface ModalFormularioProps {
  titulo: string;
  tabs: any[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  renderTabContent: () => React.ReactNode;
  handleSubmit: () => void;
  handleClear: () => void;
  onClose: () => void;
  loading?: boolean;
  footer?: React.ReactNode;
  summary?: React.ReactNode; // Prop para o resumo
}

export default function ModalFormularioFaturamento({
  titulo,
  tabs,
  activeTab,
  setActiveTab,
  renderTabContent,
  handleSubmit,
  handleClear,
  onClose,
  loading = false,
  footer,
  summary,
}: ModalFormularioProps) {
  return (
    // Camada de fundo
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {/* Contêiner principal do Modal: define a altura e a direção da flexbox */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        
        {/* CABEÇALHO: Não estica */}
        <div className="flex-shrink-0 flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
              {titulo}
            </h4>
          </header>
          <div className="w-[35%] h-full flex justify-end">
            {footer ?? <FormFooter onSubmit={handleSubmit} onClear={handleClear} />}
          </div>
          <div className="w-[5%] flex justify-end h-full">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO: Estica para preencher o espaço e tem rolagem interna */}
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50 dark:bg-zinc-900">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Carregamento />
            </div>
          ) : (
            <form className="max-w-6xl mx-auto">{renderTabContent()}</form>
          )}
        </div>

        {/* RODAPÉ/RESUMO: Não estica */}
        {summary && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700">
            {summary}
          </div>
        )}

        <Toaster />
      </div>
    </div>
  );
}