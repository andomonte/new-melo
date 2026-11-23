/**
 * Passe da Venda Externa (/externo): token assinado (HMAC-SHA256) com validade de 7 dias,
 * guardado no aparelho do vendedor. Substitui o cookie de sessão do sistema, que some ao
 * fechar o navegador e impede o uso sem internet.
 *
 * Segredo: env VENDA_EXTERNA_SECRET. Sem ela, deriva um segredo estável da DATABASE_URL
 * (não é público e não muda entre reinícios). Recomendado definir VENDA_EXTERNA_SECRET.
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
import crypto from 'crypto';
import type { NextApiRequest } from 'next';

export const VALIDADE_PASSE_DIAS = 7;

export interface PasseExterno {
  u: string; // login
  n: string; // nome
  f: string; // filial (MANAUS, RORAIMA, RONDONIA)
  v: string; // codvend
  p: string; // perfil (grupo)
  iat: number; // emitido (ms)
  exp: number; // vence (ms)
}

function segredo(): Buffer {
  const env = process.env.VENDA_EXTERNA_SECRET;
  const base = env && env.length >= 16 ? env : `venda-externa|${process.env.DATABASE_URL || 'melo'}`;
  return crypto.createHash('sha256').update(base).digest();
}

const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function emitirPasse(dados: Omit<PasseExterno, 'iat' | 'exp'>): { token: string; passe: PasseExterno } {
  const agora = Date.now();
  const passe: PasseExterno = { ...dados, iat: agora, exp: agora + VALIDADE_PASSE_DIAS * 24 * 3600 * 1000 };
  const corpo = b64u(Buffer.from(JSON.stringify(passe), 'utf8'));
  const assinatura = b64u(crypto.createHmac('sha256', segredo()).update(corpo).digest());
  return { token: `${corpo}.${assinatura}`, passe };
}

/** Confere assinatura e validade. Retorna o passe ou null. */
export function lerPasse(token: string | undefined | null): PasseExterno | null {
  if (!token || typeof token !== 'string') return null;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;
  const esperado = b64u(crypto.createHmac('sha256', segredo()).update(corpo).digest());
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const passe = JSON.parse(deB64u(corpo).toString('utf8')) as PasseExterno;
    if (!passe?.u || !passe?.f || !passe?.exp || Date.now() > passe.exp) return null;
    return passe;
  } catch {
    return null;
  }
}

/** Passe do header Authorization: Bearer <token>. */
export function passeDaRequisicao(req: NextApiRequest): PasseExterno | null {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(Array.isArray(h) ? h[0] : h);
  return m ? lerPasse(m[1].trim()) : null;
}
