// Define as colunas que podem ser exibidas na tabela de NFes,
// bem como seus labels. O campo 'campo' deve corresponder a uma chave
// do NFeDTO.
//
// A ORDEM segue o grid dxDBGNFes do Delphi (Formularios/XML ENTRADA/
// UniExecEntrada.dfm) — o comentário ao lado de cada linha traz a legenda
// original de lá. As colunas que o Delphi não tem ficam agrupadas no começo:
// Status (no Delphi é a COR da linha, não uma coluna) e Nº Entrada.
//
// Todas elas são oferecidas ao DataTablePadrao; quais ficam visíveis, em que
// ordem e com que largura é preferência do usuário, salva por tela no servidor.

export const colunasDbNFe = [
  // Sem equivalente como coluna no Delphi
  { campo: 'status', label: 'Status' },
  { campo: 'codent', label: 'Nº Entrada' },

  // A partir daqui, a mesma sequência do Delphi
  { campo: 'numeroNF', label: 'Número NFe' },            // Doc. Fiscal
  { campo: 'serie', label: 'Série' },                    // Série
  { campo: 'dataEmissao', label: 'Data Emissão' },       // Dt Emissão
  { campo: 'fornecedorCnpj', label: 'CNPJ Emitente' },   // Emit. CPF/CNPJ
  { campo: 'emitente', label: 'Emitente' },              // Emit. Nome
  { campo: 'versao', label: 'Versão' },                  // Versão
  { campo: 'chaveNFe', label: 'Chave NFe' },             // Chave
  { campo: 'protocolo', label: 'Protocolo' },            // Protocolo
  { campo: 'natOperacao', label: 'Natureza Operação' },  // Natureza Oper.
  { campo: 'modelo', label: 'Modelo' },                  // Modelo
  { campo: 'tipoFrete', label: 'Tipo Frete' },           // Mod. Frete
  { campo: 'pesoLiquido', label: 'Peso Líquido' },       // Peso L.
  { campo: 'pesoBruto', label: 'Peso Bruto' },           // Peso B.
  { campo: 'totalIcms', label: 'Total ICMS' },           // ICMS Total
  { campo: 'totalProdutos', label: 'Total Produtos' },   // Total Prod
  { campo: 'totalIpi', label: 'Total IPI' },             // Total IPI
  { campo: 'valorTotal', label: 'Valor Total' },         // Total NF

  // Sem equivalente no Delphi
  { campo: 'dataUpload', label: 'Data Upload' },

  // Coluna de ações (sempre primeira na grade e fixa)
  { campo: 'acoes', label: 'Ações', fixo: true, tipo: 'acao' },
];
