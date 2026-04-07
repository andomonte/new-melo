/**
 * Modal de detalhe de uma Declaração de Importação
 * Mesmo padrão visual do NovaImportacaoModal (fullscreen, header 60/35/5)
 * Tabs: Dados Gerais | Contratos de Câmbio | Faturas/Pedidos | Custos
 */

import React from 'react';
import { X, Save, Calculator, Package, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS } from '../types/importacao';
import { TABS } from '../constants';
import { useImportacaoDetalhe } from '../hooks/useImportacaoDetalhe';
import { DadosGeraisTab } from './DadosGeraisTab';
import { ContratosTab } from './ContratosTab';
import { FaturasTab } from './FaturasTab';
import { CustosResumo } from './CustosResumo';
import Carregamento from '@/utils/carregamento';

interface ImportacaoDetalheProps {
  isOpen: boolean;
  importacaoId?: number;
  onClose: () => void;
}

export const ImportacaoDetalhe: React.FC<ImportacaoDetalheProps> = ({
  isOpen,
  importacaoId,
  onClose,
}) => {
  const {
    isNovo,
    loading,
    saving,
    error,
    activeTab,
    setActiveTab,
    cabecalho,
    setCabecalho,
    contratos,
    faturas,
    resumoCustos,
    readOnly,
    salvar,
    addContrato,
    removeContrato,
    addFatura,
    removeFatura,
    addItem,
    removeItem,
    updateItem,
    autoAssociar,
    autoAssociando,
    autoAssociadoStats,
    vincularPedidos,
    vinculandoPedidos,
    vinculadoStats,
    associarEVincular,
    associandoEVinculando,
    associarEVincularStats,
    calcularCustos,
    calculandoCustos,
    gerarEntradas,
    gerandoEntradas,
    importarDoPedido,
    dividirItem,
    moverItens,
  } = useImportacaoDetalhe(importacaoId);

  if (!isOpen) return null;

  const statusLabel = cabecalho.status
    ? STATUS_LABELS[cabecalho.status as keyof typeof STATUS_LABELS]
    : '';

  const handleSalvar = async () => {
    await salvar();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header - padrão 60/35/5 */}
        <div className="flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <header className="mb-0 w-[60%] flex items-center gap-3">
            <h4 className="text-xl font-bold text-[#347AB6]">
              {loading ? 'Carregando...' : isNovo ? 'Nova Importação' : `DI: ${cabecalho.nro_di || importacaoId}`}
            </h4>
            {statusLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                {statusLabel}
              </span>
            )}
          </header>

          <div className="w-[35%] flex justify-end gap-2">
            {!readOnly && !loading && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={calculandoCustos || !faturas.some(f => f.itens?.some(i => !!i.codprod))}
                  onClick={calcularCustos}
                  className="flex items-center gap-1"
                >
                  {calculandoCustos ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                  {calculandoCustos ? 'Calculando...' : 'Calcular Custos'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gerandoEntradas || !faturas.some(f => f.itens?.some(i => !!i.custo_unit_dolar))}
                  onClick={gerarEntradas}
                  className="flex items-center gap-1"
                >
                  {gerandoEntradas ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                  {gerandoEntradas ? 'Gerando...' : 'Gerar Entradas'}
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleSalvar}
                  className="flex items-center gap-1 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar
                </Button>
              </>
            )}
          </div>

          <div className="w-[5%] flex justify-end">
            <button onClick={onClose} className="text-gray-500 dark:text-gray-100 hover:text-red-500">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex-shrink-0">
          <div className="border-b border-gray-200 dark:border-zinc-700">
            <div className="flex gap-0">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-[#347AB6] text-[#347AB6] dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'contratos' && contratos.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300">
                      {contratos.length}
                    </span>
                  )}
                  {tab.key === 'faturas' && faturas.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300">
                      {faturas.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conteúdo da Tab */}
        <div className="flex-1 px-6 py-4 overflow-auto text-gray-800 dark:text-gray-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Carregamento texto="CARREGANDO IMPORTAÇÃO" />
            </div>
          ) : (
            <>
              {activeTab === 'geral' && (
                <DadosGeraisTab
                  dados={cabecalho}
                  onChange={setCabecalho}
                  readOnly={readOnly}
                />
              )}

              {activeTab === 'contratos' && (
                <ContratosTab
                  contratos={contratos}
                  onAdd={addContrato}
                  onRemove={removeContrato}
                  readOnly={readOnly}
                />
              )}

              {activeTab === 'faturas' && (
                <FaturasTab
                  faturas={faturas}
                  onAddFatura={addFatura}
                  onRemoveFatura={removeFatura}
                  onAddItem={addItem}
                  onRemoveItem={removeItem}
                  onUpdateItem={updateItem}
                  onAutoAssociar={autoAssociar}
                  autoAssociando={autoAssociando}
                  autoAssociadoStats={autoAssociadoStats}
                  onVincularPedidos={vincularPedidos}
                  vinculandoPedidos={vinculandoPedidos}
                  vinculadoStats={vinculadoStats}
                  onAssociarEVincular={associarEVincular}
                  associandoEVinculando={associandoEVinculando}
                  associarEVincularStats={associarEVincularStats}
                  onImportarDoPedido={(faturaIdx, itens) => {
                    const convertidos = itens.map((item) => ({
                      id_importacao: cabecalho.id || 0,
                      codprod: item.codprod,
                      descricao: item.descricao,
                      qtd: item.qtd,
                      proforma_unit: item.proforma_unit,
                      proforma_total: item.qtd * item.proforma_unit,
                      invoice_unit: item.invoice_unit,
                      invoice_total: item.qtd * item.invoice_unit,
                      unidade: item.unidade,
                      ncm: item.ncm,
                      id_orc: item.id_orc,
                    }));
                    importarDoPedido(faturaIdx, convertidos);
                  }}
                  onDividirItem={dividirItem}
                  onMoverItens={moverItens}
                  readOnly={readOnly}
                />
              )}

              {activeTab === 'custos' && (
                <CustosResumo resumo={resumoCustos} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
