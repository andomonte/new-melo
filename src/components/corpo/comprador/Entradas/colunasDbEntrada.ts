/**
 * Define as colunas que podem ser exibidas na tabela de Entradas,
 * bem como seus labels. O campo 'campo' deve corresponder a uma chave
 * do EntradaDTO.
 */

export interface ColunaEntrada {
  campo: string;
  label: string;
  fixo?: boolean;
  tipo?: 'acao' | 'selecao' | 'status' | 'moeda' | 'data';
}

export const colunasDbEntrada: ColunaEntrada[] = [
  // Coluna de acoes (sempre primeira e fixa)
  { campo: 'acoes', label: 'Ações', fixo: true, tipo: 'acao' },

  // Colunas principais (substituiveis)
  { campo: 'numeroEntrada', label: 'Entrada' },
  { campo: 'numeroNF', label: 'Número NF' },
  { campo: 'status', label: 'Status', tipo: 'status' },
  { campo: 'temRomaneio', label: 'Romaneio', tipo: 'status' },
  { campo: 'precoConfirmado', label: 'Preço Confirmado', tipo: 'status' },
  { campo: 'valorProdutos', label: 'Valor Produtos', tipo: 'moeda' },
  { campo: 'valorTotal', label: 'Valor Total', tipo: 'moeda' },
  { campo: 'fornecedorNome', label: 'Fornecedor' },
  { campo: 'dataEmissao', label: 'Data Emissão', tipo: 'data' },
  { campo: 'dataEntrada', label: 'Data Entrada', tipo: 'data' },
  { campo: 'serie', label: 'Série' },

  // Colunas secundarias (substituiveis)
  { campo: 'tipoEntrada', label: 'Tipo Entrada' },
  { campo: 'chaveNFe', label: 'Chave NFe' },
  { campo: 'comprador', label: 'Comprador' },
  { campo: 'totalItens', label: 'Qtd Itens' },
  { campo: 'observacoes', label: 'Observações' },
];

// Colunas visiveis por padrao (limite inicial de 9)
export const colunasIniciaisEntrada = [
  'acoes',
  'numeroEntrada',
  'numeroNF',
  'temRomaneio',
  'precoConfirmado',
  'valorProdutos',
  'fornecedorNome',
  'dataEmissao',
  'status',
];

// Mapeamento de status para labels e cores (estilo NFeMain)
export const statusEntradaConfig: Record<string, { label: string; color: string }> = {
  P: {
    label: 'Pendente',
    color: 'text-yellow-700 bg-yellow-100',
  },
  PENDENTE: {
    label: 'Pendente',
    color: 'text-yellow-700 bg-yellow-100',
  },
  A: {
    label: 'Disponível',
    color: 'text-green-700 bg-green-100',
  },
  DISPONIVEL_VENDA: {
    label: 'Disponível',
    color: 'text-green-700 bg-green-100',
  },
  C: {
    label: 'Cancelada',
    color: 'text-red-600 bg-red-50',
  },
  CANCELADA: {
    label: 'Cancelada',
    color: 'text-red-600 bg-red-50',
  },
  F: {
    label: 'Finalizada',
    color: 'text-blue-600 bg-blue-50',
  },
  FINALIZADA: {
    label: 'Finalizada',
    color: 'text-blue-600 bg-blue-50',
  },
  R: {
    label: 'Recebida',
    color: 'text-emerald-700 bg-emerald-100',
  },
  RECEBIDA: {
    label: 'Recebida',
    color: 'text-emerald-700 bg-emerald-100',
  },
  CRIADA: {
    label: 'Criada',
    color: 'text-gray-600 bg-gray-50',
  },
  EM_ANDAMENTO: {
    label: 'Em Andamento',
    color: 'text-purple-600 bg-purple-50',
  },
};

// Mapeamento de tipo de entrada
export const tipoEntradaConfig: Record<string, { label: string; color: string }> = {
  ENTRADA_NFE: {
    label: 'ENTRADA_NFE',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  MANUAL: {
    label: 'MANUAL',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  XML: {
    label: 'XML',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
};
