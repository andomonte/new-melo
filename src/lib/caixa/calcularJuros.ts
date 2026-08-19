/**
 * Cálculo de juros do Caixa — porte fiel de GERAL.CAIXA.CALULAR_JUROS
 * (+ diasAtraso de CONTASR.DADOS_RECEBIMENTO) do Oracle MELO.
 *
 * Fórmula (juros simples pró-rata dia):
 *   juros = (taxa / 3000) * (principal_pendente + juros_aberto) * dias_atraso  [+ juros_aberto]
 *
 * Onde taxa = dbCalc.TXCART (% ao mês; /3000 = ÷100 ÷30 → taxa diária).
 * Validado contra o Oracle desenv (6/6 títulos exatos) em 2026-08-18.
 *
 * NÃO grava nada — só calcula. É a Fase 0 do motor de recebimento do Caixa.
 */

export interface TituloJurosInput {
  /** dbreceb.valor_pgto — valor total do título */
  valorPgto: number;
  /** dbreceb.valor_rec — valor já recebido */
  valorRec: number;
  /** dbreceb.dt_venc — vencimento (Date ou ISO 'YYYY-MM-DD') */
  dtVenc: string | Date;
  /** dbreceb.dt_pgto — data do último pagamento parcial (opcional) */
  dtPgto?: string | Date | null;
  /** dbreceb.forma_fat — '2' gera tarifa de R$ 7,00 */
  formaFat?: string | null;
  /** JUROS_RECEBIDO: soma dbfreceb tipo 18/20/21/22/23/25/26, sf<>'C' (bruto). Default 0. */
  jurosPago?: number;
  /** JUROS_ABERTO: FIN_RECEB_CONTROLE_JUROS (rcj_juros - rcj_juros_recebido, >=0). Default 0. */
  jurosAberto?: number;
  /** getJUROS_LIBERADO: taxa liberada em FIN_LIBERA_JUROS (lij_utilizada=0); -1 se não houver. Default -1. */
  jurosLiberado?: number;
  /** Venda à vista faturada nas últimas 24h (dbfatura.data >= sysdate-1). Default false. */
  vendaAVista?: boolean;
}

export interface JurosResultado {
  diasAtraso: number;
  taxa: number;
  principalPendente: number;
  juros: number;
  tarifa: number;
  /** valor total a receber = valor_pgto - (valor_rec - jurosPago) + juros */
  valorReceber: number;
}

/**
 * Feriados nacionais (DBFERIADO, TIPO='N') — porte de VERIFICA_DATA_FERIADO:
 *   fixos  = casam DIA/MÊS em qualquer ano (FIXO='S') → chaves 'MM-DD'
 *   moveis = casam a DATA exata (FIXO='N', ex. Carnaval/Páscoa) → chaves 'YYYY-MM-DD'
 */
export interface Feriados {
  fixos: Set<string>;
  moveis: Set<string>;
}

const SEM_FERIADOS: Feriados = { fixos: new Set(), moveis: new Set() };

/** Replica VERIFICA_DATA_FERIADO(data) > 0 — true se a data é feriado nacional. */
export function ehFeriado(d: Date, feriados: Feriados): boolean {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return feriados.fixos.has(`${mm}-${dd}`) || feriados.moveis.has(d.toISOString().slice(0, 10));
}

/** Meia-noite UTC de uma data (Date ou 'YYYY-MM-DD'), ignorando fuso. */
function toUTCDate(d: string | Date): Date {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  // ISO 'YYYY-MM-DD' (ou com hora) — pega só a parte da data
  const m = String(d).slice(0, 10).split('-');
  return new Date(Date.UTC(Number(m[0]), Number(m[1]) - 1, Number(m[2])));
}

/** Diferença em dias inteiros (a - b), como o Oracle DATE - DATE. */
function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** round(x, 2) — arredondamento comercial de 2 casas (igual ROUND do Oracle). */
function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Próximo dia útil ESTRITAMENTE após `data` — porte de FLUXOCXX3.RETORNA_DIA_ATRASO(data, 0, 0):
 * pula sábados, domingos e feriados nacionais. Usado na carência: o juros só vale
 * se dataPgto >= este dia.
 */
export function proximoDiaUtil(data: Date, feriados: Feriados = SEM_FERIADOS): Date {
  // Espelha a recursão do Oracle: se a data cai em fds/feriado avança sem contar;
  // senão avança 1 e retorna (vAtrasoPadrao=0).
  let d = new Date(data.getTime());
  const isFolga = (x: Date) => {
    const dow = x.getUTCDay(); // 0=dom, 6=sáb
    return dow === 0 || dow === 6 || ehFeriado(x, feriados);
  };
  // Enquanto a própria data for folga, avança (não conta).
  while (isFolga(d)) {
    d = new Date(d.getTime() + 86400000);
  }
  // Dia útil: avança 1 (primeiro dia útil após o vencimento).
  d = new Date(d.getTime() + 86400000);
  return d;
}

/**
 * Calcula juros/tarifa/valor a receber de um título numa data de pagamento.
 * @param t       dados do título (+ agregados de juros)
 * @param dataPgto data de recebimento (a "data diferenciada" do Delphi)
 * @param txcart  taxa base de dbCalc.TXCART (% ao mês)
 * @param feriados conjunto opcional de feriados 'YYYY-MM-DD' para a carência
 */
export function calcularJurosCaixa(
  t: TituloJurosInput,
  dataPgto: string | Date,
  txcart: number,
  feriados: Feriados = SEM_FERIADOS,
): JurosResultado {
  const venc = toUTCDate(t.dtVenc);
  const pgto = t.dtPgto ? toUTCDate(t.dtPgto) : null;
  const dpg = toUTCDate(dataPgto);

  // Base do atraso = max(dt_venc, dt_pgto) (CONTASR.DADOS_RECEBIMENTO)
  const base = pgto && venc.getTime() >= pgto.getTime() ? venc : (pgto ?? venc);

  // diasAtraso: só conta se passou do vencimento E passou da carência (próx. dia útil)
  const carencia = proximoDiaUtil(venc, feriados);
  let diasAtraso = 0;
  if (dpg.getTime() > venc.getTime() && dpg.getTime() >= carencia.getTime()) {
    diasAtraso = Math.max(0, diffDias(dpg, base));
  }

  // Juros pago só conta se já houve recebimento (CALULAR_JUROS: se valor_rec=0 → jurosPago=0)
  const jurosPagoRaw = t.jurosPago ?? 0;
  const jurosPagoEff = t.valorRec === 0 ? 0 : jurosPagoRaw;
  const jurosAberto = Math.max(0, t.jurosAberto ?? 0);

  // Principal pendente
  const principalRecebido = Math.max(0, t.valorRec - jurosPagoEff);
  const principalPendente = Math.max(0, t.valorPgto - principalRecebido);

  // Taxa (liberação de juros sobrepõe a padrão)
  const jurosLiberado = t.jurosLiberado ?? -1;
  const taxa = jurosLiberado !== -1 ? jurosLiberado : txcart;

  // Fórmula
  let juros = round2((taxa / 3000) * (principalPendente + jurosAberto) * diasAtraso);

  // Exceção: venda à vista (<24h) com atraso <= 1 dia → sem juros
  if (t.vendaAVista && diasAtraso <= 1) juros = 0;
  if (juros < 0) juros = 0;
  juros = round2(juros + jurosAberto);

  const tarifa = t.formaFat === '2' ? 7 : 0;
  const valorReceber = round2(t.valorPgto - (t.valorRec - jurosPagoRaw) + juros);

  return { diasAtraso, taxa, principalPendente: round2(principalPendente), juros, tarifa, valorReceber };
}
