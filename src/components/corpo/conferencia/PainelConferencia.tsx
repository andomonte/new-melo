import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Conferente,
  PedidoParaConferencia,
  getPedidosEmConferencia,
  finalizarConferencia,
  iniciarConferencia,
  getConferenciasFinalizadas,
  ConferenciaFinalizada,
} from '@/data/conferencia/conferenciaService';
import { useConferenciaBusinessRules } from '@/hooks/useConferenciaBusinessRules';
import { Html5Qrcode } from 'html5-qrcode';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut,
  RefreshCw,
  Plus,
  QrCode,
  Type,
  Key,
  User,
  Clock,
} from 'lucide-react';
import ModalAlterarCodigo from '@/components/common/ModalAlterarCodigo';
import ConferenciasFinalizadasList from './ConferenciasFinalizadasList';

interface PainelConferenciaProps {
  conferente: Conferente;
  onLogout: () => void;
}

const PainelConferencia: React.FC<PainelConferenciaProps> = ({
  conferente,
  onLogout,
}) => {
  // Estados do componente
  const [pedidos, setPedidos] = useState<PedidoParaConferencia[]>([]);
  const [conferenciasFinalizadas, setConferenciasFinalizadas] = useState<
    ConferenciaFinalizada[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFinalizadas, setIsLoadingFinalizadas] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Estado para carregamento inicial
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlterarCodigoOpen, setIsAlterarCodigoOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'manual' | 'qr'>('manual');
  const [codigoInput, setCodigoInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [conferenciasAtivas, setConferenciasAtivas] = useState(0);

  // Refs e hooks
  const qrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  // Hook personalizado para regras de negócio de conferência
  const {
    conferenciasAtivas: ativasCount,
    checkConferenciasAtivas,
    tratarErroFinalizarConferencia,
  } = useConferenciaBusinessRules(conferente.matricula);

  const loadPedidos = useCallback(async () => {
    setIsLoading(true);
    try {
      const pedidosData = await getPedidosEmConferencia(conferente.nome);
      setPedidos(pedidosData);

      // Atualizar contador de conferências ativas
      setConferenciasAtivas(pedidosData.length);

      // Verificar também conferências ativas para atualizar contador
      await checkConferenciasAtivas();
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [conferente.nome, toast, checkConferenciasAtivas]);

  /**
   * Carrega conferências finalizadas do conferente
   */
  const loadConferenciasFinalizadas = useCallback(async () => {
    setIsLoadingFinalizadas(true);
    try {
      const conferenciasData = await getConferenciasFinalizadas(
        conferente.matricula,
        10,
      );
      setConferenciasFinalizadas(conferenciasData);
    } catch (error) {
      console.error('Erro ao carregar conferências finalizadas:', error);
      // Não mostrar toast de erro para não ser intrusivo, apenas logar
      setConferenciasFinalizadas([]);
    } finally {
      setIsLoadingFinalizadas(false);
    }
  }, [conferente.matricula]);

  /**
   * SOLUÇÃO PROBLEMA 5: Verificar conferências ativas ao carregar o componente
   * Se o usuário já tiver uma conferência ativa, carrega os dados da "Conferência Atual"
   */
  useEffect(() => {
    const initializeComponent = async () => {
      setIsInitializing(true);
      try {
        // Carregar pedidos em conferência do usuário, conferências finalizadas e verificar conferências ativas em paralelo
        await Promise.all([
          loadPedidos(),
          loadConferenciasFinalizadas(),
          checkConferenciasAtivas(),
        ]);
      } catch (error) {
        console.error('Erro ao inicializar Painel de Conferência:', error);
        // Em caso de erro, mostrar toast informativo
        toast({
          title: 'Aviso',
          description:
            'Não foi possível carregar todos os dados. Alguns recursos podem estar limitados.',
          variant: 'default',
        });
      } finally {
        setIsInitializing(false);
      }
    };

    // Executar inicialização ao montar o componente
    initializeComponent();
  }, [
    loadPedidos,
    loadConferenciasFinalizadas,
    checkConferenciasAtivas,
    toast,
  ]);

  /**
   * Finaliza a conferência de um pedido específico
   */
  const handleFinalizarConferencia = useCallback(
    async (codVenda: string) => {
      // Validação de entrada
      if (!codVenda || typeof codVenda !== 'string') {
        toast({
          title: 'Erro de validação',
          description: 'Código da venda inválido.',
          variant: 'destructive',
        });
        return;
      }

      try {
        // Chamar API para finalizar conferência com informações do conferente
        await finalizarConferencia({
          codVenda,
          matricula: conferente.matricula,
          nome: conferente.nome,
        });

        // Feedback de sucesso
        toast({
          title: 'Conferência finalizada',
          description: `Pedido ${codVenda} foi finalizado com sucesso.`,
          variant: 'default',
        });

        // Recarregar a lista de pedidos para refletir as mudanças
        await loadPedidos();

        // Recarregar conferências finalizadas para mostrar a recém-finalizada
        await loadConferenciasFinalizadas();
      } catch (error: any) {
        console.error('Erro ao finalizar conferência:', error);

        // Usar o hook para tratar erros de forma padronizada
        tratarErroFinalizarConferencia(error);
      }
    },
    [
      conferente,
      loadPedidos,
      loadConferenciasFinalizadas,
      tratarErroFinalizarConferencia,
      toast,
    ],
  );

  /**
   * Abre o modal para adicionar nova conferência
   */
  const handleOpenModal = useCallback(async () => {
    // Verificar se já tem conferência ativa antes de abrir o modal
    if (ativasCount > 0) {
      toast({
        title: 'Conferência já ativa',
        description:
          'Você já possui uma conferência ativa. Finalize-a antes de iniciar uma nova.',
        variant: 'destructive',
      });
      return;
    }

    setIsModalOpen(true);
    setModalMode('manual'); // Por padrão, começar com modo manual (código)
    setCodigoInput('');
  }, [ativasCount, toast]);

  // Função para parar o scanner de QR Code
  const stopQrCodeScanner = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      try {
        await qrCodeScannerRef.current.stop();
        qrCodeScannerRef.current.clear();
        qrCodeScannerRef.current = null;
      } catch (error) {
        console.error('Erro ao parar scanner:', error);
      }
    }
    setIsScanning(false);
  }, []);

  // Função para fechar o modal
  const handleCloseModal = useCallback(() => {
    stopQrCodeScanner();
    setIsModalOpen(false);
    setCodigoInput('');
    setModalMode('manual');
  }, [stopQrCodeScanner]);

  // Função para iniciar conferência
  const handleIniciarConferencia = useCallback(
    async (codigo: string) => {
      try {
        // Chamar API para iniciar conferência
        await iniciarConferencia({
          codVenda: codigo,
          matriculaConferente: conferente.matricula,
          nomeConferente: conferente.nome,
        });

        toast({
          title: 'Conferência iniciada',
          description: `Conferência do pedido ${codigo} iniciada com sucesso.`,
          variant: 'default',
        });

        handleCloseModal();
        await loadPedidos();
      } catch (error: any) {
        console.error('Erro ao iniciar conferência:', error);

        let errorMessage = 'Erro inesperado. Tente novamente.';
        if (error?.response?.data?.error) {
          errorMessage = error.response.data.error;
        }

        toast({
          title: 'Erro ao iniciar conferência',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [conferente, toast, handleCloseModal, loadPedidos],
  );

  // Função para iniciar scanner de QR Code
  const startQrCodeScanner = useCallback(
    async (elementId: string) => {
      try {
        if (qrCodeScannerRef.current) {
          await stopQrCodeScanner();
        }

        const qrCodeScanner = new Html5Qrcode(elementId);
        qrCodeScannerRef.current = qrCodeScanner;

        const qrCodeSuccessCallback = async (
          decodedText: string,
          _decodedResult: any,
        ) => {
          // Parar o scanner antes de processar
          await stopQrCodeScanner();

          // Iniciar conferência
          await handleIniciarConferencia(decodedText);
        };

        const qrCodeErrorCallback = (errorMessage: string) => {
          // Log de erro apenas se não for erro comum de não encontrar QR
          if (
            !errorMessage.includes('No QR code found') &&
            !errorMessage.includes('QR code parse error')
          ) {
            console.error('Erro do scanner QR:', errorMessage);
          }
        };

        // Configurar o scanner com configurações otimizadas
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qrCodeScanner.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback,
        );

        setIsScanning(true);
      } catch (error) {
        console.error('Erro ao iniciar scanner:', error);
        toast({
          title: 'Erro no scanner',
          description:
            'Não foi possível iniciar o scanner de QR Code. Verifique as permissões da câmera.',
          variant: 'destructive',
        });
        setModalMode('manual'); // Voltar para modo manual em caso de erro
      }
    },
    [stopQrCodeScanner, toast, handleIniciarConferencia],
  );

  // Efeito para iniciar/parar scanner quando mode muda
  useEffect(() => {
    if (isModalOpen && modalMode === 'qr') {
      // Aguardar um pouco para o DOM estar pronto
      setTimeout(() => {
        startQrCodeScanner('qr-code-scanner');
      }, 100);
    } else if (modalMode === 'manual') {
      stopQrCodeScanner();
    }

    return () => {
      if (modalMode === 'qr') {
        stopQrCodeScanner();
      }
    };
  }, [isModalOpen, modalMode, startQrCodeScanner, stopQrCodeScanner]);

  // Função para lidar com submit do formulário manual
  const handleSubmitCodigo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (codigoInput.trim()) {
        await handleIniciarConferencia(codigoInput.trim());
      }
    },
    [codigoInput, handleIniciarConferencia],
  );

  // Função para abrir modal de alterar código
  const handleOpenAlterarCodigo = useCallback(() => {
    setIsAlterarCodigoOpen(true);
  }, []);

  // Função para fechar modal de alterar código
  const handleCloseAlterarCodigo = useCallback(() => {
    setIsAlterarCodigoOpen(false);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadPedidos();
    loadConferenciasFinalizadas();
  }, [loadPedidos, loadConferenciasFinalizadas]);

  // Cleanup do scanner ao desmontar componente
  useEffect(() => {
    return () => {
      stopQrCodeScanner();
    };
  }, [stopQrCodeScanner]);

  return (
    <div className="w-full flex flex-col bg-gray-50 dark:bg-zinc-900 min-h-screen overflow-hidden">
      {/* Loading state inicial */}
      {isInitializing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Carregando conferências...
            </span>
          </div>
        </div>
      )}

      {/* Header Compacto e Responsivo */}
      <div className="bg-white dark:bg-zinc-800 shadow-sm border-b border-gray-200 dark:border-zinc-700 px-2 sm:px-4 py-2 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
          {/* Informações do Usuário */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              Painel de Conferência
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="truncate">
                <span className="font-medium">{conferente.nome}</span>
                <span className="hidden sm:inline">
                  {' '}
                  | Mat: {conferente.matricula}
                </span>
                <span className="sm:hidden block text-xs">
                  Mat: {conferente.matricula}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    conferenciasAtivas > 0
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {conferenciasAtivas === 0
                    ? 'Nenhuma ativa'
                    : conferenciasAtivas === 1
                    ? '1 ativa'
                    : `${conferenciasAtivas} ativas`}
                </span>
                {conferenciasAtivas >= 1 && (
                  <span className="text-orange-600 dark:text-orange-400 text-xs font-medium hidden sm:inline">
                    (Limite: 1 por vez)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação - Layout Responsivo */}
          <div className="flex flex-wrap gap-1 sm:gap-2 lg:gap-3 justify-end">
            <DefaultButton
              text={conferenciasAtivas >= 1 ? 'Finalizar' : 'Adicionar'}
              size="sm"
              variant={conferenciasAtivas >= 1 ? 'secondary' : 'primary'}
              onClick={handleOpenModal}
              icon={<Plus className="w-3 h-3 sm:w-4 sm:h-4" />}
              disabled={conferenciasAtivas >= 1}
              title={
                conferenciasAtivas >= 1
                  ? 'Você já possui uma conferência ativa. Finalize-a primeiro.'
                  : 'Adicionar nova conferência'
              }
            />

            {/* Botão Alterar Código - Apenas ícone em mobile */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="secondary"
                onClick={handleOpenAlterarCodigo}
                icon={<Key className="w-4 h-4" />}
                title="Alterar Código"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Alterar Código"
                size="sm"
                variant="secondary"
                onClick={handleOpenAlterarCodigo}
                icon={<Key className="w-4 h-4" />}
                title="Alterar Código"
              />
            </div>

            {/* Botão Atualizar - Apenas ícone em mobile */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="secondary"
                onClick={loadPedidos}
                icon={<RefreshCw className="w-4 h-4" />}
                disabled={isLoading}
                title="Atualizar dados"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Atualizar"
                size="sm"
                variant="secondary"
                onClick={loadPedidos}
                icon={<RefreshCw className="w-4 h-4" />}
                disabled={isLoading}
                title="Atualizar dados"
              />
            </div>

            {/* Botão Sair - Apenas ícone em mobile */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="destructive"
                onClick={onLogout}
                icon={<LogOut className="w-4 h-4" />}
                title="Fazer logout"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Sair"
                size="sm"
                variant="destructive"
                onClick={onLogout}
                icon={<LogOut className="w-4 h-4" />}
                title="Fazer logout"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal - Layout Adaptável */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2">
          <div className="max-w-7xl mx-auto space-y-2 min-h-full">
            {/* Conferência Ativa - Layout Otimizado e Compacto */}
            <div className="space-y-1 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Conferência Atual
                </h2>
                {!isLoading && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {conferenciasAtivas === 0
                      ? 'Nenhuma conferência ativa'
                      : `${conferenciasAtivas} conferência${
                          conferenciasAtivas > 1 ? 's' : ''
                        } ativa${conferenciasAtivas > 1 ? 's' : ''}`}
                  </div>
                )}
              </div>

              {/* Card de Conferência Ativa - Layout Compacto */}
              {isLoading ? (
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-3">
                  <div className="animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      </div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                    </div>
                    <div className="mb-4">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-10 bg-gray-200 dark:bg-gray-700 rounded"
                        ></div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
                    </div>
                  </div>
                </div>
              ) : pedidos.length === 0 ? (
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4 text-center">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Plus className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Nenhuma conferência ativa
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-3 text-xs max-w-md mx-auto">
                    Você não possui conferências em andamento no momento.
                    Escaneie um código QR ou digite o código de uma venda para
                    iniciar.
                  </p>
                  <DefaultButton
                    text="Iniciar Nova Conferência"
                    size="sm"
                    variant="primary"
                    onClick={handleOpenModal}
                    icon={<Plus className="w-4 h-4" />}
                    disabled={conferenciasAtivas >= 1}
                  />
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-3">
                  {pedidos.map((pedido) => (
                    <div key={pedido.codvenda} className="space-y-3">
                      {/* Header do Card Compacto */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                            Venda em Conferência
                          </span>
                          <div className="flex items-center gap-3 mt-1">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                              #{pedido.codvenda}
                            </h3>
                            <div className="px-3 py-1 text-xs font-semibold rounded-full border bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                              Em Conferência
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Informações do Cliente - Compacto */}
                      <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                          Cliente
                        </span>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                          {pedido.nomeCliente}
                        </p>
                      </div>

                      {/* Grid de Informações Detalhadas - Compacto */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Separador
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.separador}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Fim Separação
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.fimSeparacao}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Início Conferência
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.inicioConferencia}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Conferente
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.nomeConferente}
                          </p>
                        </div>
                      </div>

                      {/* Ações - Compactas */}
                      <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
                        <DefaultButton
                          text="Finalizar Conferência"
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            handleFinalizarConferencia(pedido.codvenda)
                          }
                          className="w-full sm:w-auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conferências Finalizadas */}
            <ConferenciasFinalizadasList
              conferenciasFinalizadas={conferenciasFinalizadas}
              isLoading={isLoadingFinalizadas}
            />
          </div>
        </div>
      </div>

      {/* Modal para adicionar conferência */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Adicionar Conferência
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Opções do Modal */}
              <div className="space-y-4">
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => setModalMode('manual')}
                    className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                      modalMode === 'manual'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <Type className="w-5 h-5 mr-3" />
                    <span className="font-medium">Digitar Código</span>
                  </button>

                  <button
                    onClick={() => setModalMode('qr')}
                    className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                      modalMode === 'qr'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <QrCode className="w-5 h-5 mr-3" />
                    <span className="font-medium">Ler QR Code</span>
                  </button>
                </div>

                {/* Conteúdo baseado no modo selecionado */}
                <div className="mt-6">
                  {modalMode === 'manual' ? (
                    <form onSubmit={handleSubmitCodigo}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Digite o código:
                      </label>
                      <input
                        type="text"
                        value={codigoInput}
                        onChange={(e) => setCodigoInput(e.target.value)}
                        placeholder="Insira o código aqui..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <div className="text-center">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-4">
                        <div
                          id="qr-code-scanner"
                          className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
                        >
                          {!isScanning && (
                            <div className="text-center text-gray-500 dark:text-gray-400">
                              <QrCode className="h-8 w-8 mx-auto mb-2" />
                              <p>Iniciando scanner...</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Posicione o QR Code dentro da área de leitura
                      </p>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end space-x-3 mt-6">
                  <DefaultButton
                    text="Cancelar"
                    size="sm"
                    variant="secondary"
                    onClick={handleCloseModal}
                  />
                  {modalMode === 'manual' && (
                    <DefaultButton
                      text="Adicionar"
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        handleIniciarConferencia(codigoInput.trim())
                      }
                      disabled={!codigoInput.trim()}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para alterar código */}
      <ModalAlterarCodigo
        isOpen={isAlterarCodigoOpen}
        onClose={handleCloseAlterarCodigo}
        matricula={conferente.matricula}
        nome={conferente.nome}
      />
    </div>
  );
};

export default PainelConferencia;
