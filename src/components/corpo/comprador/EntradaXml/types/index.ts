export interface NFeDTO {
  id: string;
  numeroNF: string;
  serie: string;
  chaveNFe: string;
  versao?: string;
  cuf?: number;
  protocolo?: string;
  naturezaOperacao?: string;
  finalidadeNFe?: number;
  
  // Emitente
  emitente: string;
  cnpjEmitente: string;
  emitenteIE?: string;
  emitenteLogradouro?: string;
  emitenteNumero?: string;
  emitenteBairro?: string;
  emitenteMunicipio?: string;
  emitenteUf?: string;
  emitenteCep?: string;
  
  // Transportadora
  transportadora?: string;
  cnpjTransportadora?: string;
  transportadoraIE?: string;
  transportadoraEndereco?: string;
  transportadoraMunicipio?: string;
  transportadoraUf?: string;
  transportadoraPlaca?: string;
  modalidadeFrete?: number;
  
  // Datas
  dataEmissao: string;
  dataUpload: string;
  
  // Valores básicos - seguindo sistema legado
  valorTotal: number;
  valorProdutos?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorDesconto?: number;
  valorIPI?: number;
  valorPIS?: number;
  valorCOFINS?: number;
  valorOutros?: number;
  
  // Impostos detalhados
  valorICMS?: number;
  valorBaseICMS?: number;
  valorICMSST?: number;
  valorBaseICMSST?: number;
  valorII?: number;
  
  // Pesos e volumes
  pesoLiquido?: number;
  pesoBruto?: number;
  quantidadeVolumes?: number;
  
  // Status e outros
  status: 'RECEBIDA' | 'PROCESSADA' | 'EM_PROCESSAMENTO' | 'EM_ANDAMENTO' | 'ASSOCIACAO_CONCLUIDA' | 'ERRO';
  itens?: ItemNFeDTO[];

  // Controle de processamento por usuario
  processandoPor?: string | null;
  processandoNome?: string | null;
  processandoDesde?: string | null;

  // Pagamento configurado
  pagamentoConfigurado?: boolean;
  
  // Compatibilidade com código existente
  dadosEmitente?: {
    razaoSocial: string;
    cnpj: string;
    ie: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
  dadosDestinatario?: {
    razaoSocial: string;
    cnpj: string;
    ie: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };
}

export interface ItemNFeDTO {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ncm?: string;
  cfop?: string;
  unidade?: string;
}

export interface ProcessNFeData {
  selectedItems: string[];
  userId: string;
}

export interface UploadXmlData {
  files: File[];
}

export interface NFesMeta {
  total: number;
  page: number;
  lastPage: number;
  perPage: number;
  currentPage: number; // Requerido para compatibilidade com componentes Meta
}