// Define as colunas que podem ser exibidas na tabela de ordens de compra,
// seguindo o mesmo padrão da tabela de requisições

export const colunasDbOrdem = [
  // Colunas principais (substituíveis) - sem coluna de seleção
  { campo: 'ordem', label: 'Ordem' },
  { campo: 'requisicao', label: 'Requisição' },
  { campo: 'dataOrdem', label: 'Data Ordem' },
  { campo: 'statusOrdem', label: 'Status Ordem' },
  { campo: 'orc_pagamento_configurado', label: 'Pagamento Configurado' },
  { campo: 'fornecedor_completo', label: 'Fornecedor' },
  { campo: 'comprador_completo', label: 'Comprador' },

  // Coluna movida para seção de detalhes adicionais (substituível)
  { campo: 'statusRequisicao', label: 'Status Requisição' },

  // Novas colunas importantes para PDF e gestão
  { campo: 'previsaoChegada', label: 'Previsão Chegada' },
  { campo: 'localEntrega', label: 'Local Entrega' },
  { campo: 'localDestino', label: 'Local Destino' },
  { campo: 'prazoEntrega', label: 'Prazo Entrega' },
  { campo: 'fornecedorCod', label: 'Cód. Fornecedor' },
  { campo: 'dataFinalizacao', label: 'Data Finalização' },
  { campo: 'usuarioResponsavel', label: 'Responsável' },

  // Detalhes adicionais (colunas substituíveis) - apenas campos que existem na API
  { campo: 'valorTotal', label: 'Valor Total' },
  { campo: 'observacao', label: 'Observação' },

  // Coluna de ações (sempre última e fixa)
  { campo: 'AÇÕES', label: 'Ações', fixo: true, tipo: 'acao' },
];