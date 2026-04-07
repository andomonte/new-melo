import React from 'react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import api from '@/components/services/api';
import { ArrowLeft, Package, User, Calendar, FileText, MapPin, CreditCard } from 'lucide-react';

const ViewRequisitionPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [requisition, setRequisition] = useState<RequisitionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchRequisition = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/requisicoesCompra/${id}`);
        if (response.data.success) {
          setRequisition(response.data.data);
        } else {
          setError(response.data.message || 'Erro ao carregar requisição');
        }
      } catch (error: any) {
        console.error('Error fetching requisition:', error);
        setError(error.response?.data?.message || 'Erro ao carregar requisição');
      } finally {
        setLoading(false);
      }
    };

    fetchRequisition();
  }, [id]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'P': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'A': { label: 'Aprovada', color: 'bg-green-100 text-green-800 border-green-200' },
      'R': { label: 'Reprovada', color: 'bg-red-100 text-red-800 border-red-200' },
      'C': { label: 'Cancelada', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      'S': { label: 'Submetida', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'E': { label: 'Em Análise', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'F': { label: 'Finalizada', color: 'bg-green-100 text-green-800 border-green-200' },
    };
    
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando requisição...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Erro</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Requisição não encontrada</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-6">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4"
            >
              <ArrowLeft size={16} />
              Voltar para listagem
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Requisição {requisition.requisicao}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Visualização detalhada da requisição de compra
                </p>
              </div>
              <div>
                {getStatusBadge(requisition.statusRequisicao || 'P')}
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText size={20} />
                Informações Básicas
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Data da Requisição:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {requisition.dataRequisicao ? new Date(requisition.dataRequisicao).toLocaleDateString('pt-BR') : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Package size={16} className="text-gray-400" />
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tipo:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {requisition.tipo || 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Versão:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {requisition.versao}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <User size={20} />
                Fornecedor
              </h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Código:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {requisition.fornecedorCodigo || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Nome:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {requisition.fornecedorNome || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">CPF/CNPJ:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {requisition.fornecedorCpfCnpj || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Buyer Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <User size={20} />
                Comprador
              </h2>
              
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Nome:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {requisition.compradorNome || 'N/A'}
                </p>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin size={20} />
                Entrega
              </h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Local de Entrega:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {requisition.localEntrega || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Destinado para:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {requisition.destino || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <CreditCard size={20} />
                Condições de Pagamento
              </h2>
              
              <p className="text-gray-900 dark:text-gray-100">
                {requisition.condicoesPagamento || 'N/A'}
              </p>
            </div>

            {/* Observations */}
            {requisition.observacao && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <FileText size={20} />
                  Observações
                </h2>
                
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {requisition.observacao}
                  </p>
                </div>
              </div>
            )}
          </div>
    </div>
  );
};

export default ViewRequisitionPage;