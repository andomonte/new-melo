/**
 * Entrar / renovar a sessão da Venda Externa (lado do aparelho).
 */
import { aplicarCookieFilial, authHeader, lerSessao, salvarSessao, type SessaoExterna } from './sessao';

async function json(r: Response) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

async function carregarFuncoesEArmazem(login: string, perfil: string, filial: string) {
  let funcoes: string[] = [];
  let armId = 1001;
  try {
    const r = await fetch(
      `/api/grupoFuncoes/get?login_user_login=${encodeURIComponent(login)}${perfil ? `&grupoId=${encodeURIComponent(perfil)}` : ''}`,
    );
    const d = await json(r);
    funcoes = (d.funcoes || []).map((f: any) => (typeof f === 'string' ? f : f?.sigla)).filter(Boolean);
  } catch {
    /* sem funções: preço abaixo da tabela vai para análise */
  }
  try {
    const r = await fetch(
      `/api/armazensUsuario/get?login_user_login=${encodeURIComponent(login)}${perfil ? `&grupoId=${encodeURIComponent(perfil)}` : ''}&filial=${encodeURIComponent(filial)}`,
    );
    const d = await json(r);
    const a = (d.data || [])[0];
    if (a?.id_armazem) armId = Number(a.id_armazem) || 1001;
  } catch {
    /* armazém padrão */
  }
  return { funcoes, armId };
}

export async function entrar(usuario: string, senha: string, codigoFilial: number): Promise<SessaoExterna> {
  const r = await fetch('/api/externo/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha, codigoFilial }),
  });
  const d = await json(r);
  if (!r.ok) throw new Error(d.error || 'Não foi possível entrar.');
  const p = d.passe;
  aplicarCookieFilial(p.f);
  const extra = await carregarFuncoesEArmazem(p.u, p.p, p.f);
  const anterior = lerSessao();
  const s: SessaoExterna = {
    token: d.token,
    login: p.u,
    nome: p.n,
    filial: p.f,
    codigoFilial,
    codvend: p.v,
    perfil: p.p,
    exp: p.exp,
    ...extra,
    // mesmo usuário no mesmo aparelho: mantém o PIN
    ...(anterior && anterior.login === p.u ? { pinHash: anterior.pinHash, pinSal: anterior.pinSal } : {}),
  };
  salvarSessao(s);
  return s;
}

/** Renova o passe (com internet). 'sair' = servidor recusou (bloqueado/sem vendedor/vencido). */
export async function renovar(s: SessaoExterna): Promise<SessaoExterna | 'sair' | null> {
  try {
    const r = await fetch('/api/externo/renovar', { method: 'POST', headers: authHeader(s) });
    if (r.status === 401 || r.status === 403) return 'sair';
    if (!r.ok) return null;
    const d = await json(r);
    const p = d.passe;
    aplicarCookieFilial(p.f);
    const extra = await carregarFuncoesEArmazem(p.u, p.p, p.f);
    const nova: SessaoExterna = { ...s, token: d.token, nome: p.n, codvend: p.v, perfil: p.p, exp: p.exp, ...extra };
    salvarSessao(nova);
    return nova;
  } catch {
    return null; // sem internet: segue com a sessão atual
  }
}
