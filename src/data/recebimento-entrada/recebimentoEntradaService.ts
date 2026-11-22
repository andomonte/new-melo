import apiBase from '@/components/services/api';

// ==========================================
// FILIAL DA TELA
// ==========================================
// A tela é solta (link fixo por filial: /entrada/recebimento/1 = MANAUS). Toda chamada
// leva a filial no header x-filial-recebimento (lido em lib/recebimentoEntrada/filial.ts).
let filialAtual = 'MANAUS';
export function definirFilialRecebimento(filial: string) {
  filialAtual = String(filial || 'MANAUS').toUpperCase();
}
export function filialRecebimentoAtual() {
  return filialAtual;
}
const comFilial = (cfg: any = {}) => ({
  ...cfg,
  headers: { ...(cfg.headers || {}), 'x-filial-recebimento': encodeURIComponent(filialAtual) },
});
const api = {
  get: (url: string, cfg?: any) => apiBase.get(url, comFilial(cfg)),
  post: (url: string, data?: any, cfg?: any) => apiBase.post(url, data, comFilial(cfg)),
  put: (url: string, data?: any, cfg?: any) => apiBase.put(url, data, comFilial(cfg)),
};

// ==========================================
// INTERFACES
// ==========================================

// Operador logado
export interface Recebedor {
  matricula: string;
  nome: string;
  /** código ainda igual à matrícula: a tela obriga a criar um código pessoal */
  primeiroAcesso?: boolean;
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
  arm_id: number | null;
  romaneio_dividido: boolean;
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
export async function loginRecebedor(matricula: string, codigoAcesso: string): Promise<Recebedor> {
  const response = await api.post('/api/entrada/recebimento/login', { matricula, codigoAcesso });
  return response.data.data;
}

/** Primeiro acesso: cria o código pessoal (mesmo cadastro dbfunc_estoque das estações). */
export async function criarCodigoRecebedor(matricula: string, novoCodigo: string): Promise<void> {
  await api.post('/api/conferencia/estacao/criar-codigo', { matricula, novoCodigo, filial: filialAtual });
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

export interface ArmazemAlterado {
  entradaItemId: number;
  armId: number;
}

/**
 * Finalizar recebimento de uma entrada
 */
export async function finalizarRecebimento(payload: {
  entradaId: number;
  matricula: string;
  observacao?: string;
  armazens?: ArmazemAlterado[];
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

// ==========================================
// ENTRADAS PARA RECEBER (lista com busca)
// ==========================================

export interface EntradaDisponivel {
  codent: string;
  chave: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  cnpj: string;
  valor_total: number;
  qtd_itens: number;
  data_entrada: string;
  data_emissao: string | null;
  status: string;
  preco_confirmado: boolean;
}

/** Entradas que podem ser recebidas (geradas, com ou sem preço), com busca por NF, chave, fornecedor. */
export async function getEntradasDisponiveis(busca = ''): Promise<EntradaDisponivel[]> {
  const response = await api.get(
    `/api/entrada/recebimento/disponiveis?busca=${encodeURIComponent(busca)}&_t=${Date.now()}`,
  );
  return response.data.data || [];
}

/** Inicia o recebimento a partir da lista (pelo número da entrada). */
export async function iniciarRecebimentoPorEntrada(payload: {
  codent: string;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}): Promise<EntradaParaReceber> {
  const response = await api.post('/api/entrada/recebimento/iniciar-por-chave', payload);
  return response.data.data;
}
