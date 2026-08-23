import { PoolClient } from 'pg';

/**
 * Autenticação do separador na Estação por MATRÍCULA + CÓDIGO.
 *
 * - matrícula (única) identifica QUEM é; código de acesso é a senha.
 * - primeiro acesso: quando codigoacesso === matricula (ainda não personalizado)
 *   → retorna primeiroAcesso=true para a tela forçar a criação de um código.
 *   (Nesse estado o código não é cobrado, pois será trocado em seguida.)
 */
export type AuthOk = { ok: true; primeiroAcesso: boolean; matricula: string; nome: string };
export type AuthErr = { ok: false; status: number; error: string; code: string };
export type AuthResult = AuthOk | AuthErr;

export async function autenticarSeparador(
  client: PoolClient,
  matriculaRaw: unknown,
  codigoRaw: unknown,
): Promise<AuthResult> {
  const matricula = String(matriculaRaw ?? '').trim();
  const codigo = String(codigoRaw ?? '').trim();

  if (!matricula) {
    return { ok: false, status: 400, error: 'Informe a matrícula.', code: 'MATRICULA_OBRIGATORIA' };
  }

  const r = await client.query(
    `SELECT matricula, nome, codigoacesso FROM dbfunc_estoque WHERE matricula = $1 LIMIT 1`,
    [matricula],
  );
  if (r.rows.length === 0) {
    return { ok: false, status: 404, error: 'Matrícula não encontrada.', code: 'MATRICULA_INVALIDA' };
  }

  const f = r.rows[0];
  const primeiroAcesso = String(f.codigoacesso) === String(f.matricula);

  if (primeiroAcesso) {
    return { ok: true, primeiroAcesso: true, matricula: f.matricula, nome: f.nome };
  }

  if (!codigo) {
    return { ok: false, status: 400, error: 'Informe o código de acesso.', code: 'CODIGO_OBRIGATORIO' };
  }
  if (String(f.codigoacesso) !== codigo) {
    return { ok: false, status: 401, error: 'Código de acesso incorreto.', code: 'CODIGO_INCORRETO' };
  }

  return { ok: true, primeiroAcesso: false, matricula: f.matricula, nome: f.nome };
}
