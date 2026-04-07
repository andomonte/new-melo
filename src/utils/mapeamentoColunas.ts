// Mapeamento de nomes técnicos para nomes amigáveis
export const NOMES_COLUNAS_AMIGAVEIS: Record<string, string> = {
  // Campos de fatura
  'codfat': 'Código da Fatura',
  'nroform': 'Número NF',
  'cliente_nome': 'Cliente',
  'totalnf': 'Valor Total',
  'data': 'Data',
  'codvend': 'Código Vendedor',
  'codtransp': 'Código Transportadora',
  'cancel': 'Cancelada',
  'cobranca': 'Cobrança',
  'nfs': 'Status NF-e',
  'grupo_pagamento': 'Grupo de Pagamento',
  
  // Campos de venda
  'codvenda': 'Código da Venda',
  'nrovenda': 'Número da Venda',
  'tipo': 'Tipo',
  'obs': 'Observações',
  'total': 'Total',
  'codcli': 'Código Cliente',
  'uf': 'UF',
  'cep': 'CEP',
  'cidade': 'Cidade',
  'bairro': 'Bairro',
  'ender': 'Endereço',
  'numero': 'Número',
  'complemento': 'Complemento',
  'transp': 'Transportadora',
  'cliente': 'Cliente',
  
  // Campos de produto
  'codprod': 'Código',
  'descr': 'Descrição',
  'descricao': 'Descrição',
  'qtd': 'Quantidade',
  'prunit': 'Preço Unitário',
  'total_item': 'Total do Item',
  'ref': 'Referência',
  'demanda': 'Demanda',
  'origemcom': 'Origem Comercial',
  'codoperador': 'Operador',
  'preco_medio': 'Preço Médio',
  'unimed': 'Unidade',
  'desconto': 'Desconto',
  
  // Campos gerais
  'selecionar': 'Selecionar',
  'acoes': 'Ações',
  'status': 'Status',
  'id': 'ID',
  'ID': 'Código de Pagamento',
  'eh_internacional': 'Internacional',
  'moeda': 'Moeda',
  'taxa_conversao': 'Taxa de Conversão',
  'valor_moeda': 'Valor em Moeda',
  'nro_invoice': 'Número Invoice',
  'nro_contrato': 'Número Contrato',
  'xml_nf': 'XML NF',
  // 'possui_entrada': 'Possui Entrada',
  'created_at': 'Criado em',
  'updated_at': 'Atualizado em'
};

// Função para obter nome amigável de uma coluna
export function obterNomeAmigavel(nomeColuna: string): string {
  return NOMES_COLUNAS_AMIGAVEIS[nomeColuna] || nomeColuna;
}

// Função para converter array de colunas técnicas para amigáveis
export function converterColunasParaAmigaveis(colunas: string[]): string[] {
  return colunas.map(coluna => obterNomeAmigavel(coluna));
}

// Função para obter nome técnico a partir do nome amigável
export function obterNomeTecnico(nomeAmigavel: string): string {
  const entrada = Object.entries(NOMES_COLUNAS_AMIGAVEIS).find(
    ([tecnico, amigavel]) => amigavel === nomeAmigavel
  );
  return entrada ? entrada[0] : nomeAmigavel;
}

// Função para converter filtros com nomes amigáveis para técnicos
export function converterFiltrosParaTecnicos(filtros: any[]): any[] {
  return filtros.map(filtro => ({
    ...filtro,
    campo: obterNomeTecnico(filtro.campo)
  }));
}

// Função para converter filtros técnicos para amigáveis (para exibição)
export function converterFiltrosParaAmigaveis(filtros: any[]): any[] {
  return filtros.map(filtro => ({
    ...filtro,
    campo: obterNomeAmigavel(filtro.campo)
  }));
}
