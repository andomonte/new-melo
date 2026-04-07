import React, { useState, useEffect } from 'react';
import { X, DollarSign, Plus, AlertCircle } from 'lucide-react';
import api from '@/components/services/api';

interface BudgetData {
  id: string;
  data: string;
  valorTotal: number;
  valorUtilizado: number;
  valorPendente: number;
  valorDisponivel: number;
  percentualUtilizado: number;
}

interface Solicitacao {
  id: string;
  valor: number;
  motivo: string;
  status: string;
  data: string;
  requisicaoId: number;
  solicitante: string;
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  valorUtilizado?: number; // Mantendo compatibilidade, mas será usado da API
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose }) => {
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados do budget
  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 BudgetModal - Carregando dados do budget...');
      const response = await api.get('/api/budget/current');
      
      if (response.data.success) {
        setBudgetData(response.data.data.budget);
        setSolicitacoes(response.data.data.solicitacoes);
        console.log('✅ BudgetModal - Dados carregados:', response.data.data.budget);
      } else {
        setError('Erro ao carregar dados do budget');
      }
    } catch (error) {
      console.error('❌ BudgetModal - Erro ao carregar budget:', error);
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBudgetData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Valores padrão enquanto carrega
  const budgetTotal = budgetData?.valorTotal || 0;
  const valorUtilizado = budgetData?.valorUtilizado || 0;
  const valorPendente = budgetData?.valorPendente || 0;
  const valorDisponivel = budgetData?.valorDisponivel || 0;
  const percentualUtilizado = budgetData?.percentualUtilizado || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="text-green-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Controle de Budget
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
          {/* Budget Total */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Budget Mensal:</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                R$ {budgetTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Valor Utilizado */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-600 dark:text-blue-400">Valor Utilizado:</span>
              <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                R$ {valorUtilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    percentualUtilizado > 100 
                      ? 'bg-red-500' 
                      : percentualUtilizado > 80 
                        ? 'bg-yellow-500' 
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(percentualUtilizado, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {percentualUtilizado.toFixed(1)}% do budget utilizado
              </div>
            </div>
          </div>

          {/* Valor Pendente */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-yellow-600 dark:text-yellow-400">Valor Pendente:</span>
              <span className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                R$ {valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Aguardando aprovação de requisições
            </div>
          </div>

          {/* Valor Disponível */}
          <div className={`p-4 rounded-lg ${
            valorDisponivel >= 0 
              ? 'bg-green-50 dark:bg-green-900/20' 
              : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            <div className="flex justify-between items-center">
              <span className={`text-sm ${
                valorDisponivel >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {valorDisponivel >= 0 ? 'Disponível:' : 'Excedido em:'}
              </span>
              <span className={`text-lg font-semibold ${
                valorDisponivel >= 0 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                R$ {Math.abs(valorDisponivel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Alerta se budget excedido */}
          {valorDisponivel < 0 && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
                <span className="text-red-700 dark:text-red-300 text-sm font-medium">
                  Budget mensal excedido! Revisar requisições pendentes.
                </span>
              </div>
            </div>
          )}

          {/* Solicitações de Budget Adicional */}
          {solicitacoes.length > 0 && (
            <div className="border-t pt-4 mt-6">
              <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Solicitações Recentes
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {solicitacoes.map((solicitacao) => (
                  <div key={solicitacao.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {solicitacao.motivo}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Req: {solicitacao.requisicaoId} • {solicitacao.solicitante} • {new Date(solicitacao.data).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          R$ {solicitacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          solicitacao.status === 'A' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : solicitacao.status === 'R'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {solicitacao.status === 'A' ? 'Aprovado' : solicitacao.status === 'R' ? 'Rejeitado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};