import { useState, useCallback } from 'react';
import {
  verificarConferenciasAtivas,
  VerificarConferenciasAtivasResponse,
} from '@/data/conferencia/conferenciaService';
import { useToast } from '@/hooks/use-toast';

interface UseConferenciaBusinessRulesReturn {
  conferenciasAtivas: number;
  isCheckingConferencias: boolean;
  checkConferenciasAtivas: () => Promise<void>;
  verificarPodeIniciarConferencia: () => Promise<boolean>;
  validarCodigoConferencia: (
    codigo: string,
  ) => Promise<{ valido: boolean; erro?: string }>;
  tratarErroIniciarConferencia: (error: any) => void;
  tratarErroFinalizarConferencia: (error: any) => void;
}

/**
 * Hook para gerenciar regras de negócio de conferência
 *
 * Funcionalidades:
 * - Verificar quantidade de conferências ativas
 * - Enforçar regra de uma conferência por conferente
 * - Gerenciar estado de loading das verificações
 *
 * @param matricula - Matrícula do conferente
 * @returns Objeto com estado e funções das conferências ativas
 */
export function useConferenciaBusinessRules(
  matricula: string,
): UseConferenciaBusinessRulesReturn {
  const [conferenciasAtivas, setConferenciasAtivas] = useState(0);
  const [isCheckingConferencias, setIsCheckingConferencias] = useState(false);
  const { toast } = useToast();

  /**
   * Verifica quantidade de conferências ativas do conferente
   *
   * Faz chamada para API e atualiza estado local
   * Usado para enforçar regra de negócio (máximo 1 conferência por conferente)
   */
  const checkConferenciasAtivas = useCallback(async () => {
    if (!matricula) return;

    setIsCheckingConferencias(true);
    try {
      const response = await verificarConferenciasAtivas(matricula);
      setConferenciasAtivas(response.quantidadeAtivas);
    } catch (error) {
      console.error('Erro ao verificar conferências ativas:', error);
      // Em caso de erro, assume 0 conferências ativas
      setConferenciasAtivas(0);
    } finally {
      setIsCheckingConferencias(false);
    }
  }, [matricula]);

  /**
   * Verifica se o conferente pode iniciar uma nova conferência
   */
  const verificarPodeIniciarConferencia =
    useCallback(async (): Promise<boolean> => {
      try {
        const response: VerificarConferenciasAtivasResponse =
          await verificarConferenciasAtivas(matricula);

        if (response.temConferenciaAtiva) {
          const conferenciaAtiva = response.conferenciasAtivas[0];

          toast({
            title: 'Conferência já ativa',
            description: `Você já possui uma conferência ativa (Pedido: ${conferenciaAtiva.codvenda} - ${conferenciaAtiva.nomeCliente}). Finalize-a antes de iniciar uma nova.`,
            variant: 'destructive',
          });

          return false;
        }

        return true;
      } catch (error: any) {
        console.error('Erro ao verificar conferências ativas:', error);

        // Em caso de erro na verificação, permitir prosseguir mas logar o erro
        toast({
          title: 'Aviso',
          description:
            'Não foi possível verificar conferências ativas. Prosseguindo...',
          variant: 'default',
        });

        return true;
      }
    }, [matricula, toast]);

  /**
   * Valida um código de conferência antes de iniciar
   */
  const validarCodigoConferencia = useCallback(
    async (codigo: string): Promise<{ valido: boolean; erro?: string }> => {
      // Validações básicas
      if (!codigo || codigo.trim().length === 0) {
        return {
          valido: false,
          erro: 'Código não pode estar vazio.',
        };
      }

      const codigoLimpo = codigo.trim();

      // Validar formato básico (pode ser customizado conforme necessário)
      if (codigoLimpo.length < 3) {
        return {
          valido: false,
          erro: 'Código deve ter pelo menos 3 caracteres.',
        };
      }

      // Validar caracteres permitidos (alfanuméricos)
      const formatoValido = /^[a-zA-Z0-9]+$/.test(codigoLimpo);
      if (!formatoValido) {
        return {
          valido: false,
          erro: 'Código deve conter apenas letras e números.',
        };
      }

      return {
        valido: true,
      };
    },
    [],
  );

  /**
   * Trata erros específicos ao iniciar conferência
   */
  const tratarErroIniciarConferencia = useCallback(
    (error: any) => {
      console.error('Erro ao iniciar conferência:', error);

      let errorTitle = 'Erro ao iniciar conferência';
      let errorMessage = 'Erro inesperado. Tente novamente.';

      if (error?.response?.status === 404) {
        errorTitle = 'Pedido não encontrado';
        errorMessage =
          'O pedido especificado não foi encontrado ou não está disponível para conferência.';
      } else if (error?.response?.status === 409) {
        // Tratar erros específicos de conflito (409)
        const errorCode = error.response?.data?.code;

        if (errorCode === 'INVALID_STATUS_FOR_CONFERENCE') {
          errorTitle = '❌ Venda não pode ser conferida';
          const details = error.response.data;
          if (details?.statusDescricao && details?.acao) {
            errorMessage = `${details.acao}. Status atual: ${details.statusDescricao}`;
          } else {
            errorMessage =
              'Esta venda não está pronta para conferência. Verifique se já foi separada.';
          }
        } else if (errorCode === 'ALREADY_ASSIGNED_TO_OTHER_CONFERENTE') {
          errorTitle = '👤 Venda já atribuída';
          const details = error.response.data;
          if (details?.conferente) {
            errorMessage = `Esta venda já está sendo conferida por outro conferente (${details.conferente}). Busque uma nova venda para conferir.`;
          } else {
            errorMessage =
              'Esta venda já está sendo conferida por outro operador.';
          }
        } else if (errorCode === 'CONFERENCIA_JA_ATIVA') {
          errorTitle = '⚠️ Você já tem uma conferência ativa';
          errorMessage =
            'Finalize a conferência atual antes de iniciar uma nova.';
        } else if (errorCode === 'VENDA_NAO_SEPARADA') {
          errorTitle = '📦 Venda ainda não foi separada';
          errorMessage =
            'Esta venda precisa passar pela separação antes de ser conferida. Aguarde a separação ou procure uma venda já separada.';
        } else if (errorCode === 'VENDA_JA_CONFERIDA') {
          errorTitle = '✅ Venda já foi conferida';
          errorMessage =
            'Esta venda já passou pelo processo de conferência e está finalizada.';
        } else {
          errorTitle = 'Conferência não permitida';
          errorMessage =
            error?.response?.data?.error ||
            'O pedido não pode ser conferido no momento. Verifique o status.';
        }
      } else if (error?.response?.status === 400) {
        const errorCode = error.response?.data?.code;

        if (errorCode === 'PEDIDO_NAO_ENCONTRADO') {
          errorTitle = 'Pedido não encontrado';
          errorMessage =
            'O código informado não corresponde a nenhum pedido. Verifique e tente novamente.';
        } else {
          errorTitle = 'Dados inválidos';
          errorMessage =
            error?.response?.data?.error ||
            'Os dados fornecidos são inválidos.';
        }
      } else if (error?.response?.status >= 500) {
        errorTitle = 'Erro no servidor';
        errorMessage =
          'Erro interno do servidor. Contate o suporte se o problema persistir.';
      } else if (error?.code === 'NETWORK_ERROR' || !error?.response) {
        errorTitle = 'Erro de conexão';
        errorMessage =
          'Verifique sua conexão com a internet e tente novamente.';
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 6000, // Mais tempo para ler mensagens detalhadas
      });
    },
    [toast],
  );

  const tratarErroFinalizarConferencia = useCallback(
    (error: any) => {
      console.error('Erro ao finalizar conferência:', error);

      let errorTitle = 'Erro ao finalizar conferência';
      let errorMessage =
        'Não foi possível finalizar a conferência. Tente novamente.';

      if (error?.response?.status === 404) {
        errorTitle = 'Pedido não encontrado';
        errorMessage = 'O pedido especificado não foi encontrado no sistema.';
      } else if (error?.response?.status === 409) {
        const errorCode = error.response?.data?.code;

        if (errorCode === 'CONFERENCIA_NAO_INICIADA') {
          errorTitle = '❌ Conferência não foi iniciada';
          errorMessage =
            'Não é possível finalizar uma conferência que não foi iniciada. Inicie a conferência primeiro.';
        } else if (errorCode === 'CONFERENCIA_JA_FINALIZADA') {
          errorTitle = '✅ Conferência já foi finalizada';
          errorMessage = 'Esta conferência já foi finalizada anteriormente.';
        } else if (errorCode === 'STATUS_INVALIDO_FINALIZACAO') {
          errorTitle = '⚠️ Status não permite finalização';
          const details = error.response.data.details;
          if (details?.statusDescricao) {
            errorMessage = `Status atual: ${details.statusDescricao}. Verifique se a conferência foi iniciada corretamente.`;
          } else {
            errorMessage = 'O pedido não pode ser finalizado no status atual.';
          }
        } else {
          errorTitle = 'Status inválido';
          errorMessage =
            error?.response?.data?.error ||
            'O pedido não pode ser finalizado no status atual.';
        }
      } else if (error?.response?.status === 400) {
        errorTitle = 'Dados inválidos';
        errorMessage =
          error?.response?.data?.error || 'Os dados fornecidos são inválidos.';
      } else if (error?.response?.status >= 500) {
        errorTitle = 'Erro no servidor';
        errorMessage =
          'Erro interno do servidor. Contate o suporte se o problema persistir.';
      } else if (error?.code === 'NETWORK_ERROR' || !error?.response) {
        errorTitle = 'Erro de conexão';
        errorMessage =
          'Verifique sua conexão com a internet e tente novamente.';
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: 6000,
      });
    },
    [toast],
  );

  return {
    conferenciasAtivas,
    isCheckingConferencias,
    checkConferenciasAtivas,
    verificarPodeIniciarConferencia,
    validarCodigoConferencia,
    tratarErroIniciarConferencia,
    tratarErroFinalizarConferencia,
  };
}
