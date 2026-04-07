// Componente otimizado para ações em lote com progresso
import React, { useState, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { Send, CheckCircle, XCircle, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RequisitionDTO } from '@/types/compras';
import api from '@/components/services/api';

interface BulkActionsProps {
  selectedRows: string[];
  data: RequisitionDTO[];
  permissions: {
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
    canCancel: boolean;
  };
  onClearSelection: () => void;
  onRefresh: () => void;
}

interface ProgressState {
  total: number;
  current: number;
  success: number;
  failed: number;
  processing: boolean;
}

export const BulkActionsOptimized: React.FC<BulkActionsProps> = ({
  selectedRows,
  data,
  permissions,
  onClearSelection,
  onRefresh
}) => {
  const { user } = useContext(AuthContext);
  const [progress, setProgress] = useState<ProgressState>({
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    processing: false
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Verificar ações disponíveis
  const getAvailableActions = () => {
    if (selectedRows.length === 0) return [];

    const selectedItems = data.filter(item => selectedRows.includes(item.id?.toString() || ''));
    const actions = [];

    if (permissions.canSubmit && selectedItems.some(item => item.statusRequisicao === 'P')) {
      actions.push('submit');
    }
    if (permissions.canApprove && selectedItems.some(item => item.statusRequisicao === 'S')) {
      actions.push('approve');
    }
    if (permissions.canReject && selectedItems.some(item => item.statusRequisicao === 'S')) {
      actions.push('reject');
    }
    if (permissions.canCancel && selectedItems.some(item => ['P', 'S'].includes(item.statusRequisicao || ''))) {
      actions.push('cancel');
    }

    return actions;
  };

  // Processar em lote de forma otimizada
  const processBatch = async (action: string) => {
    const selectedItems = data.filter(item => selectedRows.includes(item.id?.toString() || ''));

    setProgress({
      total: selectedItems.length,
      current: 0,
      success: 0,
      failed: 0,
      processing: true
    });
    setErrors([]);
    setShowDetails(true);

    try {
      // Usar API batch otimizada
      const response = await api.post('/api/requisicoesCompra/actions/batch', {
        action,
        userId: user?.codusr,
        userName: user?.usuario,
        requisitions: selectedItems.map(item => ({
          requisitionId: item.id?.toString() || item.requisicao || '',
          version: item.versao || 1,
          comments: `${action} em lote`
        }))
      });

      if (response.data.results) {
        const results = response.data.results;
        const failed = results.filter((r: any) => !r.success);

        setProgress(prev => ({
          ...prev,
          current: results.length,
          success: response.data.summary.success,
          failed: response.data.summary.failed,
          processing: false
        }));

        if (failed.length > 0) {
          setErrors(failed.map((r: any) =>
            `Requisição ${r.requisitionId}: ${r.message}`
          ));
        }

        // Mostrar toast de sucesso
        if (response.data.summary.success > 0) {
          console.log(`✅ ${response.data.summary.success} requisições processadas com sucesso`);
        }
      }

      // Aguardar 2s para usuário ver resultado
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Limpar seleção e atualizar lista
      onClearSelection();
      onRefresh();

      // Fechar detalhes se tudo deu certo
      if (response.data.summary.failed === 0) {
        setShowDetails(false);
      }

    } catch (error) {
      console.error('Erro no batch:', error);
      setProgress(prev => ({ ...prev, processing: false }));
      setErrors(['Erro ao processar requisições. Tente novamente.']);
    }
  };

  const availableActions = getAvailableActions();

  if (selectedRows.length === 0) return null;

  return (
    <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      {/* Header com contador */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {selectedRows.length} requisição(ões) selecionada(s)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="text-xs"
            disabled={progress.processing}
          >
            Limpar seleção
          </Button>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-2">
          {availableActions.includes('submit') && (
            <Button
              onClick={() => processBatch('submit')}
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              disabled={progress.processing}
            >
              {progress.processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Submeter Selecionadas
            </Button>
          )}

          {availableActions.includes('approve') && (
            <Button
              onClick={() => processBatch('approve')}
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
              disabled={progress.processing}
            >
              {progress.processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Aprovar Selecionadas
            </Button>
          )}

          {availableActions.includes('reject') && (
            <Button
              onClick={() => processBatch('reject')}
              size="sm"
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              disabled={progress.processing}
            >
              {progress.processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reprovar Selecionadas
            </Button>
          )}

          {availableActions.includes('cancel') && (
            <Button
              onClick={() => processBatch('cancel')}
              size="sm"
              variant="outline"
              className="text-gray-600 border-gray-300 hover:bg-gray-50"
              disabled={progress.processing}
            >
              {progress.processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Cancelar Selecionadas
            </Button>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {showDetails && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-blue-900 dark:text-blue-200">
              <span>
                Processando: {progress.current} de {progress.total}
              </span>
              <span>
                ✅ {progress.success} | ❌ {progress.failed}
              </span>
            </div>
            <Progress
              value={(progress.current / progress.total) * 100}
              className="h-2"
            />
          </div>

          {/* Erros */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">
                    Algumas requisições falharam:
                  </h4>
                  <ul className="text-xs text-red-800 dark:text-red-300 space-y-0.5">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Sucesso completo */}
          {!progress.processing && progress.failed === 0 && progress.success > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-200">
                <CheckCircle className="h-4 w-4" />
                <span>Todas as {progress.success} requisições foram processadas com sucesso!</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
