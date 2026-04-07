import React, { useState } from 'react';
import { ChevronDown, PlusIcon, FileSpreadsheet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RequisicoesCompraMain } from './RequisicoesCompraMain';
import OrdensComprasListImproved from './OrdemCompraManagerV2';
import PendenciasCompraModal from './PendenciasCompraModal';

type TabType = 'requisicoes' | 'ordens';

const TAB_LABELS: Record<TabType, string> = {
  requisicoes: 'Requisições de Compra',
  ordens: 'Ordens de Compra'
};

export const ComprasTabManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('requisicoes');
  const [triggerNewModal, setTriggerNewModal] = useState(false);
  const [pendenciasModalOpen, setPendenciasModalOpen] = useState(false);

  const handleTabChange = (tab: TabType) => {
    console.log('Changing tab from', activeTab, 'to', tab);
    setActiveTab(tab);
  };

  const handleNewRequisition = () => {
    // Trigger modal via state instead of page reload
    setTriggerNewModal(true);
  };

  const handleOpenPendencias = () => {
    setPendenciasModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Header compacto */}
      <div className="px-10 pt-4 pb-1 flex-shrink-0">
        {/* Header com título e botão alinhados */}
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            {TAB_LABELS[activeTab]}
          </div>

          {/* Botão Nova Requisição - só aparece na tab de requisições */}
          {activeTab === 'requisicoes' && (
            <Button
              onClick={handleNewRequisition}
              className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              <PlusIcon size={18} />
              Nova Requisição
            </Button>
          )}

          {/* Botão Relatório de Pendências - só aparece na tab de ordens */}
          {activeTab === 'ordens' && (
            <Button
              onClick={handleOpenPendencias}
              className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <FileSpreadsheet size={18} />
              Relatório de Pendências
            </Button>
          )}
        </div>

        {/* Dropdown para seleção de módulo - ABAIXO do título */}
        <div className="mb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="text-black dark:text-white">
                {TAB_LABELS[activeTab]}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={activeTab === 'requisicoes'}
                onCheckedChange={() => handleTabChange('requisicoes')}
              >
                Requisições de Compra
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeTab === 'ordens'}
                onCheckedChange={() => handleTabChange('ordens')}
              >
                Ordens de Compra
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Renderização condicional dos componentes - ocupa todo espaço restante */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'requisicoes' && (
          <div className="h-full pb-6 overflow-hidden">
            <RequisicoesCompraMain
              showNewButton={false}
              triggerNewModal={triggerNewModal}
              onModalStateChange={setTriggerNewModal}
            />
          </div>
        )}
        {activeTab === 'ordens' && (
          <div className="px-4 h-full pb-6 overflow-hidden">
            <OrdensComprasListImproved />
          </div>
        )}
      </div>

      {/* Modal de Relatório de Pendências */}
      <PendenciasCompraModal
        isOpen={pendenciasModalOpen}
        onClose={() => setPendenciasModalOpen(false)}
      />
    </div>
  );
};