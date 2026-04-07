/**
 * Hook para registrar historico de acoes em NFe
 */

import { useUser } from '@/hooks/useUser';

type TipoAcaoNfe =
  | 'UPLOAD'
  | 'INICIO_PROCESSAMENTO'
  | 'ASSOCIACAO_ITEM'
  | 'ASSOCIACAO_CONCLUIDA'
  | 'CONFIG_PAGAMENTO'
  | 'PAGAMENTO_ANTECIPADO'
  | 'ENTRADA_GERADA'
  | 'CTE_CADASTRADO'
  | 'PROCESSADA'
  | 'CANCELAMENTO'
  | 'ALTERACAO_STATUS'
  | 'CONTINUAR_PROCESSAMENTO'
  | 'CONFIRMACAO_DADOS';

interface RegistrarHistoricoParams {
  codNfeEnt: number | string;
  tipoAcao: TipoAcaoNfe;
  previousStatus?: string;
  newStatus?: string;
  comments?: Record<string, any>;
}

export const useNFeHistorico = () => {
  const { user } = useUser();

  const registrarHistorico = async (params: RegistrarHistoricoParams): Promise<boolean> => {
    try {
      const response = await fetch('/api/entrada-xml/registrar-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codNfeEnt: typeof params.codNfeEnt === 'string' ? parseInt(params.codNfeEnt) : params.codNfeEnt,
          tipoAcao: params.tipoAcao,
          previousStatus: params.previousStatus,
          newStatus: params.newStatus,
          userId: user?.codusuario || 'SISTEMA',
          userName: user?.login_user_name || 'Sistema',
          comments: params.comments
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success;
      }
      return false;
    } catch (error) {
      console.error('Erro ao registrar historico:', error);
      return false;
    }
  };

  // Helpers para acoes especificas
  const registrarUpload = (codNfeEnt: number | string, detalhes?: { numeroNf?: string; emitente?: string; valorTotal?: number }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'UPLOAD',
      newStatus: 'R',
      comments: { tipo: 'UPLOAD', descricao: 'XML da NFe importado', ...detalhes }
    });
  };

  const registrarInicioProcessamento = (codNfeEnt: number | string, previousStatus?: string) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'INICIO_PROCESSAMENTO',
      previousStatus,
      newStatus: 'A',
      comments: { tipo: 'INICIO_PROCESSAMENTO', descricao: 'Processamento iniciado' }
    });
  };

  const registrarContinuarProcessamento = (codNfeEnt: number | string, previousStatus?: string) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'CONTINUAR_PROCESSAMENTO',
      previousStatus,
      newStatus: 'A',
      comments: { tipo: 'CONTINUAR_PROCESSAMENTO', descricao: 'Processamento retomado' }
    });
  };

  const registrarAssociacaoConcluida = (codNfeEnt: number | string, detalhes?: { totalItens?: number; itensAssociados?: number }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'ASSOCIACAO_CONCLUIDA',
      previousStatus: 'A',
      newStatus: 'C',
      comments: { tipo: 'ASSOCIACAO_CONCLUIDA', descricao: `Associacao concluida`, ...detalhes }
    });
  };

  const registrarConfigPagamento = (codNfeEnt: number | string, detalhes?: { parcelas?: number; banco?: string; valorTotal?: number }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'CONFIG_PAGAMENTO',
      comments: { tipo: 'CONFIG_PAGAMENTO', descricao: `Pagamento configurado`, ...detalhes }
    });
  };

  const registrarPagamentoAntecipado = (codNfeEnt: number | string, detalhes?: { valor?: number; banco?: string }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'PAGAMENTO_ANTECIPADO',
      comments: { tipo: 'PAGAMENTO_ANTECIPADO', descricao: `Pagamento antecipado registrado`, ...detalhes }
    });
  };

  const registrarEntradaGerada = (codNfeEnt: number | string, detalhes?: { codEntrada?: number; numeroEntrada?: string }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'ENTRADA_GERADA',
      previousStatus: 'C',
      newStatus: 'S',
      comments: { tipo: 'ENTRADA_GERADA', descricao: `Entrada gerada com sucesso`, ...detalhes }
    });
  };

  const registrarCteCadastrado = (codNfeEnt: number | string, detalhes?: { numeroCte?: string; transportadora?: string; valorFrete?: number }) => {
    return registrarHistorico({
      codNfeEnt,
      tipoAcao: 'CTE_CADASTRADO',
      comments: { tipo: 'CTE_CADASTRADO', descricao: `CT-e cadastrado`, ...detalhes }
    });
  };

  return {
    registrarHistorico,
    registrarUpload,
    registrarInicioProcessamento,
    registrarContinuarProcessamento,
    registrarAssociacaoConcluida,
    registrarConfigPagamento,
    registrarPagamentoAntecipado,
    registrarEntradaGerada,
    registrarCteCadastrado
  };
};
