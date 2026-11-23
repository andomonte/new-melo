/**
 * Fila de pedidos da Venda Externa no aparelho (IndexedDB "pedidos").
 * Todo pedido é guardado ANTES de enviar (com uuid); depois vai para
 * /api/externo/enviar-pedido, um por vez. Sem internet, fica "Aguardando envio" e sai
 * sozinho quando a conexão volta. O servidor não duplica (uuid).
 *
 * Situações: AGUARDANDO → ENVIANDO → ENVIADO (nº da venda)
 *                                   → PENDENCIA (o vendedor ajusta e reenvia)
 *                                   → ERRO (técnico: tenta de novo sozinho)
 */
import { apagar, gravar, ler, todos } from './idb';
import { authHeader, type SessaoExterna } from './sessao';

export type SituacaoPedido = 'AGUARDANDO' | 'ENVIANDO' | 'ENVIADO' | 'PENDENCIA' | 'ERRO';

export interface PedidoLocal {
  uuid: string;
  numero_local: string;
  login: string;
  codcli: string;
  cliente_nome: string;
  total: number;
  itens_count: number;
  criado_em: string;
  atualizado_em: string;
  payload: any; // corpo do finalizarVenda
  liberaPreco: boolean;
  rascunho: any; // { cliente, itens, pag, obs } para reabrir na tela
  status: SituacaoPedido;
  mensagem?: string;
  codvenda?: string;
  nrovenda?: string;
}

export const EVENTO_FILA = 'vendaExterna:fila';
const avisar = () => window.dispatchEvent(new Event(EVENTO_FILA));

export function novoUuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Número provisório do aparelho: EXT-<vendedor>-<sequência>. */
export function proximoNumeroLocal(codvend: string): string {
  const chave = `vendaExterna_seq_${codvend}`;
  const n = Number(localStorage.getItem(chave) || 0) + 1;
  localStorage.setItem(chave, String(n));
  return `EXT-${codvend}-${String(n).padStart(4, '0')}`;
}

export async function listarPedidos(login: string): Promise<PedidoLocal[]> {
  const lista = await todos<PedidoLocal>('pedidos');
  return lista
    .filter((p) => p.login.toUpperCase() === login.toUpperCase())
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

export async function guardarPedido(p: PedidoLocal) {
  await gravar('pedidos', { ...p, atualizado_em: new Date().toISOString() });
  avisar();
}

export async function excluirPedido(uuid: string) {
  await apagar('pedidos', uuid);
  avisar();
}

let enviando = false;

/** Envia um pedido. Retorna a situação final. */
export async function enviarPedido(s: SessaoExterna, uuid: string): Promise<PedidoLocal | undefined> {
  const p = await ler<PedidoLocal>('pedidos', uuid);
  if (!p || p.status === 'ENVIADO') return p;
  await guardarPedido({ ...p, status: 'ENVIANDO', mensagem: undefined });
  let final: PedidoLocal;
  try {
    const r = await fetch('/api/externo/enviar-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(s) },
      body: JSON.stringify({
        uuid: p.uuid,
        numero_local: p.numero_local,
        criado_em: p.criado_em,
        payload: p.payload,
        liberaPreco: p.liberaPreco,
      }),
    });
    let d: any = {};
    try {
      d = await r.json();
    } catch {
      /* */
    }
    if (r.ok && d.ok) {
      final = { ...p, status: 'ENVIADO', codvenda: d.codvenda, nrovenda: d.nrovenda, mensagem: d.mensagem };
    } else if (d.pendencia) {
      final = { ...p, status: 'PENDENCIA', mensagem: d.mensagem };
    } else if (r.status === 401) {
      final = { ...p, status: 'AGUARDANDO', mensagem: 'Sessão vencida: entre de novo para enviar.' };
    } else if (r.status === 409) {
      final = { ...p, status: 'AGUARDANDO', mensagem: d.error };
    } else {
      final = { ...p, status: 'ERRO', mensagem: d.error || `Falha no envio (${r.status}). Tenta de novo sozinho.` };
    }
  } catch {
    final = { ...p, status: 'AGUARDANDO', mensagem: 'Sem internet: envia quando a conexão voltar.' };
  }
  await guardarPedido(final);
  return final;
}

/** Envia, um por vez, os pedidos aguardando/com erro deste usuário. */
export async function enviarPendentes(s: SessaoExterna): Promise<void> {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    const lista = (await listarPedidos(s.login)).reverse(); // mais antigos primeiro
    for (const p of lista) {
      const travado = p.status === 'ENVIANDO' && Date.now() - new Date(p.atualizado_em).getTime() > 2 * 60 * 1000;
      if (p.status === 'AGUARDANDO' || p.status === 'ERRO' || travado) {
        const r = await enviarPedido(s, p.uuid);
        if (r?.status === 'AGUARDANDO' && /internet|Sessão/.test(r.mensagem || '')) break; // caiu a conexão / sessão
      }
    }
  } finally {
    enviando = false;
  }
}
