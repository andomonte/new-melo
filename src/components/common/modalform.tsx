import { X } from 'lucide-react';
import { Toaster } from 'sonner';
import Carregamento from '@/utils/carregamento';
import FormFooter2 from './FormFooter2';
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
  isSaving?: boolean;
  _isFormValid?: boolean;
  hasChanges?: boolean;
}

export default function ModalFormulario({
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
  isSaving = false,
  _isFormValid = true,
  hasChanges = true, // 🔥 Por padrão true para manter compatibilidade
}: ModalFormularioProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:dark:bg-zinc-800 bg-gray-100 dark:bg-zinc-800">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
              {titulo}
            </h4>
          </header>
          <div className="w-[35%] h-full flex justify-end">
            {footer !== undefined ? (
              footer
            ) : (
              <FormFooter2
                onSubmit={handleSubmit}
                onClear={handleClear}
                hasChanges={hasChanges}
                isSaving={isSaving}
              />
            )}
          </div>
          <div className="w-[5%] flex justify-end h-full">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500"
              disabled={isSaving}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
          {loading ? (
            <div className="w-full h-full">
              <Carregamento />
            </div>
          ) : (
            <div className="p-6">
              <div className="shadow-md rounded-lg max-w-6xl mx-auto p-6 bg-white dark:bg-zinc-800">
                {tabs.length > 1 && (
                  <TabNavigation
                    tabs={tabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                  />
                )}
                <div>
                  <form>{renderTabContent()}</form>
                </div>
              </div>
            </div>
          )}
          <Toaster />
        </div>
      </div>
    </div>
  );
}
