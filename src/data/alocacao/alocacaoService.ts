import api from '@/components/services/api';

// ==========================================
// INTERFACES
// ==========================================

// Operador logado
export interface Alocador {
  matricula: string;
  nome: string;
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
export async function loginAlocador(
  matricula: string,
  codigoAcesso: string,
  filial?: string,
): Promise<Alocador> {
  const payload: { matricula: string; codigoAcesso: string; filial?: string } = {
    matricula,
    codigoAcesso,
  };

  if (filial) {
    payload.filial = filial;
  }

  const response = await api.post('/api/alocacao/login', payload);
  return response.data.data;
}

/**
 * Buscar entradas disponiveis para alocacao
 */
export async function getEntradasParaAlocar(
  nomeAlocador?: string,
): Promise<EntradaParaAlocar[]> {
  const timestamp = Date.now();
  const params = nomeAlocador
    ? `?nomeAlocador=${encodeURIComponent(nomeAlocador)}&_t=${timestamp}`
    : `?_t=${timestamp}`;

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
}): Promise<void> {
  await api.put('/api/alocacao/finalizar', payload);
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
