// Define as colunas que podem ser exibidas na tabela de requisições,
// bem como seus labels. O campo 'campo' deve corresponder a uma chave
// do RequisitionDTO.
// Baseado nas evidências do sistema original da Melo

export const colunasDbRequisicao = [
  // Coluna de seleção (sempre primeira e fixa)
  { campo: 'selecionar', label: 'Selecionar', fixo: true, tipo: 'selecao' },

  // Colunas principais (substituíveis)
  { campo: 'requisicao', label: 'Requisição' },
  { campo: 'dataRequisicao', label: 'Data Requisição' },
  { campo: 'statusRequisicao', label: 'Status Requisição' },
  { campo: 'fornecedorCompleto', label: 'Fornecedor' },
  { campo: 'compradorCompleto', label: 'Comprador' },

  // Ordem de Compra (colunas substituíveis)
  { campo: 'ordemCompra', label: 'Ordem Compra' },
  { campo: 'dataOrdem', label: 'Data O.C.' },
  { campo: 'statusOrdem', label: 'Status O.C.' },
  { campo: 'previsaoChegada', label: 'Prev. Chegada' },

  // Detalhes (colunas substituíveis)
  { campo: 'tipo', label: 'Tipo' },
  { campo: 'versao', label: 'Versão' },
  { campo: 'fornecedorCpfCnpj', label: 'CPF/CNPJ' },
  { campo: 'localEntrega', label: 'Entrega em' },
  { campo: 'destino', label: 'Destinado para' },
  { campo: 'condicoesPagamento', label: 'Cond. Pagamento' },
  { campo: 'observacao', label: 'Observação' },

  // Coluna de ações (sempre última e fixa)
  { campo: 'AÇÕES', label: 'Ações', fixo: true, tipo: 'acao' },
];
