/**
 * Confere se o usuário pode usar a Venda Externa na filial: existe, não está bloqueado
 * e tem código de vendedor nela (tb_user_perfil.codvend). Usado no login e ao renovar o
 * passe — assim, tirar o vendedor/bloquear o usuário corta o acesso na próxima conexão.
 */
import { getPgPool } from '@/lib/pg';

export type UsuarioExterno =
  | { ok: true; login: string; nome: string; codvend: string; perfil: string }
  | { ok: false; status: number; error: string };

export async function validarUsuarioExterno(login: string, filial: string): Promise<UsuarioExterno> {
  const central = getPgPool();
  const u = await central.query(
    `SELECT login_user_login, login_user_name, bloqueado
       FROM db_manaus.tb_login_user WHERE UPPER(login_user_login) = UPPER($1) LIMIT 1`,
    [login],
  );
  const row = u.rows[0];
  if (!row) return { ok: false, status: 401, error: 'Usuário não encontrado.' };
  const bloq = String(row.bloqueado ?? '').trim().toUpperCase();
  if (bloq === 'S' || bloq === '1' || bloq === 'TRUE') return { ok: false, status: 403, error: 'Usuário bloqueado.' };

  const p = await central.query(
    `SELECT codvend, perfil_name FROM db_manaus.tb_user_perfil
      WHERE UPPER(user_login_id) = UPPER($1) AND UPPER(nome_filial) = UPPER($2) LIMIT 1`,
    [row.login_user_login, filial],
  );
  const codvend = String(p.rows[0]?.codvend || '').trim();
  if (!codvend) {
    return { ok: false, status: 403, error: `Seu usuário não tem código de vendedor na filial ${filial}.` };
  }
  return {
    ok: true,
    login: row.login_user_login,
    nome: row.login_user_name || row.login_user_login,
    codvend,
    perfil: p.rows[0]?.perfil_name || '',
  };
}
