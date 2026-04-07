import React, { useState, useEffect } from 'react';
import { Search, History, Eye, Calendar, User, Package, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/components/services/api';
import { HistoricoModal } from '../RequisicoesCompra/components/HistoricoModal';

interface HistoricoResumo {
  req_id: number;
  req_versao: number;
  req_numero: string;
  fornecedor_nome: string;
  comprador_nome: string;
  status_atual: string;
  status_label: string;
  total_mudancas: number;
  ultima_mudanca: string;
  data_criacao: string;
}

export default function HistoricoComprasPage() {
  const [historicos, setHistoricos] = useState<HistoricoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredHistoricos, setFilteredHistoricos] = useState<HistoricoResumo[]>([]);
  const [selectedHistorico, setSelectedHistorico] = useState<HistoricoResumo | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    loadHistoricoResumo();
  }, []);

  useEffect(() => {
    const filtered = historicos.filter(item =>
      item.req_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fornecedor_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.comprador_nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredHistoricos(filtered);
  }, [searchTerm, historicos]);

  const loadHistoricoResumo = async () => {
    setLoading(true);
    try {
      // API simulada - você pode ajustar para usar a API real
      const response = await api.get('/api/requisicoesCompra/historico-resumo');
      
      if (response.data.success) {
        setHistoricos(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico resumo:', error);
      setHistoricos([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'P': return 'bg-yellow-500';
      case 'S': return 'bg-blue-500';
      case 'A': return 'bg-green-500';
      case 'R': return 'bg-red-500';
      case 'C': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const handleVerHistorico = (historico: HistoricoResumo) => {
    setSelectedHistorico(historico);
    setHistoricoModalOpen(true);
  };

  const toggleExpand = (reqId: number) => {
    setExpandedCard(expandedCard === reqId ? null : reqId);
  };

  return (
    <div className="h-full flex w-full flex-col bg-muted/40 text-black dark:text-gray-50">
      <div className="border-b border-l border-r border-gray-300 h-full w-full">
        <div className="w-full h-full border-t border-gray-300 dark:bg-black bg-white">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <History className="h-6 w-6 text-[#347AB6]" />
                <h1 className="text-2xl font-bold text-[#347AB6] dark:text-gray-200">
                  Histórico de Compras
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Acompanhe o histórico completo de mudanças das requisições de compra
              </p>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por número da requisição, fornecedor ou comprador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando histórico...</span>
              </div>
            ) : filteredHistoricos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <History className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum histórico disponível'}
                </p>
                <p className="text-sm">
                  {searchTerm 
                    ? 'Tente ajustar os termos de busca'
                    : 'O histórico será exibido conforme as requisições forem processadas.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto">
                {filteredHistoricos.map((historico) => (
                  <div key={`${historico.req_id}-${historico.req_versao}`} 
                       className="bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600">
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {historico.req_numero}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {historico.fornecedor_nome}
                            </p>
                          </div>
                          <div className={`px-3 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(historico.status_atual)}`}>
                            {historico.status_label}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleVerHistorico(historico)}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Ver Histórico
                          </button>
                          <button
                            onClick={() => toggleExpand(historico.req_id)}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            {expandedCard === historico.req_id ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">Comprador:</span>
                          <span className="font-medium">{historico.comprador_nome}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">Mudanças:</span>
                          <span className="font-medium">{historico.total_mudancas}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">Última mudança:</span>
                          <span className="font-medium">{formatDate(historico.ultima_mudanca)}</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedCard === historico.req_id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Data de criação:</span>
                              <p className="font-medium">{formatDate(historico.data_criacao)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">ID da requisição:</span>
                              <p className="font-medium">{historico.req_id}/{historico.req_versao}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={() => handleVerHistorico(historico)}
                              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
                            >
                              <History className="h-4 w-4" />
                              Ver Histórico Completo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Histórico */}
      {selectedHistorico && (
        <HistoricoModal
          isOpen={historicoModalOpen}
          onClose={() => {
            setHistoricoModalOpen(false);
            setSelectedHistorico(null);
          }}
          requisitionId={selectedHistorico.req_id}
          requisitionVersion={selectedHistorico.req_versao}
          requisitionNumber={selectedHistorico.req_numero}
        />
      )}
    </div>
  );
}
