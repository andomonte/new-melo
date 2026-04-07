import { useCallback } from 'react';
import {
  verificarSeparacoesAtivas,
  VerificarSeparacoesAtivasResponse,
} from '@/data/separacao/separacaoService';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook personalizado para gerenciar regras de negócio de separação
 *
 * Implementa a regra principal: um separador só pode ter uma separação ativa por vez
 *
 * @param matriculaSeparador - Matrícula do separador logado
 * @returns Funções e dados para gerenciar separações
 */
export const useSeparacaoBusinessRules = (matriculaSeparador: string) => {
  const { toast } = useToast();

  /**
   * Verifica se o separador pode iniciar uma nova separação
   *
   * @returns Promise<boolean> - true se pode iniciar, false caso contrário
   */
  const verificarPodeIniciarSeparacao =
    useCallback(async (): Promise<boolean> => {
      try {
        const response: VerificarSeparacoesAtivasResponse =
          await verificarSeparacoesAtivas(matriculaSeparador);

        if (response.temSeparacaoAtiva) {
          const separacaoAtiva = response.separacoesAtivas[0];

          toast({
            title: 'Separação já ativa',
            description: `Você já possui uma separação ativa (Pedido: ${separacaoAtiva.codvenda} - ${separacaoAtiva.nomeCliente}). Finalize-a antes de iniciar uma nova.`,
            variant: 'destructive',
          });

          return false;
        }

        return true;
      } catch (error: any) {
        console.error('Erro ao verificar separações ativas:', error);

        // Em caso de erro na verificação, permitir prosseguir mas logar o erro
        // A validação será feita novamente na API
        toast({
          title: 'Aviso',
          description:
            'Não foi possível verificar separações ativas. Tentando prosseguir...',
          variant: 'default',
        });

        return true;
      }
    }, [matriculaSeparador, toast]);

  /**
   * Obtém informações detalhadas sobre separações ativas
   *
   * @returns Promise<VerificarSeparacoesAtivasResponse> - Dados das separações ativas
   */
  const obterSeparacoesAtivas =
    useCallback(async (): Promise<VerificarSeparacoesAtivasResponse> => {
      try {
        return await verificarSeparacoesAtivas(matriculaSeparador);
      } catch (error: any) {
        console.error('Erro ao obter separações ativas:', error);

        // Retorna resposta padrão em caso de erro
        return {
          temSeparacaoAtiva: false,
          quantidadeAtivas: 0,
          separacoesAtivas: [],
        };
      }
    }, [matriculaSeparador]);

  /**
   * Valida se um código de separação é válido
   *
   * @param codigo - Código da separação
   * @returns boolean - true se válido, false caso contrário
   */
  const validarCodigoSeparacao = useCallback((codigo: string): boolean => {
    if (!codigo || typeof codigo !== 'string') {
      return false;
    }

    const codigoLimpo = codigo.trim();

    // Validações básicas
    if (codigoLimpo.length === 0) {
      return false;
    }

    // Pode adicionar mais validações específicas do negócio aqui
    // Por exemplo: formato, comprimento mínimo/máximo, etc.

    return true;
  }, []);

  /**
   * Exibe mensagem de erro específica baseada no código de erro da API
   *
   * @param error - Erro retornado pela API
   * @returns void
   */
  const tratarErroIniciarSeparacao = useCallback(
    (error: any) => {
      let errorMessage =
        'Não foi possível iniciar a separação. Tente novamente.';
      let errorTitle = 'Erro ao iniciar separação';

      console.error('Erro detalhado ao iniciar separação:', error);

      if (error?.response?.status === 404) {
        errorTitle = 'Venda não encontrada';
        errorMessage = 'Venda não encontrada. Verifique o código informado.';
      } else if (error?.response?.status === 409) {
        // Tratar erros específicos de conflito (409)
        const errorCode = error.response?.data?.code;

        if (errorCode === 'SEPARACAO_JA_ATIVA') {
          errorTitle = '⚠️ Você já tem uma separação ativa';
          const separacaoAtiva = error.response.data.details?.separacaoAtiva;
          if (separacaoAtiva) {
            errorMessage = `Finalize primeiro o pedido ${
              separacaoAtiva.codvenda
            } (${
              separacaoAtiva.nomecliente || 'Cliente não informado'
            }) antes de iniciar uma nova separação.`;
          } else {
            errorMessage =
              'Você já possui uma separação ativa. Finalize-a antes de iniciar uma nova.';
          }
        } else if (errorCode === 'STATUS_INVALIDO') {
          errorTitle = '❌ Esta venda não pode ser separada';
          const details = error.response.data.details;
          if (details?.statusDescricao) {
            errorMessage = `Status atual: ${details.statusDescricao}. ${
              details.acao || 'Verifique o status da venda.'
            }`;
          } else {
            errorMessage = 'Esta venda não está disponível para separação.';
          }
        } else if (errorCode === 'VENDA_JA_SEPARADA') {
          errorTitle = '✅ Venda já foi separada';
          errorMessage =
            'Esta venda já foi separada por outro operador. Busque uma nova venda para separar.';
        } else if (errorCode === 'VENDA_JA_CONFERIDA') {
          errorTitle = '🔍 Venda já foi conferida';
          errorMessage =
            'Esta venda já passou pelo processo de conferência e não pode ser separada novamente.';
        } else {
          errorTitle = 'Operação não permitida';
          errorMessage =
            error.response.data.error ||
            'Esta venda não está disponível para separação.';
        }
      } else if (error?.response?.status === 400) {
        const errorCode = error.response?.data?.code;

        if (errorCode === 'VENDA_NAO_ENCONTRADA') {
          errorTitle = 'Venda não encontrada';
          errorMessage =
            'O código informado não corresponde a nenhuma venda. Verifique e tente novamente.';
        } else {
          errorTitle = 'Dados inválidos';
          errorMessage =
            error.response.data.error || 'Os dados fornecidos são inválidos.';
        }
      } else if (error?.response?.status >= 500) {
        errorTitle = 'Erro no servidor';
        errorMessage =
          'Erro interno do servidor. Contate o suporte se o problema persistir.';
      } else if (error?.code === 'NETWORK_ERROR' || !error?.response) {
        errorTitle = 'Erro de conexão';
        errorMessage =
          'Verifique sua conexão com a internet e tente novamente.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
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

  const tratarErroFinalizarSeparacao = useCallback(
    (error: any) => {
      let errorMessage =
        'Não foi possível finalizar a separação. Tente novamente.';
      let errorTitle = 'Erro ao finalizar separação';

      console.error('Erro detalhado ao finalizar separação:', error);

      if (error?.response?.status === 404) {
        errorTitle = 'Pedido não encontrado';
        errorMessage = 'O pedido especificado não foi encontrado no sistema.';
      } else if (error?.response?.status === 409) {
        const errorCode = error.response?.data?.code;

        if (errorCode === 'SEPARACAO_NAO_INICIADA') {
          errorTitle = '❌ Separação não foi iniciada';
          errorMessage =
            'Não é possível finalizar uma separação que não foi iniciada. Inicie a separação primeiro.';
        } else if (errorCode === 'SEPARACAO_JA_FINALIZADA') {
          errorTitle = '✅ Separação já foi finalizada';
          errorMessage = 'Esta separação já foi finalizada anteriormente.';
        } else if (errorCode === 'STATUS_INVALIDO_FINALIZACAO') {
          errorTitle = '⚠️ Status não permite finalização';
          const details = error.response.data.details;
          if (details?.statusDescricao) {
            errorMessage = `Status atual: ${details.statusDescricao}. Verifique se a separação foi iniciada corretamente.`;
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
    verificarPodeIniciarSeparacao,
    obterSeparacoesAtivas,
    validarCodigoSeparacao,
    tratarErroIniciarSeparacao,
    tratarErroFinalizarSeparacao,
  };
};
