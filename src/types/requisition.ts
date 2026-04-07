// Tipos unificados para o módulo de compras
// Centralizando todas as definições de tipos em um local único

/**
 * Status possíveis de uma requisição de compra
 */
export enum RequisitionStatus {
  DRAFT = 'P',           // Pendente/Rascunho
  SUBMITTED = 'S',       // Submetida
  APPROVED = 'A',        // Aprovada
  REJECTED = 'R',        // Rejeitada/Reprovada
  CANCELLED = 'C'        // Cancelada
}

/**
 * Status possíveis de uma ordem de compra
 */
export enum OrderStatus {
  PENDING = 'P',         // Pendente
  APPROVED = 'A',        // Aprovada
  REJECTED = 'R',        // Rejeitada
  CANCELLED = 'C'        // Cancelada
}

/**
 * Tipos de requisição de compra
 */
export enum RequisitionType {
  CONSUMO = 'CONSUMO',
  VENDA_CASADA = 'VENDA_CASADA',
  BONIFICACAO = 'BONIFICACAO',
  COBRANCA = 'COBRANCA',
  DEVOLUCAO = 'DEVOLUCAO',
  GARANTIA = 'GARANTIA',
  REPOSICAO = 'REPOSICAO'
}

/**
 * Interface para dados do fornecedor
 */
export interface Fornecedor {
  cod_credor: string;
  nome: string;
  nome_fant?: string;
  cpf_cgc?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
}

/**
 * Interface para dados do comprador
 */
export interface Comprador {
  codcomprador: string;
  nome: string;
  email?: string;
  telefone?: string;
  percentual?: number;
}

/**
 * Interface para dados da filial
 */
export interface Filial {
  unm_id: string;
  unm_nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

/**
 * Interface unificada para requisições de compra
 * Consolida todas as variações em uma única definição
 */
export interface RequisitionDTO {
  // Chaves primárias
  id: number;
  versao: number;
  
  // Dados básicos da requisição
  requisicao?: string;                    // req_id_composto
  dataRequisicao?: string;               // req_data
  statusRequisicao?: RequisitionStatus;  // req_status
  tipo?: string;                         // req_tipo
  previsaoChegada?: string;              // req_previsao_chegada
  observacao?: string;                   // req_observacao
  condPagto?: string;                    // req_cond_pagto
  condicoesPagamento?: string;           // Alias para condPagto
  
  // Dados do fornecedor
  fornecedorCodigo?: string;             // Via include: requisicao_fornecedor.cod_credor
  fornecedorNome?: string;               // Via include: requisicao_fornecedor.nome
  fornecedorCpfCnpj?: string;            // Via include: requisicao_fornecedor.cpf_cgc
  
  // Dados do comprador
  compradorCodigo?: string;              // req_codcomprador
  compradorNome?: string;                // Via include: requisicao_comprador.nome
  
  // Dados de entrega e destino
  localEntrega?: string;                 // Via include: requisicao_entrega.unm_nome
  destino?: string;                      // Via include: requisicao_destino.unm_nome
  entregaId?: number;                    // req_unm_id_entrega
  destinoId?: number;                    // req_unm_id_destino
  
  // Dados da ordem de compra (quando existir)
  ordemCompra?: string;                  // orc_id
  dataOrdem?: string;                    // orc_data
  statusOrdem?: OrderStatus;             // orc_status
  
  // Campos de sistema
  reqCodusr?: string;                    // req_codusr
  reqSituacao?: number;                  // req_situacao
  reqIdComposto?: string;                // req_id_composto
  
  // Dados calculados/derivados
  totalItens?: number;                   // Quantidade total de itens
  valorTotal?: number;                   // Valor total da requisição
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface para itens da requisição
 */
export interface RequisitionItem {
  // Chaves primárias
  reqId: number;                         // req_id
  reqVersao: number;                     // req_versao
  itemSeq: number;                       // item_seq
  
  // Dados do produto
  codprod: string;                       // codprod
  descricao?: string;                    // Descrição do produto
  marca?: string;                        // Marca do produto
  referencia?: string;                   // Referência do produto
  
  // Quantidades e preços
  quantidade: number;                    // quantidade
  precoUnitario: number;                 // preco_unitario
  precoTotal: number;                    // preco_total
  
  // Status do item
  status?: string;                       // status do item
  observacao?: string;                   // observações específicas do item
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface para formulário de nova requisição
 */
export interface NovaRequisicaoForm {
  tipo: string;
  fornecedor: Fornecedor | null;
  comprador_codigo: string;
  comprador_nome: string;
  entrega_em: string;
  destinado_para: string;
  previsao_chegada: string;
  condicoes_pagamento: string;
  observacao: string;
}

/**
 * Interface para item do carrinho
 */
export interface CartItem {
  codprod: string;
  descricao: string;
  marca?: string;
  referencia?: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  seq?: number;
}

/**
 * Interface para resposta da API de criação
 */
export interface CreateRequisitionResponse {
  success: boolean;
  message: string;
  data?: {
    req_id: number;
    req_versao: number;
    req_id_composto: string;
  };
  error?: string;
}

/**
 * Interface para resposta da API de listagem
 */
export interface ListRequisitionsResponse {
  success: boolean;
  data: RequisitionDTO[];
  total: number;
  page: number;
  limit: number;
  message?: string;
}

/**
 * Interface para parâmetros de filtro
 */
export interface RequisitionFilters {
  status?: RequisitionStatus[];
  fornecedor?: string;
  comprador?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  page?: number;
  limit?: number;
}

/**
 * Interface para payload de atualização de status
 */
export interface UpdateStatusPayload {
  id: number;
  versao: number;
  status: RequisitionStatus;
  observacao?: string;
  userId?: string;
}

/**
 * Type guards para validação
 */
export const isValidRequisitionStatus = (status: string): status is RequisitionStatus => {
  return Object.values(RequisitionStatus).includes(status as RequisitionStatus);
};

export const isValidOrderStatus = (status: string): status is OrderStatus => {
  return Object.values(OrderStatus).includes(status as OrderStatus);
};

/**
 * Utilitários para conversão de dados
 */
export const mapFormToRequisition = (form: NovaRequisicaoForm): Partial<RequisitionDTO> => {
  return {
    tipo: form.tipo,
    fornecedorCodigo: form.fornecedor?.cod_credor,
    fornecedorNome: form.fornecedor?.nome,
    compradorCodigo: form.comprador_codigo,
    compradorNome: form.comprador_nome,
    entregaId: form.entrega_em ? parseInt(form.entrega_em) : undefined,
    destinoId: form.destinado_para ? parseInt(form.destinado_para) : undefined,
    previsaoChegada: form.previsao_chegada || undefined,
    condicoesPagamento: form.condicoes_pagamento || undefined,
    observacao: form.observacao || undefined,
    statusRequisicao: RequisitionStatus.DRAFT
  };
};

/**
 * Utilitário para mapear dados do form para payload da API
 */
export const mapFormToApiPayload = (form: NovaRequisicaoForm) => {
  return {
    tipo: form.tipo,
    cod_fornecedor: form.fornecedor?.cod_credor || '',
    nome_fornecedor: form.fornecedor?.nome || '',
    comprador: form.comprador_codigo,
    nome_comprador: form.comprador_nome,
    entrega_em: form.entrega_em,
    destinado_para: form.destinado_para,
    previsao_chegada: form.previsao_chegada || null,
    condicoes_pagamento: form.condicoes_pagamento || '',
    observacao: form.observacao || '',
    req_status: RequisitionStatus.DRAFT
  };
};

/**
 * Utilitários para mapeamento de status
 */
export const getStatusLabel = (status: RequisitionStatus): string => {
  const labels: Record<RequisitionStatus, string> = {
    [RequisitionStatus.DRAFT]: 'Rascunho',
    [RequisitionStatus.SUBMITTED]: 'Submetida',
    [RequisitionStatus.APPROVED]: 'Aprovada',
    [RequisitionStatus.REJECTED]: 'Rejeitada',
    [RequisitionStatus.CANCELLED]: 'Cancelada'
  };
  return labels[status] || 'Desconhecido';
};

export const getStatusColor = (status: RequisitionStatus): string => {
  const colors: Record<RequisitionStatus, string> = {
    [RequisitionStatus.DRAFT]: 'bg-gray-100 text-gray-800',
    [RequisitionStatus.SUBMITTED]: 'bg-blue-100 text-blue-800',
    [RequisitionStatus.APPROVED]: 'bg-green-100 text-green-800',
    [RequisitionStatus.REJECTED]: 'bg-red-100 text-red-800',
    [RequisitionStatus.CANCELLED]: 'bg-yellow-100 text-yellow-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};