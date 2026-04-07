import api from '@/components/services/api';
import { Meta } from '@/data/common/meta';

// Representa o funcionário logado
export interface Separador {
  matricula: string;
  nome: string;
}

// Representa um item na lista de pedidos a serem separados
export interface PedidoParaSeparar {
  codvenda: string;
  nomeCliente: string;
  vendedor: string;
  horario: string;
  ra_mat: string;
  nome: string;
}

// Representa a resposta da API para a lista de pedidos
export interface PedidosParaSepararResponse {
  data: PedidoParaSeparar[];
  meta: Meta;
}

// Payload para iniciar separação
export interface IniciarSeparacaoPayload {
  codVenda: string;
  matriculaSeparador: string;
  nomeSeparador: string;
}

// Interface para separações ativas
export interface SeparacaoAtiva {
  codvenda: string;
  nomeCliente: string;
  data: string;
  total: number;
}

// Resposta da API de verificar separações ativas
export interface VerificarSeparacoesAtivasResponse {
  temSeparacaoAtiva: boolean;
  quantidadeAtivas: number;
  separacoesAtivas: SeparacaoAtiva[];
}

// Interface para separações finalizadas
export interface SeparacaoFinalizada {
  codvenda: string;
  nomeCliente: string;
  data: string;
  total: number;
  finalizadopedido: string;
  tempoDeSeparacao?: string;
}

// Função para fazer login do separador
export async function loginSeparador(
  matricula: string,
  codigoAcesso: string,
  filial?: string, // Filial opcional
): Promise<Separador> {
  let separador: Separador = {} as Separador;

  const payload: { matricula: string; codigoAcesso: string; filial?: string } =
    {
      matricula,
      codigoAcesso,
    };

  // Adicionar filial ao payload se fornecida
  if (filial) {
    payload.filial = filial;
  }

  await api.post('/api/separacao/login', payload).then((response) => {
    separador = response.data.data;
  });

  return separador;
}

// Função para buscar pedidos em separação de um separador específico
export async function getPedidosEmSeparacao(
  nomeSeparador: string,
): Promise<PedidoParaSeparar[]> {
  let pedidos: PedidoParaSeparar[] = [];

  try {
    // Adicionar timestamp para evitar cache do navegador
    const timestamp = Date.now();
    const response = await api.get(
      `/api/separacao/pedidos?nomeSeparador=${nomeSeparador}&_t=${timestamp}`,
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
    pedidos = response.data.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos em separação:', error);
    // Retorna array vazio em caso de erro, similar ao padrão do getBairros
    pedidos = [];
  }

  return pedidos;
}

// Função para iniciar separação de um pedido
export async function iniciarSeparacao(
  payload: IniciarSeparacaoPayload,
): Promise<void> {
  try {
    await api.put('/api/separacao/iniciar', payload);
  } catch (error) {
    console.error('Erro ao iniciar separação:', error);
    throw error; // Re-throw para permitir tratamento específico no componente
  }
}

/**
 * Finaliza uma separação específica
 * Altera o status do pedido de "Em Separação" para "Separado"
 * e remove da lista de pedidos em separação do usuário
 *
 * @param codVenda - Código da venda a ser finalizada
 * @param separadorInfo - Informações do separador (opcional, para separações órfãs)
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function finalizarSeparacao(
  codVenda: string,
  separadorInfo?: { matricula: string; nome: string },
): Promise<void> {
  // Validação de entrada no service layer
  if (!codVenda || typeof codVenda !== 'string') {
    throw new Error('Código da venda é obrigatório e deve ser uma string');
  }

  try {
    const payload: any = { codVenda };
    if (separadorInfo) {
      payload.separadorInfo = separadorInfo;
    }

    await api.put('/api/separacao/finalizar', payload);
  } catch (error: any) {
    // Log detalhado do erro
    console.error('Erro ao finalizar separação:', {
      codVenda,
      separadorInfo,
      error: error?.response?.data || error?.message || error,
      status: error?.response?.status,
    });

    // Relançar o erro para que o componente possa tratá-lo
    throw error;
  }
}

/**
 * Verifica se um separador possui separações ativas
 *
 * Implementa a regra de negócio: um separador só pode ter uma separação ativa por vez.
 * Separações ativas são aquelas com status '2' (Em Separação).
 *
 * @param matricula - Matrícula do separador
 * @returns Dados sobre separações ativas do separador
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function verificarSeparacoesAtivas(
  matricula: string,
): Promise<VerificarSeparacoesAtivasResponse> {
  // Validação de entrada
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula é obrigatória e deve ser uma string válida');
  }

  try {
    // Adicionar timestamp para evitar cache do navegador
    const timestamp = Date.now();
    const response = await api.get(
      `/api/separacao/verificar-ativas?matricula=${matricula}&_t=${timestamp}`,
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Erro ao verificar separações ativas:', {
      matricula,
      error: error?.response?.data || error?.message || error,
      status: error?.response?.status,
    });

    // Re-throw para permitir tratamento específico no componente
    throw error;
  }
}

/**
 * Busca separações finalizadas de um separador específico
 *
 * Retorna as últimas separações concluídas pelo separador em ordem decrescente
 * de finalização, com métricas de tempo de separação.
 *
 * @param matricula - Matrícula do separador
 * @param limit - Limite de registros (padrão: 10, máximo: 50)
 * @returns Lista de separações finalizadas
 * @throws {Error} - Lança erro em caso de falha na requisição
 */
export async function getSeparacoesFinalizadas(
  matricula: string,
  limit: number = 10,
): Promise<SeparacaoFinalizada[]> {
  // Validação de entrada
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula é obrigatória e deve ser uma string válida');
  }

  if (limit < 1 || limit > 50) {
    throw new Error('Limit deve ser um número entre 1 e 50');
  }

  try {
    // Adicionar timestamp para evitar cache do navegador
    const timestamp = Date.now();
    const response = await api.get(
      `/api/separacao/finalizadas?matricula=${matricula}&limit=${limit}&_t=${timestamp}`,
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
    return response.data.data;
  } catch (error: any) {
    console.error('Erro ao buscar separações finalizadas:', {
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
