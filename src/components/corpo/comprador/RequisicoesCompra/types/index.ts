// Core interfaces for RequisicoesCompra module

export interface TipoRequisicao {
  ret_id: string;
  ret_descricao: string;
}

export interface Fornecedor {
  cod_credor: string;
  nome: string;
  nome_fant?: string;
  cpf_cgc?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

export interface Filial {
  unm_id: string;
  unm_nome: string;
}

export interface Comprador {
  codcomprador: string;
  nome: string;
}

export interface FormDataRequisicao {
  tipo: string;
  cod_fornecedor: string;
  cod_comprador: string;
  entrega_em: string;
  destinado_para: string;
  condicoes_pagto: string;
  observacao: string;
  previsao_chegada: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SupplierSearchResult {
  fornecedores: Fornecedor[];
  hasMore: boolean;
  total: number;
}

// Product types for requisition items
export interface Produto {
  codprod: string;
  codunico?: string;
  descr?: string;
  descricao?: string;
  marca?: string; // Código da marca (mantido para compatibilidade)
  codmarca?: string; // Código da marca
  marca_nome?: string; // Nome da marca (ex: "Bosch", "SKF")
  ref?: string;
  aplicacao?: string;
  estoque?: number;
  qtddisponivel?: number;
  prcompra?: number;
  prvenda?: number;
  prmedio?: number;
  primp?: number;
  prfabr?: number;
  multiplo?: number;
  multiploCompra?: number; // Múltiplo específico para compras
  grupoproduto?: string;
  unimed?: string;
  origem?: string;
  estoque_min?: number;
  estoque_max?: number;
  // Campos para edição
  quantidade_inicial?: number;
  preco_inicial?: number;
  observacao_inicial?: string;
  // Campos para rastreio de sugestão
  quantidade_sugerida?: number;
  base_indicacao?: string;
}

export interface RequisitionItem {
  id?: number; // Deprecado - usar codprod como identificador
  req_id: number;
  req_versao: number;
  item_seq: number; // Deprecado
  codprod: string; // Identificador principal do item
  produto?: Produto;
  quantidade: number;
  quantidade_atendida?: number; // Quantidade já atendida/recebida
  quantidade_sugerida?: number; // Quantidade original da sugestão automática
  base_indicacao?: string; // Origem do item (SUGESTAO, MANUAL, etc.)
  preco_unitario: number;
  preco_total: number;
  observacao?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductSearchParams {
  search?: string;
  marca?: string;
  grupoproduto?: string;
  page?: number;
  perPage?: number;
}

export interface ProductSearchResult {
  produtos: Produto[];
  meta: {
    total: number;
    lastPage: number;
    currentPage: number;
    perPage: number;
  };
}

export interface ItemFormData {
  codprod: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
}

export interface CartItem extends RequisitionItem {
  produto: Produto;
  isEditing?: boolean;
  quantidade_sugerida?: number; // Quantidade original da sugestão
  base_indicacao?: string; // Origem do item
}