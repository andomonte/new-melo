// Versão simplificada do RequisitionItemsManager
import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequisitionDTO, RequisitionStatus } from '@/types/compras';
import api from '@/components/services/api';

interface RequisitionItemsManagerProps {
  requisitionId: number | string;
  requisitionVersion: number | string;
  requisitionData?: RequisitionDTO;
  onBack: () => void;
  onStatusChange?: (newStatus: RequisitionStatus) => void;
  readOnly?: boolean;
}

export const RequisitionItemsManager: React.FC<RequisitionItemsManagerProps> = ({
  requisitionId,
  requisitionVersion,
  requisitionData,
  onBack,
  onStatusChange,
  readOnly = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validar IDs
    const numId = typeof requisitionId === 'string' ? parseInt(requisitionId, 10) : requisitionId;
    const numVersion = typeof requisitionVersion === 'string' ? parseInt(requisitionVersion, 10) : requisitionVersion;
    
    if (!Number.isInteger(numId) || numId <= 0) {
      setError(`ID da requisição inválido: ${requisitionId}`);
      return;
    }
    
    if (!Number.isInteger(numVersion) || numVersion <= 0) {
      setError(`Versão da requisição inválida: ${requisitionVersion}`);
      return;
    }
    
    setError(null);
    setLoading(false);
  }, [requisitionId, requisitionVersion]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Validando requisição...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-6 w-6" />
              <div>
                <h3 className="text-lg font-medium">Erro de Validação</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Gerenciar Itens - Requisição {requisitionId}/{requisitionVersion}
                  </h1>
                </div>
                
                {requisitionData && (
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {requisitionData.fornecedorNome && (
                      <span>Fornecedor: {requisitionData.fornecedorNome}</span>
                    )}
                    
                    {requisitionData.compradorNome && (
                      <span>Comprador: {requisitionData.compradorNome}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Gerenciamento de Itens
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Funcionalidade em desenvolvimento - Em breve você poderá gerenciar os itens desta requisição
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequisitionItemsManager;