import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Separador,
  PedidoParaSeparar,
  getPedidosEmSeparacao,
  finalizarSeparacao,
  iniciarSeparacao,
  getSeparacoesFinalizadas,
  SeparacaoFinalizada,
} from '@/data/separacao/separacaoService';
import { useSeparacaoBusinessRules } from '@/hooks/useSeparacaoBusinessRules';
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
  CheckCircle,
} from 'lucide-react';
import ModalAlterarCodigo from '@/components/common/ModalAlterarCodigo';
import SeparacoesFinalizadasList from './SeparacoesFinalizadasList';
import ClientOnly from '@/components/common/ClientOnly';

interface PainelSeparacaoProps {
  separador: Separador;
  onLogout: () => void;
}

const PainelSeparacao: React.FC<PainelSeparacaoProps> = ({
  separador,
  onLogout,
}) => {
  // Estados do componente
  const [pedidos, setPedidos] = useState<PedidoParaSeparar[]>([]);
  const [separacoesFinalizadas, setSeparacoesFinalizadas] = useState<
    SeparacaoFinalizada[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFinalizadas, setIsLoadingFinalizadas] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlterarCodigoOpen, setIsAlterarCodigoOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'qr' | 'manual'>('qr');
  const [codigoInput, setCodigoInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [separacoesAtivas, setSeparacoesAtivas] = useState(0);

  // Refs e hooks
  const qrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  const { dismiss, toast } = useToast();

  // Hook personalizado para regras de negócio de separação
  const {
    verificarPodeIniciarSeparacao,
    validarCodigoSeparacao,
    tratarErroIniciarSeparacao,
    tratarErroFinalizarSeparacao,
  } = useSeparacaoBusinessRules(separador.matricula);

  const loadPedidos = useCallback(async () => {
    setIsLoading(true);
    try {
      const pedidosData = await getPedidosEmSeparacao(separador.nome);
      setPedidos(pedidosData);

      // Atualizar contador de separações ativas
      setSeparacoesAtivas(pedidosData.length);
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
  }, [separador.nome, toast]);

  /**
   * Carrega separações finalizadas do separador
   */
  const loadSeparacoesFinalizadas = useCallback(async () => {
    setIsLoadingFinalizadas(true);
    try {
      // Debug log para verificar matrícula
      console.log(
        '[DEBUG] Carregando separações para matrícula:',
        separador.matricula,
      );

      const separacoesData = await getSeparacoesFinalizadas(
        separador.matricula,
        10,
      );

      // Debug log para verificar dados retornados
      console.log('[DEBUG] Separações retornadas:', {
        total: separacoesData?.length || 0,
        dados: separacoesData,
      });

      setSeparacoesFinalizadas(separacoesData);
    } catch (error) {
      console.error('Erro ao carregar separações finalizadas:', error);
      // Não mostrar toast de erro para não ser intrusivo, apenas logar
      setSeparacoesFinalizadas([]);
    } finally {
      setIsLoadingFinalizadas(false);
    }
  }, [separador.matricula]);

  /**
   * Finaliza a separação de um pedido específico
   *
   * Funcionalidades:
   * - Validação de entrada
   * - Feedback visual durante o processo
   * - Tratamento de erros específicos
   * - Atualização automática da lista
   * - Log de auditoria
   *
   * @param codVenda - Código da venda a ser finalizada
   */
  const handleFinalizarSeparacao = useCallback(
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

      // Feedback visual de início do processo
      toast({
        title: 'Finalizando separação...',
        description: `Processando pedido ${codVenda}`,
        variant: 'default',
      });

      try {
        // Chamar API para finalizar separação com informações do separador
        await finalizarSeparacao(codVenda, {
          matricula: separador.matricula,
          nome: separador.nome,
        });

        // Feedback de sucesso
        toast({
          title: 'Separação finalizada',
          description: `Pedido ${codVenda} foi finalizado com sucesso.`,
          variant: 'default',
        });

        // Recarregar a lista de pedidos para refletir as mudanças
        await loadPedidos();

        // Recarregar separações finalizadas para mostrar a recém-finalizada
        await loadSeparacoesFinalizadas();
      } catch (error: any) {
        console.error('Erro ao finalizar separação:', error);

        // Usar o hook para tratar erros de forma padronizada
        tratarErroFinalizarSeparacao(error);
      }
    },
    [
      separador,
      loadPedidos,
      loadSeparacoesFinalizadas,
      tratarErroFinalizarSeparacao,
      toast,
    ],
  );

  /**
   * Abre o modal para adicionar nova separação
   *
   * Verifica primeiro se o separador pode iniciar uma nova separação
   * conforme a regra de negócio (uma separação ativa por vez)
   */
  const handleOpenModal = useCallback(async () => {
    // Verificar se pode iniciar uma nova separação antes de abrir o modal
    const podeIniciar = await verificarPodeIniciarSeparacao();

    if (!podeIniciar) {
      return; // Não abre o modal se já tem separação ativa
    }

    setIsModalOpen(true);
    setModalMode('manual'); // Começar com modo manual (digitação), igual ao modal de conferência
    setCodigoInput('');
  }, [verificarPodeIniciarSeparacao]);

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

  const handleCloseModal = useCallback(() => {
    stopQrCodeScanner();
    setIsModalOpen(false);
    setCodigoInput('');
  }, [stopQrCodeScanner]);

  const handleAdicionarSeparacao = useCallback(
    async (codigo: string) => {
      try {
        // REGRA DE NEGÓCIO: Verificar se pode iniciar uma nova separação
        const podeIniciar = await verificarPodeIniciarSeparacao();

        if (!podeIniciar) {
          return; // Não continua se já tem separação ativa
        }

        // O código lido do QR Code é o ID da venda (codvenda)
        const codVenda = codigo.trim();

        // Validar se o código é válido usando o hook
        if (!validarCodigoSeparacao(codVenda)) {
          toast({
            title: 'Código inválido',
            description: 'O código QR não contém um ID de venda válido.',
            variant: 'destructive',
          });
          return;
        }

        // Iniciar a separação usando a API
        await iniciarSeparacao({
          codVenda: codVenda,
          matriculaSeparador: separador.matricula,
          nomeSeparador: separador.nome,
        });

        toast({
          title: 'Separação iniciada com sucesso',
          description: `Pedido ${codVenda} foi adicionado à sua lista de separação.`,
          variant: 'default',
        });

        handleCloseModal();
        // Recarregar pedidos para mostrar o novo pedido em separação
        await loadPedidos();
      } catch (error: any) {
        console.error('Erro ao iniciar separação:', error);

        // Usar o hook para tratar erros de forma padronizada
        tratarErroIniciarSeparacao(error);
      }
    },
    [
      toast,
      loadPedidos,
      handleCloseModal,
      separador.matricula,
      separador.nome,
      verificarPodeIniciarSeparacao,
      tratarErroIniciarSeparacao,
      validarCodigoSeparacao,
    ],
  );

  // Função para inicializar o scanner de QR Code
  const startQrCodeScanner = useCallback(async () => {
    try {
      setIsScanning(true);
      const qrCodeScanner = new Html5Qrcode('qr-reader');
      qrCodeScannerRef.current = qrCodeScanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await qrCodeScanner.start(
        { facingMode: 'environment' }, // Câmera traseira
        config,
        (decodedText, _decodedResult) => {
          handleAdicionarSeparacao(decodedText);
        },
        (_errorMessage) => {
          // Erro silencioso - não mostrar todos os erros de scan
        },
      );
    } catch (error) {
      console.error('Erro ao inicializar scanner:', error);
      toast({
        title: 'Erro no Scanner',
        description:
          'Não foi possível acessar a câmera. Verifique as permissões.',
        variant: 'destructive',
      });
      setIsScanning(false);
    }
  }, [toast, handleAdicionarSeparacao]);

  // useEffect para gerenciar o scanner quando o modal mode mudar
  useEffect(() => {
    if (isModalOpen && modalMode === 'qr') {
      // Pequeno delay para garantir que o elemento DOM existe
      const timeoutId = setTimeout(() => {
        startQrCodeScanner();
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        stopQrCodeScanner();
      };
    } else {
      stopQrCodeScanner();
    }
  }, [isModalOpen, modalMode, startQrCodeScanner, stopQrCodeScanner]);

  const handleManualInput = async () => {
    const codigoLimpo = codigoInput.trim();

    if (validarCodigoSeparacao(codigoLimpo)) {
      await handleAdicionarSeparacao(codigoLimpo);
    } else {
      toast({
        title: 'Código inválido',
        description: 'Por favor, digite um código válido.',
        variant: 'destructive',
      });
    }
  };

  // Carregar pedidos e separações finalizadas ao montar o componente
  useEffect(() => {
    loadPedidos();
    loadSeparacoesFinalizadas();
    dismiss(); // Dismiss any existing toasts when component mounts

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPedidos, loadSeparacoesFinalizadas]);

  return (
    <div className="w-full flex flex-col bg-gray-50 dark:bg-zinc-900 min-h-screen overflow-hidden">
      {/* Header Compacto e Responsivo */}
      <div className="bg-white dark:bg-zinc-800 shadow-sm border-b border-gray-200 dark:border-zinc-700 px-2 sm:px-4 py-2 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
          {/* Informações do Usuário */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              Painel de Separação
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="truncate">
                <span className="font-medium">{separador.nome}</span>
                <span className="hidden sm:inline">
                  {' '}
                  | Mat: {separador.matricula}
                </span>
                <span className="sm:hidden block text-xs">
                  Mat: {separador.matricula}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    separacoesAtivas > 0
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {separacoesAtivas === 0
                    ? 'Nenhuma ativa'
                    : separacoesAtivas === 1
                    ? '1 ativa'
                    : `${separacoesAtivas} ativas`}
                </span>
                {separacoesAtivas >= 1 && (
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
              text={separacoesAtivas >= 1 ? 'Finalizar' : 'Adicionar'}
              size="sm"
              variant={separacoesAtivas >= 1 ? 'secondary' : 'primary'}
              onClick={handleOpenModal}
              icon={<Plus className="w-3 h-3 sm:w-4 sm:h-4" />}
              disabled={separacoesAtivas >= 1}
              title={
                separacoesAtivas >= 1
                  ? 'Você já possui uma separação ativa. Finalize-a primeiro.'
                  : 'Adicionar nova separação'
              }
            />
            {/* Botão Alterar Código - Apenas ícone em mobile */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="secondary"
                onClick={() => setIsAlterarCodigoOpen(true)}
                icon={<Key className="w-4 h-4" />}
                title="Alterar Código"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Alterar Código"
                size="sm"
                variant="secondary"
                onClick={() => setIsAlterarCodigoOpen(true)}
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
            {/* Separação Ativa - Layout Otimizado e Compacto */}
            <div className="space-y-1 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Separação Atual
                </h2>
                {!isLoading && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {separacoesAtivas === 0
                      ? 'Nenhuma separação ativa'
                      : `${separacoesAtivas} separação${
                          separacoesAtivas > 1 ? 'ões' : ''
                        } ativa${separacoesAtivas > 1 ? 's' : ''}`}
                  </div>
                )}
              </div>

              {/* Card de Separação Ativa - Layout Compacto */}
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
                    Nenhuma separação ativa
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-3 text-xs max-w-md mx-auto">
                    Você não possui separações em andamento no momento. Escaneie
                    um código QR ou digite o código de uma venda para iniciar.
                  </p>
                  <DefaultButton
                    text="Iniciar Nova Separação"
                    size="sm"
                    variant="primary"
                    onClick={handleOpenModal}
                    icon={<Plus className="w-4 h-4" />}
                    disabled={separacoesAtivas >= 1}
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
                            Venda em Separação
                          </span>
                          <div className="flex items-center gap-3 mt-1">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                              #{pedido.codvenda}
                            </h3>
                            <div className="px-3 py-1 text-xs font-semibold rounded-full border bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                              Em Separação
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
                              Vendedor
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.vendedor}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Horário
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.horario}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Separador
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.nome}
                          </p>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Key className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              Matrícula
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {pedido.ra_mat}
                          </p>
                        </div>
                      </div>

                      {/* Ações - Compactas */}
                      <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
                        <DefaultButton
                          text="Finalizar Separação"
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            handleFinalizarSeparacao(pedido.codvenda)
                          }
                          className="w-full sm:w-auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Separações Finalizadas */}
            <ClientOnly
              fallback={
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        Separações Finalizadas Recentes
                      </h3>
                    </div>
                    <button
                      onClick={async () => {
                        await loadSeparacoesFinalizadas();
                        toast({
                          title: 'Atualizado',
                          description:
                            'Lista de separações finalizadas atualizada.',
                          variant: 'default',
                        });
                      }}
                      disabled={isLoadingFinalizadas}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                      title="Atualizar separações finalizadas"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${
                          isLoadingFinalizadas ? 'animate-spin' : ''
                        }`}
                      />
                      Atualizar
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg animate-pulse">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                        <div className="flex-1">
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24 mb-2"></div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            >
              <SeparacoesFinalizadasList
                separacoesFinalizadas={separacoesFinalizadas}
                isLoading={isLoadingFinalizadas}
              />
            </ClientOnly>
          </div>
        </div>
      </div>

      {/* Modal para Adicionar Separação */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Adicionar Nova Separação
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Botões para alternar modo - igual ao modal de conferência */}
            <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setModalMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  modalMode === 'manual'
                    ? 'bg-white dark:bg-zinc-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <Type className="w-4 h-4" />
                <span className="font-medium">Digitar Código</span>
              </button>
              <button
                onClick={() => setModalMode('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  modalMode === 'qr'
                    ? 'bg-white dark:bg-zinc-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="font-medium">Escanear QR</span>
              </button>
            </div>

            {/* Conteúdo baseado no modo selecionado */}
            <div className="space-y-4">
              {modalMode === 'manual' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código da Venda
                    </label>
                    <input
                      type="text"
                      value={codigoInput}
                      onChange={(e) => setCodigoInput(e.target.value)}
                      placeholder="Digite o código da venda"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && codigoInput.trim()) {
                          handleManualInput();
                        }
                      }}
                    />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        <strong>Separador:</strong> {separador.nome}
                      </p>
                      <p>
                        <strong>Matrícula:</strong> {separador.matricula}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <DefaultButton
                      text="Cancelar"
                      variant="secondary"
                      onClick={handleCloseModal}
                      size="sm"
                      className="flex-1"
                    />
                    <DefaultButton
                      text="Iniciar Separação"
                      variant="primary"
                      onClick={handleManualInput}
                      size="sm"
                      className="flex-1"
                      disabled={!codigoInput.trim()}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Aponte a câmera para o QR Code
                    </label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                      <div id="qr-reader" className="w-full"></div>
                      {!isScanning && (
                        <div className="flex flex-col items-center justify-center h-64">
                          <QrCode className="w-16 h-16 text-gray-400 mb-4" />
                          <p className="text-gray-600 dark:text-gray-400">
                            Inicializando scanner...
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                      Posicione o QR Code dentro da área de leitura
                    </p>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <DefaultButton
                      text="Cancelar"
                      variant="secondary"
                      onClick={handleCloseModal}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Alterar Código de Acesso */}
      <ModalAlterarCodigo
        isOpen={isAlterarCodigoOpen}
        onClose={() => setIsAlterarCodigoOpen(false)}
        matricula={separador.matricula}
        nome={separador.nome}
      />
    </div>
  );
};

export default PainelSeparacao;
