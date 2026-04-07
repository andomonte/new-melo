import React, { useState } from 'react';
import { ChevronDown, PlusIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { RequisicoesCompraMain } from './RequisicoesCompraMain';
import OrdensComprasListImproved from './OrdemCompraManagerV2';

export const ComprasTabManagerOrdens: React.FC = () => {
  // Inicia diretamente na tab de ordens
  const [activeTab, setActiveTab] = useState<'requisicoes' | 'ordens'>('ordens');
  const [triggerNewModal, setTriggerNewModal] = useState(false);

  const handleTabChange = (tab: 'requisicoes' | 'ordens') => {
    console.log('🔄 Changing tab from', activeTab, 'to', tab);
    setActiveTab(tab);
  };

  const handleNewRequisition = () => {
    setTriggerNewModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Header compacto */}
      <div className="px-10 pt-4 pb-1 flex-shrink-0">
        {/* Header com título e botão alinhados */}
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            {activeTab === 'requisicoes' ? 'Requisições de Compra' : 'Ordens de Compra'}
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
        </div>

        {/* Dropdown para seleção de módulo - ABAIXO do título */}
        <div className="mb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="text-black dark:text-white">
                {activeTab === 'requisicoes' ? 'Requisições de Compra' : 'Ordens de Compra'} 
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
        {activeTab === 'requisicoes' ? (
          <div className="h-full pb-6 overflow-hidden">
            <RequisicoesCompraMain
              showNewButton={false}
              triggerNewModal={triggerNewModal}
              onModalStateChange={setTriggerNewModal}
            />
          </div>
        ) : (
          <div className="px-4 h-full pb-6 overflow-hidden">
            <OrdensComprasListImproved />
          </div>
        )}
      </div>
    </div>
  );
};