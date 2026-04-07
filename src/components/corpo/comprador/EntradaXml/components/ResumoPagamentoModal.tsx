import React, { useState, useEffect } from 'react';
import { X, DollarSign, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfiguracaoPagamentoModal } from '../../RequisicoesCompra/components/ConfiguracaoPagamentoModal';
import { OrdemCompraDTO } from '../../types/OrdemCompraDTO';

interface OrdemResumida {
  orc_id: number;
  orc_valor_total: number;
  orc_pagamento_configurado: boolean;
  orc_valor_entrada?: number;
  fornecedor_nome: string;
  total_parcelas?: number;
}

interface ResumoPagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordensIds: number[]; // IDs únicos das OCs envolvidas
  onConcluir: () => void; // Callback após configurar todos os pagamentos
}

export const ResumoPagamentoModal: React.FC<ResumoPagamentoModalProps> = ({
  isOpen,
  onClose,
  ordensIds,
  onConcluir
}) => {
  const [ordens, setOrdens] = useState<OrdemResumida[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordemEmConfiguracao, setOrdemEmConfiguracao] = useState<OrdemCompraDTO | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    if (isOpen && ordensIds.length > 0) {
      buscarDetalhesOrdens();
    }
  }, [isOpen, ordensIds]);

  const buscarDetalhesOrdens = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/entrada-xml/ordens-resumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordensIds })
      });

      if (response.ok) {
        const data = await response.json();
        setOrdens(data.ordens);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes das ordens:', error);
    } finally {
      setLoading(false);
    }
  };

  const ordensConfiguradas = ordens.filter(o => o.orc_pagamento_configurado);
  const ordensPendentes = ordens.filter(o => !o.orc_pagamento_configurado);

  const valorTotalPendente = ordensPendentes.reduce((sum, o) => sum + o.orc_valor_total, 0);
  const valorTotalConfigurado = ordensConfiguradas.reduce((sum, o) => sum + o.orc_valor_total, 0);

  const handleConfigurarOrdem = async (ordemId: number) => {
    try {
      // Buscar detalhes completos da ordem para passar ao modal de configuração
      const response = await fetch(`/api/ordens/${ordemId}`);
      if (response.ok) {
        const ordem = await response.json();
        setOrdemEmConfiguracao(ordem);
        setShowConfigModal(true);
      }
    } catch (error) {
      console.error('Erro ao buscar ordem:', error);
    }
  };

  const handleSuccessConfiguracao = () => {
    // Recarregar lista de ordens para atualizar status
    buscarDetalhesOrdens();
    setShowConfigModal(false);
    setOrdemEmConfiguracao(null);
  };

  const handleConcluir = () => {
    if (ordensPendentes.length > 0) {
      alert('Ainda há ordens pendentes de configuração. Configure todas antes de concluir.');
      return;
    }
    onConcluir();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              <DollarSign className="text-green-500" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Configuração de Pagamento
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ordens.length} ordem(ns) de compra vinculada(s) a esta NFe
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Carregando ordens...</p>
              </div>
            ) : (
              <>
                {/* Resumo Geral */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="text-blue-600" size={20} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total de Ordens
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ordens.length}
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="text-green-600" size={20} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Já Configuradas
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ordensConfiguradas.length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      R$ {valorTotalConfigurado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="text-yellow-600" size={20} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Pendentes
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ordensPendentes.length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      R$ {valorTotalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Lista de Ordens Configuradas */}
                {ordensConfiguradas.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <CheckCircle className="text-green-600" size={20} />
                      Ordens Já Configuradas ({ordensConfiguradas.length})
                    </h3>
                    <div className="space-y-2">
                      {ordensConfiguradas.map((ordem) => (
                        <div
                          key={ordem.orc_id}
                          className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  OC #{ordem.orc_id}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {ordem.fornecedor_nome}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Valor Total:</span>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    R$ {ordem.orc_valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                                {ordem.orc_valor_entrada && ordem.orc_valor_entrada > 0 && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Entrada:</span>
                                    <div className="font-medium text-green-600 dark:text-green-400">
                                      R$ {ordem.orc_valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                )}
                                {ordem.total_parcelas && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Parcelas:</span>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {ordem.total_parcelas}x
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="text-green-600" size={24} />
                              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                Configurado
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de Ordens Pendentes */}
                {ordensPendentes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="text-yellow-600" size={20} />
                      Ordens Pendentes de Configuração ({ordensPendentes.length})
                    </h3>
                    <div className="space-y-2">
                      {ordensPendentes.map((ordem) => (
                        <div
                          key={ordem.orc_id}
                          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  OC #{ordem.orc_id}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {ordem.fornecedor_nome}
                                </span>
                              </div>
                              <div className="mt-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Valor Total:</span>
                                <span className="font-medium text-gray-900 dark:text-white ml-2">
                                  R$ {ordem.orc_valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleConfigurarOrdem(ordem.orc_id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <DollarSign size={16} className="mr-2" />
                              Configurar Pagamento
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-zinc-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              <X size={16} className="mr-2" />
              Cancelar
            </Button>

            <Button
              onClick={handleConcluir}
              disabled={loading || ordensPendentes.length > 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle size={16} className="mr-2" />
              {ordensPendentes.length > 0
                ? `Configurar ${ordensPendentes.length} Pendente(s)`
                : 'Concluir Configuração de Pagamento'}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Configuração Individual */}
      {ordemEmConfiguracao && (
        <ConfiguracaoPagamentoModal
          isOpen={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            setOrdemEmConfiguracao(null);
          }}
          ordem={ordemEmConfiguracao}
          onSuccess={handleSuccessConfiguracao}
        />
      )}
    </>
  );
};
