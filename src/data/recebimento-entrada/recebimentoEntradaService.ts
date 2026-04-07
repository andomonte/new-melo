import api from '@/components/services/api';

// ==========================================
// INTERFACES
// ==========================================

// Operador logado
export interface Recebedor {
  matricula: string;
  nome: string;
}

// Entrada disponível para recebimento
export interface EntradaParaReceber {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_entrada: string;
  status: string;
  status_label: string;
  recebedor_nome?: string;
  inicio_recebimento?: string;
  preco_confirmado?: boolean;
  data_confirmacao_preco?: string;
}

// Item de uma entrada para conferência
export interface ItemEntradaRecebimento {
  id: number;
  entrada_item_id: number;
  produto_cod: string;
  produto_nome: string;
  qtd_esperada: number;
  qtd_recebida: number | null;
  status_item: 'PENDENTE' | 'OK' | 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'ERRADO';
  observacao: string | null;
  unidade: string;
}

// Recebimento finalizado (histórico)
export interface RecebimentoFinalizado {
  id: number;
  numero_entrada: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_recebimento: string;
  tempo_recebimento?: string;
  tem_divergencia: boolean;
}

// Resposta da API de verificar ativas
export interface VerificarAtivasResponse {
  temRecebimentoAtivo: boolean;
  quantidadeAtivas: number;
  recebimentosAtivos: EntradaParaReceber[];
}

// ==========================================
// FUNÇÕES DO SERVICE
// ==========================================

/**
 * Login do recebedor
 */
export async function loginRecebedor(
  matricula: string,
  codigoAcesso: string,
  filial?: string,
): Promise<Recebedor> {
  const payload: { matricula: string; codigoAcesso: string; filial?: string } = {
    matricula,
    codigoAcesso,
  };

  if (filial) {
    payload.filial = filial;
  }

  const response = await api.post('/api/entrada/recebimento/login', payload);
  return response.data.data;
}

/**
 * Buscar entradas disponíveis para recebimento
 */
export async function getEntradasParaReceber(
  nomeRecebedor?: string,
): Promise<EntradaParaReceber[]> {
  const timestamp = Date.now();
  const params = nomeRecebedor
    ? `?nomeRecebedor=${encodeURIComponent(nomeRecebedor)}&_t=${timestamp}`
    : `?_t=${timestamp}`;

  const response = await api.get(`/api/entrada/recebimento/entradas${params}`, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });

  return response.data.data || [];
}

/**
 * Buscar itens de uma entrada para conferência
 */
export async function getItensEntrada(
  entradaId: number,
): Promise<ItemEntradaRecebimento[]> {
  const response = await api.get(`/api/entrada/recebimento/itens?entradaId=${entradaId}`);
  return response.data.data || [];
}

/**
 * Iniciar recebimento de uma entrada
 */
export async function iniciarRecebimento(payload: {
  entradaId: number;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}): Promise<void> {
  await api.put('/api/entrada/recebimento/iniciar', payload);
}

/**
 * Conferir um item específico
 */
export async function conferirItem(payload: {
  entradaItemId: number;
  qtdRecebida: number;
  statusItem: 'OK' | 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'ERRADO';
  observacao?: string;
  matricula: string;
}): Promise<void> {
  await api.put('/api/entrada/recebimento/conferir-item', payload);
}

/**
 * Finalizar recebimento de uma entrada
 */
export async function finalizarRecebimento(payload: {
  entradaId: number;
  matricula: string;
  observacao?: string;
}): Promise<void> {
  await api.put('/api/entrada/recebimento/finalizar', payload);
}

/**
 * Verificar se recebedor tem recebimentos ativos
 */
export async function verificarRecebimentosAtivos(
  matricula: string,
): Promise<VerificarAtivasResponse> {
  const timestamp = Date.now();
  const response = await api.get(
    `/api/entrada/recebimento/verificar-ativas?matricula=${encodeURIComponent(matricula)}&_t=${timestamp}`,
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  );
  return response.data;
}

/**
 * Buscar recebimentos finalizados (histórico)
 */
export async function getRecebimentosFinalizados(
  matricula: string,
  limit: number = 10,
): Promise<RecebimentoFinalizado[]> {
  const timestamp = Date.now();
  const response = await api.get(
    `/api/entrada/recebimento/finalizados?matricula=${encodeURIComponent(matricula)}&limit=${limit}&_t=${timestamp}`,
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  );
  return response.data.data || [];
}

/**
 * Buscar NFe por chave de acesso e iniciar recebimento
 */
export async function iniciarRecebimentoPorChaveNFe(payload: {
  chaveNFe: string;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}): Promise<EntradaParaReceber> {
  const response = await api.post('/api/entrada/recebimento/iniciar-por-chave', payload);
  return response.data.data;
}
