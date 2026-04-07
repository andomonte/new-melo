import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  FileText,
  CreditCard,
  Package,
  Truck,
  X,
  Clock,
  DollarSign,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequisitionDTO, AcaoSistema, OrdemCompraDTO } from '@/types/compras/requisition';
import { AssociacoesModal } from './AssociacoesModal';
import { PagamentoAntecipadoModal } from './PagamentoAntecipadoModal';
import { EntregasParciaisModal } from './EntregasParciaisModal';
import api from '@/components/services/api';
import { useToast } from '@/hooks/use-toast';

interface AcoesSistemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisicao: RequisitionDTO;
  onSuccess?: () => void;
}

export const AcoesSistemaModal: React.FC<AcoesSistemaModalProps> = ({
  isOpen,
  onClose,
  requisicao,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [acoes, setAcoes] = useState<AcaoSistema[]>([]);
  const [selectedAcao, setSelectedAcao] = useState<AcaoSistema | null>(null);
  const [associacoesModal, setAssociacoesModal] = useState<{
    isOpen: boolean;
    tipo: 'CONTA_PAGAR' | 'ESTOQUE' | null;
  }>({ isOpen: false, tipo: null });

  const [pagamentoModal, setPagamentoModal] = useState<{
    isOpen: boolean;
    ordemId: number;
    valorTotal: number;
  }>({ isOpen: false, ordemId: 0, valorTotal: 0 });

  const [entregasModal, setEntregasModal] = useState<{
    isOpen: boolean;
    ordemId: number;
  }>({ isOpen: false, ordemId: 0 });

  // Carregar ações disponíveis
  useEffect(() => {
    if (isOpen && requisicao) {
      carregarAcoesDisponiveis();
    }
  }, [isOpen, requisicao]);

  const carregarAcoesDisponiveis = async () => {
    try {
      setLoading(true);

      // Simular ações baseadas no status da requisição
      const acoesDisponiveis: AcaoSistema[] = [];

      // Ações para requisições aprovadas (que já têm ordem gerada automaticamente)
      if (requisicao.statusRequisicao === 'A' && requisicao.ordemCompra) {
        // Verificar o status atual da ordem para determinar se requer pagamento antecipado
        let requerPagamentoAntecipado = false;

        try {
          const ordemResponse = await api.get(`/api/ordens/${requisicao.ordemCompra}/status`);
          const ordemStatus = ordemResponse.data?.status;

          // Requer pagamento antecipado se:
          // 1. Valor > 10.000 (regra automática) OU
          // 2. Foi marcada manualmente com status 'A' (Aguardando pagamento)
          requerPagamentoAntecipado =
            (requisicao.valorTotal && requisicao.valorTotal > 10000) ||
            (ordemStatus === 'A');
        } catch (error) {
          console.error('Erro ao verificar status da ordem:', error);
          // Fallback para regra original apenas por valor
          requerPagamentoAntecipado = requisicao.valorTotal && requisicao.valorTotal > 10000;
        }

        if (requerPagamentoAntecipado) {
          acoesDisponiveis.push({
            id: 'verificar-pagamento',
            tipo: 'VERIFICAR_PAGAMENTO',
            titulo: 'Verificar Pagamento Antecipado',
            descricao: 'Confirmar ou rejeitar pagamento antecipado da ordem',
            icone: 'DollarSign',
            cor: 'green',
            ordemCompraId: parseInt(requisicao.ordemCompra),
            permissaoRequerida: 'VERIFICAR_PAGAMENTO',
            ativa: true
          });
        }

        acoesDisponiveis.push({
          id: 'associar-conta-pagar',
          tipo: 'ASSOCIAR_CONTA_PAGAR',
          titulo: 'Associar Conta a Pagar',
          descricao: 'Vincula esta ordem a uma conta no financeiro',
          icone: 'CreditCard',
          cor: 'blue',
          requisicaoId: requisicao.id,
          ordemCompraId: parseInt(requisicao.ordemCompra),
          permissaoRequerida: 'ASSOCIAR_CONTA_PAGAR',
          ativa: true
        });

        acoesDisponiveis.push({
          id: 'associar-estoque',
          tipo: 'ASSOCIAR_ESTOQUE',
          titulo: 'Associar ao Estoque',
          descricao: 'Define o local de estoque para recebimento dos itens',
          icone: 'Package',
          cor: 'purple',
          requisicaoId: requisicao.id,
          ordemCompraId: parseInt(requisicao.ordemCompra),
          permissaoRequerida: 'ASSOCIAR_ESTOQUE',
          ativa: true
        });

        acoesDisponiveis.push({
          id: 'registrar-entrega',
          tipo: 'REGISTRAR_ENTREGA',
          titulo: 'Registrar Entrega',
          descricao: 'Registra o recebimento total ou parcial dos itens',
          icone: 'Truck',
          cor: 'orange',
          ordemCompraId: parseInt(requisicao.ordemCompra),
          permissaoRequerida: 'REGISTRAR_ENTREGA',
          ativa: true
        });
      }

      // Para requisições aprovadas sem ordem (caso de erro)
      if (requisicao.statusRequisicao === 'A' && !requisicao.ordemCompra) {
        acoesDisponiveis.push({
          id: 'gerar-ordem-manual',
          tipo: 'GERAR_ORDEM',
          titulo: 'Gerar Ordem Manualmente',
          descricao: 'Gera ordem que deveria ter sido criada automaticamente',
          icone: 'AlertTriangle',
          cor: 'red',
          requisicaoId: requisicao.id,
          permissaoRequerida: 'GERAR_ORDEM_COMPRA',
          ativa: true
        });
      }


      setAcoes(acoesDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar ações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as ações disponíveis',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const executarAcao = async (acao: AcaoSistema) => {
    try {
      setLoading(true);
      setSelectedAcao(acao);

      switch (acao.tipo) {
        case 'GERAR_ORDEM':
          await gerarOrdemManual();
          break;
        case 'VERIFICAR_PAGAMENTO':
          setPagamentoModal({
            isOpen: true,
            ordemId: acao.ordemCompraId || 0,
            valorTotal: requisicao.valorTotal || 0
          });
          return; // Não fechar o modal principal ainda
        case 'ASSOCIAR_CONTA_PAGAR':
          setAssociacoesModal({ isOpen: true, tipo: 'CONTA_PAGAR' });
          return; // Não fechar o modal principal ainda
        case 'ASSOCIAR_ESTOQUE':
          setAssociacoesModal({ isOpen: true, tipo: 'ESTOQUE' });
          return; // Não fechar o modal principal ainda
        case 'REGISTRAR_ENTREGA':
          setEntregasModal({
            isOpen: true,
            ordemId: acao.ordemCompraId || 0
          });
          return; // Não fechar o modal principal ainda
        default:
          throw new Error(`Ação não implementada: ${acao.tipo}`);
      }

      toast({
        title: 'Sucesso!',
        description: `${acao.titulo} executada com sucesso`,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(`Erro ao executar ação ${acao.tipo}:`, error);
      toast({
        title: 'Erro',
        description: `Erro ao executar ${acao.titulo}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setSelectedAcao(null);
    }
  };

  const gerarOrdemManual = async () => {
    // Esta função só é chamada em casos de erro onde a ordem não foi gerada automaticamente
    const response = await api.post('/api/ordens/gerar', {
      requisitionId: parseInt(requisicao.id),
      version: requisicao.versao,
      valorTotal: requisicao.valorTotal
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Erro ao gerar ordem de compra manualmente');
    }
  };

  const associarContaPagar = async () => {
    const response = await api.post('/api/contas-pagar/associar', {
      req_id: requisicao.id,
      req_versao: requisicao.versao,
      valor_total: requisicao.valorTotal,
      fornecedor_codigo: requisicao.fornecedorCodigo
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Erro ao associar conta a pagar');
    }
  };

  const associarEstoque = async () => {
    const response = await api.post('/api/estoque/associar', {
      req_id: requisicao.id,
      req_versao: requisicao.versao,
      local_entrega: requisicao.localEntrega
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Erro ao associar estoque');
    }
  };



  const getIconComponent = (icone: string) => {
    const icons = {
      FileText,
      CreditCard,
      Package,
      Truck,
      CheckCircle,
      Clock,
      DollarSign,
      AlertTriangle,
      Settings
    };
    const IconComponent = icons[icone as keyof typeof icons] || Settings;
    return IconComponent;
  };

  const getCorClasse = (cor: string) => {
    const cores = {
      blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
      green: 'bg-green-100 text-green-700 hover:bg-green-200',
      purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
      orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
      red: 'bg-red-100 text-red-700 hover:bg-red-200',
      gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    };
    return cores[cor as keyof typeof cores] || cores.gray;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="text-blue-500" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Ações do Sistema
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Requisição #{requisicao.requisicao || requisicao.id}
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

        {loading && acoes.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {acoes.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Nenhuma ação disponível para esta requisição no momento.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {acoes.map((acao) => {
                  const IconComponent = getIconComponent(acao.icone);
                  const corClasse = getCorClasse(acao.cor);
                  const isExecuting = selectedAcao?.id === acao.id && loading;

                  return (
                    <button
                      key={acao.id}
                      onClick={() => executarAcao(acao)}
                      disabled={!acao.ativa || loading}
                      className={`
                        w-full p-4 rounded-lg border border-gray-200 dark:border-gray-700
                        flex items-start gap-4 text-left transition-all
                        hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed
                        ${acao.ativa ? corClasse : 'bg-gray-50 text-gray-400'}
                      `}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {isExecuting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                        ) : (
                          <IconComponent size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">
                          {acao.titulo}
                        </h4>
                        <p className="text-sm opacity-75">
                          {acao.descricao}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
          >
            Fechar
          </Button>
        </div>
      </div>

      {/* Modal de Associações */}
      {associacoesModal.isOpen && associacoesModal.tipo && (
        <AssociacoesModal
          isOpen={associacoesModal.isOpen}
          onClose={() => setAssociacoesModal({ isOpen: false, tipo: null })}
          requisicao={requisicao}
          tipo={associacoesModal.tipo}
          onSuccess={() => {
            setAssociacoesModal({ isOpen: false, tipo: null });
            toast({
              title: 'Sucesso!',
              description: `Associação ${associacoesModal.tipo === 'CONTA_PAGAR' ? 'com conta a pagar' : 'com estoque'} realizada`
            });
          }}
        />
      )}

      {/* Modal de Pagamento Antecipado */}
      {pagamentoModal.isOpen && (
        <PagamentoAntecipadoModal
          isOpen={pagamentoModal.isOpen}
          onClose={() => setPagamentoModal({ isOpen: false, ordemId: 0, valorTotal: 0 })}
          ordem={{
            id: pagamentoModal.ordemId,
            valorTotal: pagamentoModal.valorTotal,
            statusPagamento: 'AGUARDANDO',
            pagamentoAntecipado: true
          }}
          onSuccess={() => {
            setPagamentoModal({ isOpen: false, ordemId: 0, valorTotal: 0 });
            toast({
              title: 'Sucesso!',
              description: 'Status de pagamento atualizado com sucesso'
            });
          }}
        />
      )}

      {/* Modal de Entregas Parciais */}
      {entregasModal.isOpen && (
        <EntregasParciaisModal
          isOpen={entregasModal.isOpen}
          onClose={() => setEntregasModal({ isOpen: false, ordemId: 0 })}
          ordem={{
            id: entregasModal.ordemId,
            itens: [], // Será carregado dentro do modal
            status: 'P'
          }}
          onSuccess={() => {
            setEntregasModal({ isOpen: false, ordemId: 0 });
            toast({
              title: 'Sucesso!',
              description: 'Entrega registrada com sucesso'
            });
          }}
        />
      )}
    </div>
  );
};