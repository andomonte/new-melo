import React, { useEffect, useCallback } from 'react';
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
}: ModalFormularioProps) {
  
  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [handleClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. CABEÇALHO FIXO */}
        <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
          <header className="flex-1">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
              {titulo}
            </h4>
          </header>
          
          <div className="flex items-center gap-3">
            {footer !== undefined ? footer : <FormFooter onSubmit={handleSubmit} onClear={handleClear} />}
            
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors duration-200"
              aria-label="Fechar modal"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 2. ÁREA DE CONTEÚDO QUE OCUPA O RESTANTE DO ESPAÇO */}
        <div className="flex-grow flex flex-col overflow-hidden p-4 sm:p-6 bg-gray-100 dark:bg-zinc-900/50">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Carregamento />
            </div>
          ) : (
            <>
              {/* Navegação por Abas (altura fixa) */}
              <div className="flex-shrink-0">
                <TabNavigation
                  tabs={tabs}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </div>
              
              {/* Conteúdo da Aba (ocupa o espaço restante e tem seu próprio scroll) */}
              <div className="flex-grow overflow-y-auto mt-4 rounded-lg bg-white dark:bg-zinc-800 shadow-inner">
                {/* A div abaixo garante um padding interno no conteúdo que rola */}
                <div className="p-4 sm:p-6">
                    {renderTabContent()}
                </div>
              </div>
            </>
          )}
        </div>
        <Toaster richColors />
      </div>
    </div>
  );
}