export interface EntradaDTO {
  id: string;
  numeroNF: string;
  numeroEntrada?: string;
  serie: string;
  fornecedor?: string;
  fornecedorNome: string;
  dataEmissao: string;
  dataEntrada: string;
  valorTotal: number;
  valorProdutos?: number;
  status: string;
  chaveNFe?: string;
  tipoEntrada: string;
  observacoes?: string;
  comprador?: string;
  totalItens?: number;
  nfeId?: number;
  temRomaneio?: boolean;
  precoConfirmado?: boolean;
}

export interface ItemEntrada {
  id: string;
  entradaId: string;
  referencia: string;
  descricao: string;
  codBarras: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  situacao: string;
}

export interface NovaEntradaData {
  numeroNF: string;
  serie: string;
  fornecedor: string;
  dataEmissao: string;
  dataEntrada: string;
  valorProdutos: number;
  valorTotal: number;
  tipoEntrada: 'MANUAL' | 'XML';
  observacoes?: string;
}

export interface EditEntradaData {
  dataEntrada: string;
  valorTotal: number;
  valorProdutos: number;
  observacoes?: string;
}

export interface FiltroColuna {
  campo: string;
  tipo: string;
  valor: string;
}

export interface EntradasFilters {
  search?: string;
  status?: string;
  tipoEntrada?: string;
  dataInicio?: string;
  dataFim?: string;
  filtrosColuna?: FiltroColuna[];
}

export interface EntradasTableState {
  page: number;
  perPage: number;
  search: string;
  filters: EntradasFilters;
  selectedItems: Set<string>;
}

export interface EntradasMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  lastPage: number;
}