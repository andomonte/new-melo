/**
 * Sessão da Venda Externa no aparelho (localStorage) + PIN.
 *  - passe: token de 7 dias emitido pelo servidor (/api/externo/login), renovado a cada
 *    conexão. Sem internet, vale até vencer; vencido → só consulta, sem pedido novo.
 *  - PIN de 4 dígitos criado no primeiro acesso: desbloqueia o app ao abrir (não dá para
 *    conferir a senha sem internet). Guardado só o hash (SHA-256 com sal).
 *    5 erros seguidos → sai da conta (pedidos guardados continuam no aparelho).
 */
export interface SessaoExterna {
  token: string;
  login: string;
  nome: string;
  filial: string;
  codigoFilial: number;
  codvend: string;
  perfil: string;
  exp: number; // ms
  funcoes: string[];
  armId: number;
  pinHash?: string;
  pinSal?: string;
}

const CHAVE = 'vendaExterna_sessao_v1';
const CHAVE_DESBLOQUEIO = 'vendaExterna_desbloqueado';
const CHAVE_ERROS = 'vendaExterna_pin_erros';
export const MAX_ERROS_PIN = 5;

export function lerSessao(): SessaoExterna | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}

export function salvarSessao(s: SessaoExterna) {
  localStorage.setItem(CHAVE, JSON.stringify(s));
}

export function sairDaConta() {
  localStorage.removeItem(CHAVE);
  sessionStorage.removeItem(CHAVE_DESBLOQUEIO);
  localStorage.removeItem(CHAVE_ERROS);
}

export const sessaoVencida = (s: SessaoExterna | null) => !s || Date.now() > s.exp;

// ---------- PIN ----------
async function sha256(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto);
  const h = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function definirPin(s: SessaoExterna, pin: string): Promise<SessaoExterna> {
  const sal = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const nova = { ...s, pinSal: sal, pinHash: await sha256(`${sal}:${s.login}:${pin}`) };
  salvarSessao(nova);
  marcarDesbloqueado();
  return nova;
}

/** true = PIN certo. Após MAX_ERROS_PIN erros, sai da conta (retorna 'saiu'). */
export async function conferirPin(s: SessaoExterna, pin: string): Promise<true | false | 'saiu'> {
  if (!s.pinHash || !s.pinSal) return false;
  const ok = (await sha256(`${s.pinSal}:${s.login}:${pin}`)) === s.pinHash;
  if (ok) {
    localStorage.removeItem(CHAVE_ERROS);
    marcarDesbloqueado();
    return true;
  }
  const erros = Number(localStorage.getItem(CHAVE_ERROS) || 0) + 1;
  localStorage.setItem(CHAVE_ERROS, String(erros));
  if (erros >= MAX_ERROS_PIN) {
    sairDaConta();
    return 'saiu';
  }
  return false;
}

export const errosPin = () => Number(localStorage.getItem(CHAVE_ERROS) || 0);
export const marcarDesbloqueado = () => sessionStorage.setItem(CHAVE_DESBLOQUEIO, '1');
export const estaDesbloqueado = () => sessionStorage.getItem(CHAVE_DESBLOQUEIO) === '1';

/** As APIs de venda leem a filial do cookie filial_melo: grava a da sessão. */
export function aplicarCookieFilial(filial: string) {
  document.cookie = `filial_melo=${encodeURIComponent(filial)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

/** Cabeçalho de autorização das APIs /api/externo/* e do pacote. */
export const authHeader = (s: SessaoExterna | null): Record<string, string> =>
  s?.token ? { Authorization: `Bearer ${s.token}` } : {};
