import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Truck,
  FileText,
  Calendar,
  User,
  X,
  CheckCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequisitionItem, EntregaParcial } from '@/types/compras/requisition';
import api from '@/components/services/api';
import { useToast } from '@/hooks/use-toast';

interface EntregasParciaisModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RequisitionItem;
  onSuccess?: () => void;
}

export const EntregasParciaisModal: React.FC<EntregasParciaisModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [entregas, setEntregas] = useState<EntregaParcial[]>([]);
  const [showNovaEntrega, setShowNovaEntrega] = useState(false);
  const [novaEntrega, setNovaEntrega] = useState({
    quantidadeEntregue: '',
    dataEntrega: new Date().toISOString().split('T')[0],
    notaFiscal: '',
    serieNF: '',
    responsavelRecebimento: '',
    observacao: ''
  });

  // Carregar histórico de entregas
  useEffect(() => {
    if (isOpen && item) {
      carregarEntregas();
    }
  }, [isOpen, item]);

  const carregarEntregas = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/requisicoes/${item.reqId}/items/${item.itemSeq}/entregas`);

      if (response.data?.success) {
        setEntregas(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      // Usar dados mock para demonstração
      setEntregas(item.entregasParciais || []);
    } finally {
      setLoading(false);
    }
  };

  const calcularEstatisticas = () => {
    const totalEntregue = entregas.reduce((sum, entrega) => sum + entrega.quantidadeEntregue, 0);
    const pendente = item.quantidade - totalEntregue;
    const percentual = (totalEntregue / item.quantidade) * 100;

    return {
      totalEntregue,
      pendente,
      percentual: Math.min(percentual, 100)
    };
  };

  const registrarNovaEntrega = async () => {
    try {
      const quantidade = parseFloat(novaEntrega.quantidadeEntregue);
      const { pendente } = calcularEstatisticas();

      // Validações
      if (!quantidade || quantidade <= 0) {
        toast({
          title: 'Erro',
          description: 'Quantidade deve ser maior que zero',
          variant: 'destructive'
        });
        return;
      }

      if (quantidade > pendente) {
        toast({
          title: 'Erro',
          description: `Quantidade não pode ser maior que ${pendente} (pendente)`,
          variant: 'destructive'
        });
        return;
      }

      if (!novaEntrega.responsavelRecebimento.trim()) {
        toast({
          title: 'Erro',
          description: 'Responsável pelo recebimento é obrigatório',
          variant: 'destructive'
        });
        return;
      }

      setLoading(true);

      const payload = {
        itemReqId: item.reqId,
        itemReqVersao: item.reqVersao,
        itemSeq: item.itemSeq,
        quantidadeEntregue: quantidade,
        dataEntrega: novaEntrega.dataEntrega,
        notaFiscal: novaEntrega.notaFiscal || null,
        serieNF: novaEntrega.serieNF || null,
        responsavelRecebimento: novaEntrega.responsavelRecebimento,
        observacao: novaEntrega.observacao || null
      };

      const response = await api.post('/api/entregas/registrar', payload);

      if (response.data?.success) {
        toast({
          title: 'Sucesso!',
          description: 'Entrega registrada com sucesso'
        });

        // Resetar formulário
        setNovaEntrega({
          quantidadeEntregue: '',
          dataEntrega: new Date().toISOString().split('T')[0],
          notaFiscal: '',
          serieNF: '',
          responsavelRecebimento: '',
          observacao: ''
        });
        setShowNovaEntrega(false);

        // Recarregar entregas
        await carregarEntregas();
        onSuccess?.();
      } else {
        throw new Error(response.data?.message || 'Erro ao registrar entrega');
      }
    } catch (error) {
      console.error('Erro ao registrar entrega:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a entrega',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const { totalEntregue, pendente, percentual } = calcularEstatisticas();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="text-blue-500" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Controle de Entregas Parciais
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.descricao} (Código: {item.codprod})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Resumo do Item */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Quantidade Total</span>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{item.quantidade}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Entregue</span>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">{totalEntregue}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Pendente</span>
              <p className="text-lg font-bold text-orange-900 dark:text-orange-100">{pendente}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Progresso</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentual}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-purple-900 dark:text-purple-100">
                  {percentual.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botão Nova Entrega */}
        {pendente > 0 && (
          <div className="mb-6">
            <Button
              onClick={() => setShowNovaEntrega(!showNovaEntrega)}
              className="flex items-center gap-2"
              disabled={loading}
            >
              <Plus size={16} />
              Registrar Nova Entrega
            </Button>
          </div>
        )}

        {/* Formulário Nova Entrega */}
        {showNovaEntrega && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium text-green-800 dark:text-green-200 mb-4">
              Nova Entrega
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantidade Entregue *
                </label>
                <Input
                  type="number"
                  value={novaEntrega.quantidadeEntregue}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, quantidadeEntregue: e.target.value }))}
                  placeholder={`Máximo: ${pendente}`}
                  max={pendente}
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data da Entrega *
                </label>
                <Input
                  type="date"
                  value={novaEntrega.dataEntrega}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, dataEntrega: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nota Fiscal
                </label>
                <Input
                  value={novaEntrega.notaFiscal}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, notaFiscal: e.target.value }))}
                  placeholder="Número da NF"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Série NF
                </label>
                <Input
                  value={novaEntrega.serieNF}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, serieNF: e.target.value }))}
                  placeholder="Série"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Responsável Recebimento *
                </label>
                <Input
                  value={novaEntrega.responsavelRecebimento}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, responsavelRecebimento: e.target.value }))}
                  placeholder="Nome do responsável"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observações
                </label>
                <Input
                  value={novaEntrega.observacao}
                  onChange={(e) => setNovaEntrega(prev => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Observações da entrega"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={registrarNovaEntrega}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Registrando...' : 'Registrar Entrega'}
              </Button>
              <Button
                onClick={() => setShowNovaEntrega(false)}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Histórico de Entregas */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
            Histórico de Entregas ({entregas.length})
          </h4>

          {loading && entregas.length === 0 ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : entregas.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhuma entrega registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entregas.map((entrega, index) => (
                <div
                  key={entrega.id || index}
                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-green-500 mt-1" size={20} />
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            Quantidade: {entrega.quantidadeEntregue}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="inline mr-1" size={14} />
                            {new Date(entrega.dataEntrega).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {(entrega.notaFiscal || entrega.serieNF) && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <FileText className="inline mr-1" size={14} />
                            NF: {entrega.notaFiscal || 'N/A'}
                            {entrega.serieNF && ` - Série: ${entrega.serieNF}`}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <User className="inline mr-1" size={14} />
                          Recebido por: {entrega.responsavelRecebimento}
                        </div>
                        {entrega.observacao && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Obs: {entrega.observacao}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      #{index + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};