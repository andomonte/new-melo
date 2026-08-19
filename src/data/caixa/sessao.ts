/** Cliente HTTP da sessão de caixa (abertura/fechamento). Ver src/lib/caixa/sessaoCaixa.ts. */

export type StatusSessao = 'ABERTO' | 'EM_FECHAMENTO' | 'FECHADO';
export type FormaPagamentoSessao = 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'PIX' | 'CHEQUE' | 'OUTRO';

export interface SessaoCaixa {
  id: number;
  filial: string;
  cod_conta: string;
  operador_abertura: string;
  operador_fechamento: string | null;
  status: StatusSessao;
  aberto_em: string;
  fechado_em: string | null;
  fundo_troco: number;
  saldo_esperado_dinheiro: number | null;
  saldo_informado_dinheiro: number | null;
  quebra: number | null;
  fechamento_forcado: boolean;
}
export interface TotalForma { forma_pagamento: FormaPagamentoSessao; entrada: number; saida: number; liquido: number; }
export interface SaldosSessao { saldoDinheiro: number; totaisPorForma: TotalForma[]; }
export interface SessaoResposta { sessao: SessaoCaixa | null; saldoDinheiro?: number; totaisPorForma?: TotalForma[]; }

async function req(url: string, init?: RequestInit) {
  const resp = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err: any = new Error(data.erro || data.detalhes || 'Erro no caixa');
    err.code = data.code;
    throw err;
  }
  return data;
}

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** Sessão aberta/em-fechamento da conta (+ saldos), ou {sessao:null}. */
export const getSessaoAtual = (filial: string, cod_conta: string): Promise<SessaoResposta> =>
  req(`/api/caixa/sessoes/atual?${qs({ filial, cod_conta })}`);

export const abrirCaixa = (body: {
  filial: string; cod_conta: string; operador: string; fundo_troco: number; observacao?: string;
}) => req('/api/caixa/sessoes', { method: 'POST', body: JSON.stringify(body) });

export const sangria = (id: number, body: { filial: string; operador: string; valor: number; motivo: string }) =>
  req(`/api/caixa/sessoes/${id}/sangrias`, { method: 'POST', body: JSON.stringify(body) });

export const suprimento = (id: number, body: { filial: string; operador: string; valor: number; motivo: string }) =>
  req(`/api/caixa/sessoes/${id}/suprimentos`, { method: 'POST', body: JSON.stringify(body) });

export const iniciarFechamento = (id: number, filial: string) =>
  req(`/api/caixa/sessoes/${id}/fechamento`, { method: 'POST', body: JSON.stringify({ filial }) });

export const confirmarFechamento = (id: number, body: {
  filial: string; operador: string; saldo_informado_dinheiro: number;
  valores_por_forma?: { forma_pagamento: FormaPagamentoSessao; valor_informado: number }[]; observacao?: string;
}) => req(`/api/caixa/sessoes/${id}/fechamento`, { method: 'PUT', body: JSON.stringify(body) });

export const cancelarFechamento = (id: number, filial: string) =>
  req(`/api/caixa/sessoes/${id}/fechamento`, { method: 'DELETE', body: JSON.stringify({ filial }) });

export const getRelatorio = (id: number, filial: string) =>
  req(`/api/caixa/sessoes/${id}/relatorio?${qs({ filial, _: '' })}`.replace('&_=', ''));

export const getMovimentos = (id: number, filial: string) =>
  req(`/api/caixa/sessoes/${id}/movimentos?${qs({ filial })}`);

/** Registra os movimentos de RECEBIMENTO na sessão aberta (chamado após a baixa real). */
export const registrarRecebimento = (body: {
  filial: string; cod_conta: string; operador: string;
  movimentos: { forma_pagamento: FormaPagamentoSessao; valor: number; referencia?: string }[];
}) => req('/api/caixa/sessoes/recebimento', { method: 'POST', body: JSON.stringify(body) });
