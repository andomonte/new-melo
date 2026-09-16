// src/lib/fluxo-caixa/diaFluxo.ts
//
// Porte fiel das funções de "data de fluxo" do pacote Oracle GERAL.FLUXOCXX3
// (MELO — Fluxo de Caixa). Ajusta o vencimento para o dia em que o dinheiro
// efetivamente entra/sai do caixa, considerando fins de semana e feriados
// (tabela dbferiado).
//
// Regras (verbatim do PL/SQL):
//   RETORNA_DIA_FLUXO      (recebimentos/entradas): rola p/ dia útil e SOMA +1
//                          dia (o crédito compensa no dia útil seguinte).
//   RETORNA_DIA_FLUXO_PGTO (pagamentos/saídas):     paga no próprio vencimento,
//                          apenas empurrando fim de semana/feriado p/ frente.
//   VERIFICA_DATA_FERIADO: feriado se (fixo='S' e tipo='N' e dia+mês batem) OU
//                          (fixo='N' e tipo='N' e data exata bate).
//
// Oracle TO_CHAR(data,'D'): 1=Domingo ... 7=Sábado. JS getDay(): 0=Dom ... 6=Sáb.

export interface Feriado {
  data: string;   // 'YYYY-MM-DD'
  tipo: string;   // 'N' = nacional (é o que o Delphi considera)
  fixo: string;   // 'S' = repete todo ano (dia/mês); 'N' = data exata
}

export interface TabelaFeriados {
  /** Feriados fixos como chave 'MM-DD' (fixo='S', tipo='N'). */
  fixos: Set<string>;
  /** Feriados móveis como data exata 'YYYY-MM-DD' (fixo='N', tipo='N'). */
  moveis: Set<string>;
}

/** Monta a tabela de feriados a partir das linhas de dbferiado. */
export function montarFeriados(linhas: Feriado[]): TabelaFeriados {
  const fixos = new Set<string>();
  const moveis = new Set<string>();
  for (const f of linhas) {
    if (f.tipo !== 'N' || !f.data) continue;
    const iso = f.data.slice(0, 10); // 'YYYY-MM-DD'
    if (f.fixo === 'S') {
      fixos.add(iso.slice(5)); // 'MM-DD'
    } else {
      moveis.add(iso);
    }
  }
  return { fixos, moveis };
}

// ---- utilidades de data (trabalha só com a data local, sem fuso) ----

function parseISO(iso: string): Date {
  // iso 'YYYY-MM-DD...' → Date em horário local à meia-noite (sem shift de fuso)
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** true se sábado (getDay 6) ou domingo (getDay 0). */
function ehFimDeSemana(d: Date): boolean {
  const dow = d.getDay();
  return dow === 6 || dow === 0;
}

/** Replica GERAL.FLUXOCXX3.VERIFICA_DATA_FERIADO. */
export function ehFeriado(d: Date, fer: TabelaFeriados): boolean {
  const mmdd = toISO(d).slice(5);
  if (fer.fixos.has(mmdd)) return true;
  if (fer.moveis.has(toISO(d))) return true;
  return false;
}

/**
 * RETORNA_DIA_FLUXO — data de fluxo de RECEBIMENTOS (entradas).
 * O recebível compensa no dia útil SEGUINTE ao vencimento.
 */
export function retornaDiaFluxo(
  data: Date | string,
  fer: TabelaFeriados,
  primeira: 'S' | 'N' = 'S'
): Date {
  let v = typeof data === 'string' ? parseISO(data) : new Date(data);

  if (primeira === 'S') {
    while (ehFeriado(v, fer) || ehFimDeSemana(v)) {
      v = addDias(v, 1);
    }
  }

  v = addDias(v, 1); // sempre avança 1 dia (compensa no dia seguinte)

  if (ehFimDeSemana(v) || ehFeriado(v, fer)) {
    v = retornaDiaFluxo(v, fer, 'N');
  }
  return v;
}

/**
 * RETORNA_DIA_FLUXO_PGTO — data de fluxo de PAGAMENTOS (saídas).
 * Paga no próprio vencimento; só empurra fim de semana/feriado p/ frente.
 */
export function retornaDiaFluxoPgto(
  data: Date | string,
  fer: TabelaFeriados,
  primeira: 'S' | 'N' = 'S'
): Date {
  let v = typeof data === 'string' ? parseISO(data) : new Date(data);

  if (primeira === 'S') {
    while (ehFeriado(v, fer)) {
      v = addDias(v, 1);
    }
  }

  const dow = v.getDay();
  if (dow === 6) v = addDias(v, 2); // sábado → segunda
  else if (dow === 0) v = addDias(v, 1); // domingo → segunda

  if (ehFimDeSemana(v) || ehFeriado(v, fer)) {
    v = retornaDiaFluxo(v, fer, 'N'); // fiel: fallback usa a função de receb
  }
  return v;
}

/** Converte para 'YYYY-MM-DD' (helper exportado para o endpoint). */
export const dataFluxoISO = toISO;
