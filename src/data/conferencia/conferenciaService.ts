import api from '@/components/services/api';
import { Meta } from '@/data/common/meta';

// Representa o funcionárexport async function getPedidosConferidos(): Promise<PedidoConferido[]> {do
export interface Conferente {
  matricula: string;
  nome: string;
}

// Representa um item na lista de pedidos para conferência
export interface PedidoParaConferencia {
  codvenda: string;
  nomeCliente: string;
  vendedor: string;
  horario: string;
  separador: string;
  fimSeparacao: string;
  inicioConferencia: string;
  nomeConferente: string;
  status: string;
}

// Representa um pedido conferido (finalizado)
export interface PedidoConferido {
  codvenda: string;
  nomeCliente: string;
  vendedor: string;
  horario: string;
  status: string;
  conferente: {
    matricula: string;
    nome: string;
  };
}

// Interface para conferências ativas
export interface ConferenciaAtiva {
  codvenda: string;
  nomeCliente: string;
  data: string;
  total: number;
  inicioconferencia: string;
}

// Interface para conferências finalizadas
export interface ConferenciaFinalizada {
  codvenda: string;
  nomeCliente: string;
  data: string;
  total: number;
  finalizadopedido: string;
  tempoDeConferencia?: string;
}

// Resposta da API de verificar conferências ativas
export interface VerificarConferenciasAtivasResponse {
  temConferenciaAtiva: boolean;
  quantidadeAtivas: number;
  conferenciasAtivas: ConferenciaAtiva[];
}

// Representa a resposta da API para a lista de pedidos conferidos
export interface PedidosConferidosResponse {
  data: PedidoConferido[];
  meta: Meta;
}

// Payload para iniciar conferência
export interface IniciarConferenciaPayload {
  codVenda: string;
  matriculaConferente: string;
  nomeConferente: string;
}

// Payload para finalizar conferência
export interface FinalizarConferenciaPayload {
  codVenda: string;
  matricula: string;
  nome: string;
}

// Função para fazer login do conferente (com matrícula e código de acesso)
export async function loginConferente(
  matricula: string,
  codigoAcesso: string,
  filial?: string, // Filial opcional
): Promise<Conferente> {
  let conferente: Conferente = {} as Conferente;

  const payload: { matricula: string; codigoAcesso: string; filial?: string } =
    {
      matricula,
      codigoAcesso,
    };

  // Adicionar filial ao payload se fornecida
  if (filial) {
    payload.filial = filial;
  }

  await api.post('/api/conferencia/login', payload).then((response) => {
    conferente = response.data.data;
  });

  return conferente;
}

// Função para buscar pedidos em conferência de um conferente específico
export async function getPedidosEmConferencia(
  nomeConferente: string,
): Promise<PedidoParaConferencia[]> {
  try {
    const response = await api.get(
      `/api/conferencia/pedidos?nomeConferente=${nomeConferente}`,
    );
    return response.data.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos em conferência:', error);
    return [];
  }
}

// Função para buscar pedidos disponíveis para conferência (status '3' - Separado)
// e pedidos em conferência (status '4' - Em conferência)
export async function getPedidosParaConferencia(): Promise<
  PedidoParaConferencia[]
> {
  let pedidos: PedidoParaConferencia[] = [];

  try {
    const response = await api.get('/api/conferencia/pedidos');
    pedidos = response.data.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos para conferência:', error);
    // Retorna array vazio em caso de erro, similar ao padrão existente
    pedidos = [];
  }

  return pedidos;
}

// Função para buscar pedidos conferidos (status '5' - Conferido)
export async function getPedidosConferidos(): Promise<PedidoConferido[]> {
  let pedidos: PedidoConferido[] = [];

  try {
    const response = await api.get('/api/conferencia/conferidos');
    pedidos = response.data.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos conferidos:', error);
    // Retorna array vazio em caso de erro
    pedidos = [];
  }

  return pedidos;
}

// Função para iniciar conferência de um pedido
export async function iniciarConferencia(
  payload: IniciarConferenciaPayload,
): Promise<void> {
  try {
    await api.put('/api/conferencia/iniciar', payload);
  } catch (error) {
    console.error('Erro ao iniciar conferência:', error);
    throw error;
  }
}

// Função para finalizar conferência de um pedido
export async function finalizarConferencia(
  payload: FinalizarConferenciaPayload,
): Promise<void> {
  try {
    await api.put('/api/conferencia/finalizar', payload);
  } catch (error) {
    console.error('Erro ao finalizar conferência:', error);
    throw error;
  }
}

/**
 * Verifica se um conferente possui conferências ativas
 *
 * @param matricula - Matrícula do conferente
 * @returns Promise com informações sobre conferências ativas
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function verificarConferenciasAtivas(
  matricula: string,
): Promise<VerificarConferenciasAtivasResponse> {
  // Validação de entrada
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula é obrigatória e deve ser uma string válida');
  }

  try {
    const response = await api.get(
      `/api/conferencia/verificar-ativas?matricula=${matricula}`,
    );
    return response.data;
  } catch (error: any) {
    console.error('Erro ao verificar conferências ativas:', {
      matricula,
      error: error?.response?.data || error?.message || error,
      status: error?.response?.status,
    });

    // Re-throw para permitir tratamento específico no componente
    throw error;
  }
}

/**
 * Busca conferências finalizadas de um conferente
 *
 * @param matricula - Matrícula do conferente
 * @param limit - Número máximo de conferências a retornar (padrão: 10, máximo: 50)
 * @returns Promise com lista de conferências finalizadas
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function getConferenciasFinalizadas(
  matricula: string,
  limit: number = 10,
): Promise<ConferenciaFinalizada[]> {
  // Validação de entrada
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula é obrigatória e deve ser uma string válida');
  }

  if (limit < 1 || limit > 50) {
    throw new Error('Limit deve ser um número entre 1 e 50');
  }

  try {
    const response = await api.get(
      `/api/conferencia/finalizadas?matricula=${matricula}&limit=${limit}`,
    );
    return response.data.data;
  } catch (error: any) {
    console.error('Erro ao buscar conferências finalizadas:', {
      matricula,
      limit,
      error: error?.response?.data || error?.message || error,
      status: error?.response?.status,
    });

    // Re-throw para permitir tratamento específico no componente
    throw error;
  }
}

/**
 * Altera o código de acesso de um funcionário
 *
 * @param matricula - Matrícula do funcionário
 * @param codigoAtual - Código de acesso atual
 * @param novoCodigo - Novo código de acesso
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function alterarCodigoAcesso(
  matricula: string,
  codigoAtual: string,
  novoCodigo: string,
): Promise<void> {
  // Validação de entrada
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula é obrigatória e deve ser uma string válida');
  }

  if (!codigoAtual || typeof codigoAtual !== 'string') {
    throw new Error('Código atual é obrigatório e deve ser uma string válida');
  }

  if (!novoCodigo || typeof novoCodigo !== 'string') {
    throw new Error('Novo código é obrigatório e deve ser uma string válida');
  }

  if (novoCodigo.length < 4) {
    throw new Error('Novo código deve ter pelo menos 4 caracteres');
  }

  try {
    await api.put('/api/alterar-codigo-acesso', {
      matricula,
      codigoAtual,
      novoCodigo,
    });
  } catch (error: any) {
    console.error('Erro ao alterar código de acesso:', {
      matricula,
      error: error?.response?.data || error?.message || error,
      status: error?.response?.status,
    });

    // Re-throw para permitir tratamento específico no componente
    throw error;
  }
}

// Função utilitária para determinar se um pedido pode ser finalizado
export function podeFinalizarConferencia(status: string): boolean {
  return status === '4'; // Só pode finalizar se estiver "Em conferência"
}

// Função utilitária para obter o texto do status
export function getStatusTexto(status: string): string {
  const statusMap: { [key: string]: string } = {
    '1': 'Aguardando Separação',
    '2': 'Em Separação',
    '3': 'Separado',
    '4': 'Em Conferência',
    '5': 'Conferido',
  };

  return statusMap[status] || 'Status Desconhecido';
}
