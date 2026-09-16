// src/lib/fluxo-caixa/cenario.ts
//
// Lógica de cenário (PASSADO/ATUAL/FUTURO) e classificação de um título ABERTO
// no bucket ATRASADOS ou no dia do mês — compartilhada entre o endpoint mensal
// (agregado) e o de detalhe (drill-down), para que os títulos do detalhe batam
// exatamente com o valor da célula.

export type Cenario = 'PASSADO' | 'ATUAL' | 'FUTURO';

export interface JanelaMes {
  cenario: Cenario;
  diasNoMes: number;
  primeiroDia: string; // 'YYYY-MM-DD'
  ultimoDia: string;   // 'YYYY-MM-DD'
  hojeISO: string;     // 'YYYY-MM-DD'
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function calcularJanela(ano: number, mes: number, hoje = new Date()): JanelaMes {
  const diasNoMes = ultimoDiaDoMes(ano, mes);
  const mm = String(mes).padStart(2, '0');
  const primeiroDia = `${ano}-${mm}-01`;
  const ultimoDia = `${ano}-${mm}-${String(diasNoMes).padStart(2, '0')}`;
  const chaveSel = ano * 100 + mes;
  const chaveAtual = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  const cenario: Cenario = chaveSel < chaveAtual ? 'PASSADO' : chaveSel > chaveAtual ? 'FUTURO' : 'ATUAL';
  return { cenario, diasNoMes, primeiroDia, ultimoDia, hojeISO: toISO(hoje) };
}

/**
 * Classifica um título ABERTO conforme o cenário.
 * Retorna 'ATRASADOS', o número do dia (1..31), ou null (fora da janela → ignora).
 */
export function bucketAberto(flowISO: string, j: JanelaMes): 'ATRASADOS' | number | null {
  const dia = parseInt(flowISO.slice(8, 10), 10);
  if (j.cenario === 'PASSADO') {
    return flowISO <= j.ultimoDia ? 'ATRASADOS' : null;
  }
  if (j.cenario === 'ATUAL') {
    if (flowISO < j.hojeISO) return 'ATRASADOS';
    if (flowISO >= j.primeiroDia && flowISO <= j.ultimoDia) return dia;
    return null;
  }
  // FUTURO
  if (flowISO >= j.primeiroDia && flowISO <= j.ultimoDia) return dia;
  return null;
}

/** Alvo do drill-down: 'ATRASADOS' ou o número do dia. Compara com o bucket. */
export function baterAlvo(bucket: 'ATRASADOS' | number | null, alvo: string): boolean {
  if (bucket === null) return false;
  if (alvo === 'ATRASADOS') return bucket === 'ATRASADOS';
  return typeof bucket === 'number' && bucket === parseInt(alvo, 10);
}
