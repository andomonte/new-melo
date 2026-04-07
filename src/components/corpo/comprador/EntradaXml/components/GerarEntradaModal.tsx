import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, Package, DollarSign, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import MessageModal from '@/components/common/MessageModal';
import { ConfiguracaoPagamentoNFeModal } from './ConfiguracaoPagamentoNFeModal';
import CadastroConhecimentoModal from './CadastroConhecimentoModal';

interface DadosConhecimento {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  icms: number;
  baseicms: number;
  totalcon: number;
  totaltransp: number;
  dtcon: string;
  cif: 'S' | 'N';
  tipocalc: '1' | '2';
  tipocon: '08' | '09' | '10';
  kg?: number;
  kgcub?: number;
  chave?: string;
  protocolo?: string;
  nomebarco?: string;
  placacarreta?: string;
}

interface AssociatedItem {
  nfeItemId: string;
  produtoId: string;
  associacoes: ItemAssociation[];
  meianota: boolean;
  precoReal?: number;
}

interface ItemAssociation {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

interface GerarEntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfeId: string;
  associatedItems: AssociatedItem[];
  onConfirm: (entradaId: number, numeroEntrada: string, nfeId: string) => void;
  loading?: boolean;
}

export const GerarEntradaModal: React.FC<GerarEntradaModalProps> = ({
  isOpen,
  onClose,
  nfeId,
  associatedItems,
  onConfirm,
  loading = false
}) => {
  const [dadosComplementares, setDadosComplementares] = useState({
    informarSelo: true, // Sempre habilitado (obrigatório)
    numeroSelo: '',
    temConhecimento: true, // Sempre habilitado (obrigatório)
    numeroConhecimento: '',
    observacoes: ''
  });

  const [confirmacoesPendentes, setConfirmacoesPendentes] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [messageData, setMessageData] = useState({ title: '', message: '', type: 'info' as any });

  // 💰 Novo: Estados para configuração de pagamento DA NFe (não mais por ordem)
  const [showConfigPagamentoNFe, setShowConfigPagamentoNFe] = useState(false);
  const [pagamentoNFeConfigurado, setPagamentoNFeConfigurado] = useState(false);
  const [carregandoStatus, setCarregandoStatus] = useState(false);

  // Estados para o conhecimento de transporte (CTe)
  const [showCadastroConhecimento, setShowCadastroConhecimento] = useState(false);
  const [dadosConhecimento, setDadosConhecimento] = useState<DadosConhecimento | null>(null);
  const [temConhecimento, setTemConhecimento] = useState(false);
  const [verificandoConhecimento, setVerificandoConhecimento] = useState(false);
  const [statusConhecimento, setStatusConhecimento] = useState<'nenhum' | 'cadastrado' | 'pendente'>('nenhum');

  // Carregar status do pagamento ao abrir o modal
  useEffect(() => {
    const carregarStatusPagamento = async () => {
      if (!isOpen || !nfeId) return;

      setCarregandoStatus(true);
      try {
        // Buscar dados das parcelas para verificar se pagamento já foi configurado
        const response = await fetch(`/api/entrada-xml/parcelas-sugeridas-v2?nfeId=${nfeId}`);
        const data = await response.json();

        if (data.success && data.pagamentoConfigurado) {
          setPagamentoNFeConfigurado(true);
        }
      } catch (err) {
        console.error('Erro ao carregar status do pagamento:', err);
      } finally {
        setCarregandoStatus(false);
      }
    };

    carregarStatusPagamento();
  }, [isOpen, nfeId]);

  // Verificar automaticamente se existe CTe para esta NFe
  useEffect(() => {
    const verificarConhecimento = async () => {
      if (!isOpen || !nfeId) {
        setStatusConhecimento('nenhum');
        setTemConhecimento(false);
        setDadosConhecimento(null);
        return;
      }

      setVerificandoConhecimento(true);
      try {
        // Buscar CTe pendente para esta NFe
        const response = await fetch(`/api/cte/pendentes?nfeId=${nfeId}`);
        const data = await response.json();

        if (data.success && data.found && data.data) {
          // Tem conhecimento pendente (importado pelo robô)
          setStatusConhecimento('pendente');
          setTemConhecimento(true);
          setDadosConhecimento({
            codtransp: data.data.codtransp,
            nrocon: data.data.nrocon,
            serie: data.data.serie,
            cfop: data.data.cfop,
            icms: data.data.icms,
            baseicms: data.data.baseicms,
            totalcon: data.data.totalcon,
            totaltransp: data.data.totaltransp || data.data.totalcon,
            dtcon: data.data.dtcon,
            cif: data.data.cif,
            tipocalc: '1',
            tipocon: data.data.tipocon as '08' | '09' | '10',
            kg: data.data.kg,
            kgcub: data.data.kgcub,
            chave: data.data.chave,
            protocolo: data.data.protocolo,
          });
        } else {
          setStatusConhecimento('nenhum');
        }
      } catch (error) {
        console.error('Erro ao verificar conhecimento:', error);
        setStatusConhecimento('nenhum');
      } finally {
        setVerificandoConhecimento(false);
      }
    };

    verificarConhecimento();
  }, [isOpen, nfeId]);

  // Handler após sucesso na configuração de pagamento DA NFe
  const handleSuccessConfigPagamentoNFe = () => {
    setPagamentoNFeConfigurado(true);
    setShowConfigPagamentoNFe(false);

    setMessageData({
      title: 'Configuração Concluída!',
      message: 'Pagamento da NFe configurado com sucesso. A NFe está pronta para processamento.',
      type: 'success'
    });
    setShowMessage(true);
  };

  const handleGerarEntrada = async () => {
    // Dados complementares agora são obrigatórios, sem confirmações
    // Confirmação final
    setShowConfirmation(true);
  };

  const handleConfirmarPendencias = async () => {
    setConfirmacoesPendentes([]);
    setShowConfirmation(true);
  };

  const handleConfirmarOperacao = async () => {
    setShowConfirmation(false);
    await gerarEntradaApi();
  };

  const gerarEntradaApi = async () => {
    try {
      const response = await fetch('/api/entrada-xml/gerar-entrada', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nfeId,
          dadosCompletos: {
            associatedItems,
            dadosComplementares
          },
          dados: {
            temConhecimento: temConhecimento,
            numeroConhecimento: dadosConhecimento?.nrocon || '',
            codtransp: dadosConhecimento?.codtransp,
            fretecif: dadosConhecimento?.cif,
            totaltransp: dadosConhecimento?.totaltransp,
            totcon: dadosConhecimento?.totalcon,
            dtcon: dadosConhecimento?.dtcon,
          },
          conhecimento: temConhecimento ? dadosConhecimento : null
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessageData({
          title: 'NFe Processada com Sucesso!',
          message: `${data.message || 'NFe processada com sucesso.'}\n\nPara gerar a entrada de estoque, acesse a tela de Entradas de Mercadorias e clique em "Gerar Entrada".`,
          type: 'success'
        });
        setShowMessage(true);

        // Aguardar um pouco antes de fechar
        setTimeout(() => {
          onConfirm(0, '', nfeId);
          onClose();
        }, 3000);
      } else {
        setMessageData({
          title: 'Erro ao Processar XML',
          message: data.error || 'Ocorreu um erro desconhecido',
          type: 'error'
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao chamar API:', error);
      setMessageData({
        title: 'Erro de Comunicação',
        message: 'Não foi possível conectar com o servidor. Tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Processar XML da NFe
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Resumo das Associações */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Associações Confirmadas
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total de itens associados:</span>
                <span className="font-medium">{associatedItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total de pedidos vinculados:</span>
                <span className="font-medium">
                  {associatedItems.reduce((total, item) => total + item.associacoes.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Quantidade total associada:</span>
                <span className="font-medium">
                  {associatedItems.reduce((total, item) => 
                    total + item.associacoes.reduce((sum, a) => sum + a.quantidade, 0), 0
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 💰 Configuração de Pagamento DA NFe (Novo Fluxo) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Configuração de Pagamento da NFe</span>
            </h3>

            <div className={`border rounded-lg p-4 ${
              pagamentoNFeConfigurado
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Pagamento da NFe
                    </span>
                    {pagamentoNFeConfigurado && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {pagamentoNFeConfigurado ? (
                      <p className="text-green-700 dark:text-green-300">
                        ✓ Pagamento configurado com sucesso. Você pode prosseguir para gerar a entrada.
                      </p>
                    ) : (
                      <p>
                        Configure o pagamento da NFe (soma dos antecipados + parcelas do XML)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pagamentoNFeConfigurado ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configurado
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setShowConfigPagamentoNFe(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <DollarSign size={14} className="mr-1" />
                      Configurar Pagamento
                    </Button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Dados Complementares */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Dados Complementares</span>
            </h3>

            {/* Selo */}
            <div className="space-y-2">
              <Label htmlFor="numeroSelo">Número do selo</Label>
              <Input
                id="numeroSelo"
                placeholder="Digite o número do selo"
                value={dadosComplementares.numeroSelo}
                onChange={(e) =>
                  setDadosComplementares(prev => ({ ...prev, numeroSelo: e.target.value }))
                }
              />
            </div>

            {/* Seção de Conhecimento de Transporte (CTe) - Verificação Automática */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Conhecimento de Transporte (CTe)
              </h4>

              {verificandoConhecimento ? (
                <div className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Verificando conhecimento...</span>
                  </div>
                </div>
              ) : statusConhecimento === 'pendente' && dadosConhecimento ? (
                <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Conhecimento encontrado automaticamente</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>CTe:</strong> {dadosConhecimento.nrocon} / {dadosConhecimento.serie}</p>
                    <p><strong>Tipo:</strong> {dadosConhecimento.cif === 'S' ? 'CIF (frete fornecedor)' : 'FOB (frete comprador)'}</p>
                    <p><strong>Valor:</strong> R$ {dadosConhecimento.totalcon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <button
                    onClick={() => setShowCadastroConhecimento(true)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Editar conhecimento
                  </button>
                </div>
              ) : temConhecimento && dadosConhecimento ? (
                <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Conhecimento configurado</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>CTe:</strong> {dadosConhecimento.nrocon} / {dadosConhecimento.serie}</p>
                    <p><strong>Tipo:</strong> {dadosConhecimento.cif === 'S' ? 'CIF (frete fornecedor)' : 'FOB (frete comprador)'}</p>
                    <p><strong>Valor:</strong> R$ {dadosConhecimento.totalcon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <button
                    onClick={() => setShowCadastroConhecimento(true)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Editar conhecimento
                  </button>
                </div>
              ) : (
                <div className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm font-medium">Nenhum conhecimento encontrado</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                    Se esta entrada possui CTe, cadastre manualmente ou faça upload do XML.
                  </p>
                  <button
                    onClick={() => setShowCadastroConhecimento(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2"
                  >
                    <Truck size={16} />
                    Cadastrar Conhecimento
                  </button>
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <textarea
                className="w-full p-3 border rounded-md resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={3}
                placeholder="Digite observações sobre esta entrada..."
                value={dadosComplementares.observacoes}
                onChange={(e) =>
                  setDadosComplementares(prev => ({ ...prev, observacoes: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Modal de Confirmações Pendentes */}
          {confirmacoesPendentes.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 mb-2">Confirmações Pendentes</h4>
                  <ul className="space-y-1 text-sm text-yellow-700">
                    {confirmacoesPendentes.map((confirmacao, index) => (
                      <li key={index}>• {confirmacao}</li>
                    ))}
                  </ul>
                  <div className="flex space-x-3 mt-4">
                    <Button
                      size="sm"
                      onClick={handleConfirmarPendencias}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Sim, Continuar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmacoesPendentes([])}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            <X size={16} className="mr-2" />
            Cancelar
          </Button>

          <div className="flex items-center gap-3">
            {!pagamentoNFeConfigurado && (
              <span className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle size={14} />
                Configure o pagamento da NFe para continuar
              </span>
            )}
            <Button
              onClick={handleGerarEntrada}
              disabled={loading || !pagamentoNFeConfigurado}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} className="mr-2" />
              {loading ? 'Processando...' : 'Processar XML'}
            </Button>
          </div>
        </div>
      </div>

      {/* Modais de confirmação e mensagens */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmarOperacao}
        title="Confirmar Processamento"
        message="CONFIRMAR ESTA OPERAÇÃO? O XML será processado no sistema."
        type="warning"
        confirmText="Sim, Processar"
        cancelText="Cancelar"
        loading={loading}
      />

      <MessageModal
        isOpen={showMessage}
        onClose={() => setShowMessage(false)}
        title={messageData.title}
        message={messageData.message}
        type={messageData.type}
      />
    </div>

    {/* Modal de Configuração de Pagamento da NFe */}
    <ConfiguracaoPagamentoNFeModal
      isOpen={showConfigPagamentoNFe}
      onClose={() => setShowConfigPagamentoNFe(false)}
      nfeId={nfeId}
      onSuccess={handleSuccessConfigPagamentoNFe}
    />

    {/* Modal de Cadastro de Conhecimento (CTe) */}
    <CadastroConhecimentoModal
      isOpen={showCadastroConhecimento}
      onClose={() => setShowCadastroConhecimento(false)}
      onSalvar={(dados) => {
        setDadosConhecimento(dados);
        setShowCadastroConhecimento(false);
      }}
      valorTotalNfe={0} // Não temos o valor aqui, mas o modal aceita undefined
    />
    </>
  );
};