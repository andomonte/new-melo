// Tipos para o módulo de Remessa

// Registro DDA
export interface DDARecord {
  seq: number;
  cedente: string;
  cnpj: string;
  dtEmissao: string;
  dtVenc: string;
  dtLimite: string;
  valorPgto: number;
  valorJuros: number;
  nroDoc: string;
  codEspecie: string;
  especie: string;
  codProtesto: string;
  tipoProtesto: string;
  diasJuros: string;
  cadastrado: string;
  tipoCedente: string;
}

// Informação do Cedente
export interface CedenteInfo {
  cedente: string;
  cnpj: string;
  cadastrado: string;
  tipo: string;
  titulos: DDARecord[];
}

// Estatísticas por filial
export interface EstatisticasPorFilial {
  mao: number;
  pvh: number;
  rec: number;
  flz: number;
  bmo: number;
  csac: number;
  jps: number;
}

// Estatísticas do retorno
export interface EstatisticasRetorno {
  totalProcessados: number;
  liquidados: number;
  baixados: number;
  rejeitados: number;
  outros: number;
  porFilial: EstatisticasPorFilial;
}

// Título para baixa automática
export interface TituloAutomatico {
  nossoNumero: string;
  numeroDocumento: string;
  nomeSacado: string;
  valorPago: number;
  dataOcorrencia: string;
  codigoOcorrencia?: string;
  ocorrencia: string;
}

// Título para baixa manual
export interface TituloManual {
  nossoNumero: string;
  numeroDocumento: string;
  nomeSacado: string;
  valorTitulo?: number;
  valorPago: number;
  jurosMulta?: number;
  desconto?: number;
  dataVencimento?: string;
  dataOcorrencia: string;
  codigoOcorrencia?: string;
  ocorrencia: string;
  motivo: string;
  motivoOcorrencia?: string;
}

// Dados do arquivo DDA/Retorno processado
export interface DadosDDA {
  totalRegistros: number;
  cedentesCadastrados: number;
  cedentesNaoCadastrados: number;
  cedentes?: CedenteInfo[];
  registros?: DDARecord[];
  codretorno?: number;
  banco?: string;
  nomeArquivo?: string;
  estatisticas?: EstatisticasRetorno;
  titulosAutomaticos?: TituloAutomatico[];
  titulosManuais?: TituloManual[];
}

// Histórico de remessa
export interface HistoricoRemessa {
  id: number;
  banco: string;
  cod_bodero?: string;
  data_envio: string;
  registros_enviados: number;
  titulos_liquidados?: number;
  titulos_pendentes?: number;
  valor_total: string;
  status: string;
  nome_arquivo?: string;
}

// Estatísticas de período
export interface EstatisticasPeriodo {
  remessas: number;
  titulos: number;
  valor: number;
}

// Estatísticas gerais
export interface Estatisticas {
  periodo: {
    hoje: EstatisticasPeriodo;
    semana: EstatisticasPeriodo;
    mes: EstatisticasPeriodo;
  };
}

// Arquivo detalhado
export interface ArquivoDetalhado {
  cod_arquivo: number;
  nome_banco: string;
  nome_arquivo: string;
  dt_geracao: string;
  qtd_registros: number;
  valor_total: string;
  cod_bodero?: string;
  sequencial_arquivo?: number;
}

// Título detalhado
export interface TituloDetalhado {
  cod_remessa_detalhe: number;
  cod_receb: number;
  nosso_numero: string;
  nome_cliente: string;
  cpf_cnpj: string;
  dt_vencimento: string;
  valor_titulo: string;
  status_titulo: string;
  data_retorno?: string;
  ocorrencia_retorno?: string;
}

// Tipo de tela
export type TipoTela = 'selecao' | 'remessa' | 'importacao';

// Tipo de subtela de remessa
export type SubtelaRemessa = 'menu' | 'gerar' | 'consultar';

// Tipo de banco selecionado
export type BancoSelecionado = 'TODOS' | 'BRADESCO' | 'SANTANDER';

// Modo de envio
export type ModoEnvio = 'download' | 'email';

// Aba ativa
export type AbaAtiva = 'gerar' | 'importar' | 'historico';
