/**
 * Tipos para o módulo de Compras Internacionais (Importação)
 *
 * Baseado no legado Oracle (ENTRADA_IMPORTACAO) e no documento
 * "Compras Internacionais.pdf"
 */

// --- STATUS ---

export type StatusImportacao = 'N' | 'E' | 'C'; // Nova | Entrada gerada | Cancelada

export const STATUS_LABELS: Record<StatusImportacao, string> = {
  N: 'Nova',
  E: 'Entrada Gerada',
  C: 'Cancelada',
};

// --- DECLARAÇÃO DE IMPORTAÇÃO (DI) ---

export interface ImportacaoCabecalho {
  id: number;
  nro_di: string;
  data_di: string;
  status: StatusImportacao;
  tipo_die?: string;

  // Importador
  importador_ie?: string;

  // Procedência
  fornecedor_nome?: string;
  pais_procedencia?: string;
  recinto_aduaneiro?: string;
  peso_liquido?: number;
  qtd_adicoes?: number;

  // Valores financeiros
  taxa_dolar: number;
  total_mercadoria: number; // FOB em USD
  frete: number;
  seguro: number;
  thc: number; // THD / Capatazia
  total_cif: number;

  // Impostos
  pis: number;
  cofins: number;
  ii: number; // Imposto de Importação
  ipi: number;
  icms_st: number;

  // Taxas
  anuencia: number;
  siscomex: number;

  // Câmbio
  contrato_cambio: number; // Valor total contratos (USD)
  taxa_dolar_medio?: number; // Calculado a partir dos contratos

  // Nota de nacionalização: fornecedor principal (destinatário) escolhido à mão.
  // Null → vale a regra (ADICAO_001 = menor adição | MAIOR_FOB).
  fornecedor_principal?: string;
  fornecedor_principal_regra?: 'ADICAO_001' | 'MAIOR_FOB';

  // Despesas
  despachante: number;
  freteorigem_total: number;
  infraero_porto: number;
  carreteiro_eadi: number;
  carreteiro_melo: number;
  eadi: number;

  // Dados complementares
  navio?: string;
  data_entrada_brasil?: string;
  inscricao_suframa?: string;
  forma_pagamento?: string;

  // Nota de nacionalização (grupo DI da NF-e de entrada)
  local_desembaraco?: string;   // xLocDesemb — cidade da filial
  uf_desembaraco?: string;      // UFDesemb — UF da filial
  data_desembaraco?: string;    // dDesemb — do XML (dataDesembaraco)
  via_transporte?: number;      // tpViaTransp (1 Marítima .. 10)
  forma_importacao?: number;    // tpIntermedio (1 própria / 2 c.ordem / 3 encomenda)
  valor_afrmm?: number;         // vAFRMM (Marinha Mercante, só marítimo)
  outros_valores?: number;      // vOutro livre (compõe a nota)
  peso_bruto?: number;          // cargaPesoBruto (kg) — do XML
  especie?: string;             // espécie de volume (nomeEmbalagem) — do XML

  // Metadados
  created_at?: string;
  updated_at?: string;
  codusr?: string;
}

// --- CONTRATOS DE CÂMBIO ---

// Origem da Taxa Dólar de um contrato de câmbio:
//   CAP    = taxa do título no Contas a Pagar (por nº do contrato)
//   XML    = taxa do dólar que veio no XML da DI (TAXA DOLAR EUA)
//   PTAX   = cotação do Banco Central na data da DI (botão buscar)
//   MERCADO= cotação de mercado (AwesomeAPI) — moedas sem PTAX, ex.: CNY
//   MANUAL = digitada pelo usuário
export type OrigemTaxa = 'CAP' | 'XML' | 'PTAX' | 'MERCADO' | 'MANUAL';

export interface ContratoCambio {
  id?: number;
  id_importacao: number;
  data: string;
  taxa_dolar: number;      // taxa da MOEDA do contrato -> BRL (p/ USD = dólar->BRL)
  vl_merc_dolar: number;   // valor NA MOEDA do contrato (nome histórico)
  vl_reais?: number;       // vl_merc_dolar * taxa_dolar (BRL)
  contrato: string;        // Número do contrato
  moeda?: string;          // USD, EUR, CNY, JPY...
  // Conversão para dólar (tudo o motor de custo usa em USD)
  taxa_usd?: number;       // taxa do DÓLAR -> BRL usada p/ converter em USD
  vl_usd?: number;         // valor do contrato convertido para dólar = vl_reais / taxa_usd
  origem_taxa?: OrigemTaxa;   // de onde veio a Taxa Dólar (p/ o usuário saber)
  origem_cambio?: OrigemTaxa; // de onde veio a Taxa Câmbio (moeda->BRL)
  // Vinculação com Contas a Pagar
  id_titulo_pagar?: number;
}

// --- ADIÇÃO DA DI (grupo Fornecedor → Adição → Item) ---

export interface AdicaoImportacao {
  numero_adicao: number;
  fornecedor_nome: string;
  ncm: string;
  vl_fob: number;        // US$
  vl_frete: number;      // US$
  vl_pis_cofins: number; // R$
  vl_icms: number;       // R$
}

// --- FATURAS / PEDIDOS DE COMPRA (dentro da DI) ---

export interface FaturaImportacao {
  id?: number;
  id_importacao: number;
  cod_credor: string; // Código do fornecedor
  fornecedor_nome?: string;
  cod_cliente?: string; // Cliente para NF de nacionalização
  cod_comprador?: string;
  nro_invoice?: string;
  id_ordem_compra?: number; // Pedido de compra vinculado
  codent?: string; // Código da entrada gerada

  itens?: ItemImportacao[];
}

// --- ITENS DA IMPORTAÇÃO ---

export interface ItemImportacao {
  id?: number;
  id_importacao: number;
  id_fatura?: number;
  codprod: string;
  referencia?: string; // dbprod.ref do produto associado (exibição)
  marca?: string;      // dbmarcas.descr do produto associado (exibição)
  num_item?: number;   // nSeqAdic (numItem da DIe) — ordem na adição
  descricao?: string;
  ncm?: string;
  numero_adicao?: number;
  id_orc?: number; // ID da Ordem de Compra

  // Quantidades
  qtd: number;
  unidade?: string;
  peso_liquido?: number;

  // Preços em USD
  proforma_unit: number;
  proforma_total: number;
  invoice_unit: number;
  invoice_total: number;

  // Valores em Reais (calculados)
  real_unit?: number;
  real_total?: number;

  // Rateio de despesas (calculados)
  despesa_perc?: number;
  despesa_total?: number;
  despesa_unit?: number;

  // ICMS rateado (calculados)
  icms_perc?: number;
  icms_total?: number;
  icms_unit?: number;

  // PIS/COFINS (calculados)
  pis_cofins_total?: number;

  // Custo final (calculados)
  custo_unit_real?: number;
  custo_total_real?: number;
  custo_unit_dolar?: number;

  // Taxas usadas no cálculo
  tx_dolar_di?: number;
  tx_dolar_medio?: number;

  // Valores para NF
  nf_unit?: number;
  nf_total?: number;
}

// --- FILTROS DE LISTAGEM ---

export interface FiltrosImportacao {
  busca?: string;
  status?: StatusImportacao | '';
  data_inicio?: string;
  data_fim?: string;
  fornecedor?: string;
}

// --- RESUMO DE CUSTOS ---

export interface ResumoCustos {
  total_mercadoria_usd: number;
  total_cif_usd: number;
  total_cif_brl: number;
  total_impostos_brl: number;
  total_despesas_brl: number;
  total_geral_brl: number;
  taxa_dolar_di: number;
  taxa_dolar_medio: number;
  qtd_itens: number;
  qtd_contratos: number;
}

// --- DADOS PARSEADOS DO XML DA DI ---

export interface DieXmlAdicao {
  numAdicao: number;
  nomeFornecedor: string;
  cdImportador: string;
  nomeImportador: string;
  vlFob: number;
  vlFrete: number;
  vlSeguro: number;
  vlIi: number;
  vlIpi: number;
  vlPisCofins: number;
  vlPesoLiquido: number;
  cdTributacao: string;
  vlBcIcms: number;
  vlIcms: number;
  vlIcmsSI: number;
  itens: DieXmlItem[];
}

export interface DieXmlItem {
  numItem: number;
  numAdicao: number;
  cdNcm: string;
  descricao: string;
  qtd: number;
  unidade: string;
  vlUnitario: number;
  vlTotal: number;
}

export interface DieXmlContrato {
  numero: string;
  valorUsd: number;      // valor NA MOEDA do contrato (nome histórico; p/ USD = USD)
  moeda: string;         // USD, EUR, CNY... (do XML)
  taxaMoeda?: number;    // moeda do contrato -> BRL (TAXA EURO/CNY ou dólar p/ USD)
  vlReais?: number;      // valorUsd * taxaMoeda
  taxaUsd?: number;      // dólar -> BRL (TAXA DOLAR EUA / vlTaxaDolar da DI)
  vlUsd?: number;        // valor convertido para dólar
  origemTaxa?: OrigemTaxa;   // 'XML' quando a taxa do dólar veio do próprio XML
  origemCambio?: OrigemTaxa; // 'XML' quando a taxa da moeda veio do próprio XML
}

export interface DieXmlParsed {
  tipoDIe: string;
  nrDocumento: string;
  dtDocumento: string;
  vlFob: number;
  vlFrete: number;
  vlSeguro: number;
  vlII: number;
  vlIPI: number;
  vlPisCofins: number;
  vlTaxasDiversas: number;
  vlTaxasCapatazia: number;
  vlTaxaDolar: number;
  vlPesoLiquido: number;
  cdRecintoAduaneiro: string;
  cdPaisProcedencia: string;
  qtdeAdicoes: number;
  txInfoCompl: string;
  // Nota de nacionalização (quando disponível no XML da DI)
  pesoBruto?: number;          // cargaPesoBruto (kg)
  dataDesembaraco?: string;    // dataDesembaraco (YYYY-MM-DD)
  viaTransporte?: number;      // tpViaTransp mapeado (1 Marítima / 4 Aérea …) ou undefined
  especie?: string;            // nomeEmbalagem (1º volume)
  // Extraídos do txInfoCompl
  navio?: string;
  dataEntradaBrasil?: string;
  inscricaoSuframa?: string;
  contratos: DieXmlContrato[];
  adicoes: DieXmlAdicao[];
}

// --- VIEWS ---

export type ImportacaoView = 'lista' | 'detalhe';

export type ImportacaoTab = 'geral' | 'contratos' | 'faturas' | 'custos';
