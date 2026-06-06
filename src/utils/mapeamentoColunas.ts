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
  
  // Campos de produto (extras)
  'codmarca': 'Marca',
  'codgpf': 'Grupo Função',
  'codgpp': 'Grupo Produto',
  'curva': 'Curva ABC',
  'qtest': 'Estoque',
  'qtestmin': 'Est. Mínimo',
  'qtestmax': 'Est. Máximo',
  'prvenda': 'Preço Venda',
  'prcompra': 'Preço Compra',
  'prfabr': 'Preço Fábrica',
  'codbar': 'Cód. Barras',
  'pesoliq': 'Peso Líq.',
  'qtembal': 'Qtd. Embalagem',
  'multiplo': 'Múltiplo',
  'trib': 'Tributado',
  'strib': 'Sit. Tributária',
  'clasfiscal': 'Class. Fiscal',
  'ipi': 'IPI',
  'pis': 'PIS',
  'cofins': 'COFINS',
  'reforiginal': 'Ref. Original',
  'inf': 'Informativo',
  'tabelado': 'Tabelado',
  'dolar': 'Moeda Cambial',
  'excluido': 'Excluído',
  'compradireta': 'Compra Direta',
  'qtdreservada': 'Qtd. Reservada',
  'prcustoatual': 'Custo Atual',
  'aplic_extendida': 'Aplicação',
  'preconf': 'Preço NF',
  'precosnf': 'Preço sem NF',
  'prcomprasemst': 'Custo Transf. Líq.',
  'pratualdesp': 'Custo Transf. Bruto',
  'txdolarcompra': 'Taxa Dólar Compra',
  'txdolarvenda': 'Taxa Dólar Venda',
  'txdolarfabrica': 'Taxa Dólar Fábrica',
  'txdolarcompramedio': 'Taxa Dólar Médio',
  'primp': 'Preço Importação',
  'impfat': 'Preço Imp. Fatura',
  'impfab': 'Preço Imp. Fábrica',
  'concor': 'Preço Concorrência',
  'prmedio': 'Preço Médio',
  'qtest_filial': 'Est. Filial',
  'qtestmax_sugerido': 'Est. Máx. Sugerido',
  'cmercd': 'Margem Dentro',
  'cmercf': 'Margem Fora',
  'cmerczf': 'Margem ZF',
  'margem': 'Margem',
  'margempromo': 'Margem Promoção',
  'percsubst': '% Agregado (MVA)',
  'isentopiscofins': 'Isento PIS/COFINS',
  'isentoipi': 'Situação IPI',
  'descontopiscofins': 'Desc. PIS/COFINS',
  'naotemst': 'Não tem ST',
  'prodepe': 'Prodepe',
  'hanan': 'Lei Hanan',
  'ii': 'Imp. Importação',
  'cest': 'CEST',
  'nrodi': 'Nº DI',
  'dtdi': 'Data DI',
  'consumo_interno': 'Consumo Interno',
  'multiplocompra': 'Múltiplo Compra',
  'coddesc': 'Desconto Fábrica',
  'descr_importacao': 'Desc. Importado',
  'comdifeext': 'Comissão Externa',
  'comdifeext_int': 'Comissão Ext. Int.',
  'comdifint': 'Comissão Interna',
  'prcusto': 'Custo Contábil',
  'qtd_armazens': 'Armazéns',

  // Campos de cliente
  'codcli': 'Código',
  'nome': 'Nome',
  'nomefant': 'Nome Fantasia',
  'cpfcgc': 'CPF/CNPJ',
  'codcc': 'Classe',
  'claspgto': 'Classe Pgto',
  'limite': 'Limite Crédito',
  'debito': 'Débito',
  'iest': 'Inscrição Estadual',
  'imun': 'Inscrição Municipal',
  'isuframa': 'Suframa',
  'tipoemp': 'Tipo Empresa',
  'tipocliente': 'Tipo Cliente',
  'sit_tributaria': 'Sit. Tributária',
  'email': 'E-mail',
  'contato': 'Contato',
  'contatos': 'Contatos',
  'atraso': 'Dias Atraso',
  'kickback': 'Kickback',
  'icms': 'ICMS',
  'banco': 'Banco',
  'faixafin': 'Faixa Financeira',
  'acrescimo': 'Acréscimo',
  'codigo_filial': 'Filial',
  'codpais': 'País',
  'codmunicipio': 'Município',
  'codbairro': 'Cód. Bairro',
  'datacad': 'Data Cadastro',
  'data_cad': 'Data Cadastro',
  'referencia': 'Referência',
  'prvenda_cli': 'Preço Venda',
  'bloquear_preco': 'Bloq. Preço',
  'local_entrega': 'Local Entrega',
  'codvend': 'Vendedor',
  'codtmk': 'Vendedor TMK',
  'socios': 'Sócios',
  'habilitasuframa': 'Habilita Suframa',
  'emailnfe': 'Email NF-e',
  'endercobr': 'End. Cobrança',
  'cidadecobr': 'Cidade Cobrança',
  'bairrocobr': 'Bairro Cobrança',
  'ufcobr': 'UF Cobrança',
  'cepcobr': 'CEP Cobrança',
  'numerocobr': 'Número Cobrança',
  'complementocobr': 'Compl. Cobrança',
  'referenciacobr': 'Ref. Cobrança',
  'codpaiscobr': 'País Cobrança',
  'codmunicipiocobr': 'Munic. Cobrança',
  'codbairrocobr': 'Bairro Cobrança',

  // Campos de fornecedor
  'cod_credor': 'Código',
  'nome_fant': 'Nome Fantasia',
  'cpf_cgc': 'CPF/CNPJ',
  'codcf': 'Classe Fornecedor',
  'tipofornecedor': 'Tipo Fornecedor',
  'regime_tributacao': 'Regime Tributário',
  'fabricante': 'Fabricante',

  // Campos de fornecedor extras
  'fone1': 'Telefone 1',
  'fone2': 'Telefone 2',
  'codccontabil': 'Conta Contábil',

  // Campos de transportadora
  'codtransp': 'Código',
  'cc': 'C/C',
  'n_agencia': 'Agência',
  'cod_ident': 'Cód. Identificação',
  'codunico': 'Cód. Único',
  'frete_minimo': 'Frete Mínimo',
  'seguro_ad_valor': 'Seguro Ad Valor',
  'pedagio': 'Pedágio',
  'gris': 'GRIS',
  'ademe': 'ADEME',
  'despacho': 'Despacho',
  'taxa_portuario': 'Taxa Portuário',
  'aliquota_icms': 'Alíquota ICMS',
  'peso_minimo': 'Peso Mínimo',
  'taxa_coleta_sp': 'Taxa Coleta SP',
  'taxa_entrega': 'Taxa Entrega',

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
