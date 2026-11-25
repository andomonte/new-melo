/**
 * Relatórios (Delphi → web) — contrato de cada relatório.
 * Cada relatório é um módulo de servidor (src/lib/relatorios/gerenciais/<slug>.ts) que exporta
 * `relatorio: Relatorio`. A tela (RelatorioPadrao) pede a definição por API (sem o SQL) e
 * manda os filtros para executar. SQL sempre PARAMETRIZADO — nada de montar WHERE no front
 * como o Delphi fazia (procedure FILTRO / vFiltro).
 */

/** Erro de filtro/regra que vai para a tela como mensagem (HTTP 400). */
export class RelatorioValidacaoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'RelatorioValidacaoError'; }
}

export interface Consultavel {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export type TipoFiltro =
  | 'periodo'     // gera p.de e p.ate (AAAA-MM-DD)
  | 'data'        // uma data (AAAA-MM-DD)
  | 'mes'         // AAAA-MM
  | 'lookup'      // código de cadastro (ver TipoLookup); com `multiplo`, array de códigos
  | 'select'      // opções fixas
  | 'texto'
  | 'numero'
  | 'checkbox';   // boolean

export type TipoLookup = 'vendedor' | 'marca' | 'grupo' | 'cliente' | 'fornecedor' | 'comprador' | 'produto' | 'segmento' | 'grupofunc';

export interface FiltroDef {
  campo: string;
  rotulo: string;
  tipo: TipoFiltro;
  lookup?: TipoLookup;
  multiplo?: boolean;
  obrigatorio?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  /** valor inicial; para período use { de: 'inicio_mes' | 'hoje' | 'AAAA-MM-DD', ate: ... } */
  padrao?: any;
  ajuda?: string;
  /** largura no grid de filtros (1–4 colunas) */
  largura?: 1 | 2 | 3 | 4;
}

export type TipoColuna = 'texto' | 'moeda' | 'numero' | 'inteiro' | 'data' | 'percentual';

export interface ColunaDef {
  campo: string;
  titulo: string;
  tipo?: TipoColuna;
  /** soma na linha de total (e nos subtotais da quebra) */
  total?: boolean;
  largura?: number;   // px (opcional)
}

export interface ResultadoRelatorio {
  linhas: Record<string, any>[];
  /** colunas próprias deste resultado (ex.: modo do relatório muda as colunas) */
  colunas?: ColunaDef[];
  /** campo para agrupar com subtotal (sobrepõe o da definição) */
  quebra?: string | null;
  avisos?: string[];
  /** linhas de resumo mostradas acima da grade e nas exportações (ex.: % por curva) */
  resumo?: string[];
  /** totais calculados no servidor (sobrepõem a soma da tela), ex.: percentuais */
  totais?: Record<string, number | string>;
}

export interface Relatorio {
  slug: string;
  titulo: string;
  /** o que o relatório mostra e de onde vêm os dados (aparece na tela) */
  descricao?: string;
  filtros: FiltroDef[];
  colunas: ColunaDef[];
  quebra?: string;
  /** orientação do PDF */
  paisagem?: boolean;
  /** quando preenchido, o relatório fica no menu mas não roda (ex.: tabela que não existe no PG) */
  pendente?: string;
  executar?: (db: Consultavel, p: Record<string, any>) => Promise<ResultadoRelatorio>;
}

/** Definição sem a função (o que vai para a tela). */
export type DefinicaoRelatorio = Omit<Relatorio, 'executar'>;
