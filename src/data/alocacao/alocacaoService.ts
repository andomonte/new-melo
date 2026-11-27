import apiBase from '@/components/services/api';

// ==========================================
// FILIAL DA TELA
// ==========================================
// Tela solta (link fixo por filial: /alocacao/1 = MANAUS). Toda chamada leva a filial no
// header x-filial-estacao (lido em lib/recebimentoEntrada/filial.ts).
let filialAtual = 'MANAUS';
export function definirFilialAlocacao(filial: string) {
  filialAtual = String(filial || 'MANAUS').toUpperCase();
}
const comFilial = (cfg: any = {}) => ({
  ...cfg,
  headers: { ...(cfg.headers || {}), 'x-filial-estacao': encodeURIComponent(filialAtual) },
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
export interface Alocador {
  matricula: string;
  nome: string;
  /** código ainda igual à matrícula: a tela obriga a criar um código pessoal */
  primeiroAcesso?: boolean;
}

// Resumo de romaneio por armazém
export interface RomaneioResumo {
  arm_id: number;
  arm_descricao: string;
  qtd_total: number;
}

// Entrada disponivel para alocacao
export interface EntradaParaAlocar {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_recebimento: string;
  status: string;
  status_label: string;
  alocador_nome?: string;
  inicio_alocacao?: string;
  tem_divergencia: boolean;
  /** alocação exige preço confirmado (libera para venda) */
  preco_confirmado?: boolean;
  tem_romaneio?: boolean;
  romaneio_resumo?: RomaneioResumo[];
}

// Romaneio planejado para um item
export interface RomaneioItem {
  arm_id: number;
  arm_descricao: string;
  qtd: number;
  localizacao_existente?: string; // Localização já cadastrada para este produto
}

// Distribuição de alocação por armazém (para nova UI dinâmica)
export interface AlocacaoDistribuicao {
  arm_id: number;
  qtd: number;
  localizacao?: string; // Localização física (ex: "P1/35 D 1")
}

// Item de uma entrada para alocacao
export interface ItemEntradaAlocacao {
  id: number;
  entrada_item_id: number;
  produto_cod: string;
  produto_nome: string;
  qtd_recebida: number;
  qtd_alocada: number;
  status_alocacao: 'PENDENTE' | 'ALOCADO' | 'PARCIAL';
  unidade: string;
  arm_id?: number;
  arm_descricao?: string;
  romaneio_planejado?: RomaneioItem[];
}

// Armazem disponivel
export interface Armazem {
  arm_id: number;
  arm_descricao: string;
}

// Alocacao finalizada (historico)
export interface AlocacaoFinalizada {
  id: number;
  numero_entrada: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_alocacao: string;
  tempo_alocacao?: string;
  arm_descricao?: string;
}

// Resposta da API de verificar ativas
export interface VerificarAtivasAlocacaoResponse {
  temAlocacaoAtiva: boolean;
  quantidadeAtivas: number;
  alocacoesAtivas: EntradaParaAlocar[];
}

// ==========================================
// FUNCOES DO SERVICE
// ==========================================

/**
 * Login do alocador
 */
export async function loginAlocador(matricula: string, codigoAcesso: string): Promise<Alocador> {
  const response = await api.post('/api/alocacao/login', { matricula, codigoAcesso });
  return response.data.data;
}

/** Primeiro acesso: cria o código pessoal (mesmo cadastro dbfunc_estoque das estações). */
export async function criarCodigoAlocador(matricula: string, novoCodigo: string): Promise<void> {
  await api.post('/api/conferencia/estacao/criar-codigo', { matricula, novoCodigo, filial: filialAtual });
}

/**
 * Buscar entradas disponiveis para alocacao
 */
export async function getEntradasParaAlocar(
  nomeAlocador?: string,
  busca?: string,
): Promise<EntradaParaAlocar[]> {
  const timestamp = Date.now();
  const params =
    (nomeAlocador ? `?nomeAlocador=${encodeURIComponent(nomeAlocador)}&_t=${timestamp}` : `?_t=${timestamp}`) +
    (busca ? `&busca=${encodeURIComponent(busca)}` : '');

  const response = await api.get(`/api/alocacao/entradas${params}`, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });

  return response.data.data || [];
}

/**
 * Buscar itens de uma entrada para alocacao
 */
export async function getItensEntradaAlocacao(
  entradaId: number,
): Promise<ItemEntradaAlocacao[]> {
  const timestamp = Date.now();
  const response = await api.get(
    `/api/alocacao/itens?entradaId=${entradaId}&_t=${timestamp}`,
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
 * Buscar armazens disponiveis
 */
export async function getArmazens(): Promise<Armazem[]> {
  const response = await api.get('/api/alocacao/armazens');
  return response.data.data || [];
}

/**
 * Iniciar alocacao de uma entrada
 */
export async function iniciarAlocacao(payload: {
  entradaId: number;
  matriculaAlocador: string;
  nomeAlocador: string;
  armId: number;
}): Promise<void> {
  await api.put('/api/alocacao/iniciar', payload);
}

/**
 * Alocar um item especifico (formato legacy - único armazém)
 */
export async function alocarItem(payload: {
  entradaItemId: number;
  qtdAlocada: number;
  armId: number;
  matricula: string;
}): Promise<void> {
  await api.put('/api/alocacao/alocar-item', payload);
}

/**
 * Alocar um item com distribuição em múltiplos armazéns (novo formato)
 */
export async function alocarItemMultiplo(payload: {
  entradaItemId: number;
  alocacoes: AlocacaoDistribuicao[];
  matricula: string;
}): Promise<void> {
  await api.put('/api/alocacao/alocar-item', payload);
}

/**
 * Finalizar alocacao de uma entrada
 */
export async function finalizarAlocacao(payload: {
  entradaId: number;
  matricula: string;
  observacao?: string;
}): Promise<FinalizarAlocacaoResposta> {
  const response = await api.put('/api/alocacao/finalizar', payload);
  return response.data;
}

/** Devolução iniciada na finalização (itens com falta, danificado ou errado). */
export interface DevolucaoIniciada {
  devId: string;
  codvenda: string | null;
  nrovenda: string | null;
  codcli: string | null;
  semCliente: boolean;
  clienteCriado?: boolean;
  itens: { codprod: string; descr: string; qtd: number; motivo: string; prunit: number }[];
}
export interface FinalizarAlocacaoResposta {
  success: boolean;
  message: string;
  devolucao?: DevolucaoIniciada | null;
}

/**
 * Verificar se alocador tem alocacoes ativas
 */
export async function verificarAlocacoesAtivas(
  matricula: string,
): Promise<VerificarAtivasAlocacaoResponse> {
  const timestamp = Date.now();
  const response = await api.get(
    `/api/alocacao/verificar-ativas?matricula=${encodeURIComponent(matricula)}&_t=${timestamp}`,
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
 * Buscar alocacoes finalizadas (historico)
 */
export async function getAlocacoesFinalizadas(
  matricula: string,
  limit: number = 10,
): Promise<AlocacaoFinalizada[]> {
  const timestamp = Date.now();
  const response = await api.get(
    `/api/alocacao/finalizados?matricula=${encodeURIComponent(matricula)}&limit=${limit}&_t=${timestamp}`,
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
