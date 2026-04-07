// Define as colunas que podem ser exibidas na tabela de NFes,
// bem como seus labels. O campo 'campo' deve corresponder a uma chave
// do NFeDTO.

export const colunasDbNFe = [
  // Colunas principais (substituíveis)
  { campo: 'numeroNF', label: 'Número NFe' },
  { campo: 'serie', label: 'Série' },
  { campo: 'chaveNFe', label: 'Chave NFe' },
  { campo: 'emitente', label: 'Emitente' },
  { campo: 'dataEmissao', label: 'Data Emissão' },
  { campo: 'valorTotal', label: 'Valor Total' },
  { campo: 'status', label: 'Status' },
  { campo: 'dataUpload', label: 'Data Upload' },

  // Colunas secundárias (substituíveis)
  { campo: 'fornecedorCnpj', label: 'CNPJ Fornecedor' },
  { campo: 'natOperacao', label: 'Natureza Operação' },
  { campo: 'modelo', label: 'Modelo' },
  { campo: 'versao', label: 'Versão' },
  { campo: 'protocolo', label: 'Protocolo' },
  { campo: 'totalProdutos', label: 'Total Produtos' },
  { campo: 'totalIcms', label: 'Total ICMS' },
  { campo: 'totalIpi', label: 'Total IPI' },
  { campo: 'pesoLiquido', label: 'Peso Líquido' },
  { campo: 'pesoBruto', label: 'Peso Bruto' },
  { campo: 'tipoFrete', label: 'Tipo Frete' },

  // Coluna de ações (sempre última e fixa)
  { campo: 'acoes', label: 'Ações', fixo: true, tipo: 'acao' },
];