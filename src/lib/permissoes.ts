import type { NextApiRequest } from 'next';
import { getPgPool } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';

/**
 * Checagens de permissão NO BACKEND (ACL é central → db_manaus).
 *
 * - `usuarioPossuiFuncao`: função granular por sigla (tb_login_functions), concedida
 *   por PERFIL (tb_login_access_perfil) ou direto ao USUÁRIO (tb_login_access_user).
 *   Mesmo modelo que o front usa via `user.funcoes`.
 * - `usuarioPossuiTela`: acesso à tela (PATH_TELA) por algum perfil do usuário
 *   (tb_user_perfil → "tb_grupo_Permissao" → tb_telas).
 *
 * A identidade vem do cookie `token_melo` (getUserFromRequest). Sem login → nega.
 */

function loginDaRequisicao(req: NextApiRequest): string {
  return getUserFromRequest(req)?.login_user_login?.trim() || '';
}

export async function usuarioPossuiFuncao(req: NextApiRequest, sigla: string): Promise<boolean> {
  const login = loginDaRequisicao(req);
  if (!login) return false;
  const pool = getPgPool();
  const { rows } = await pool.query(
    `WITH perfis AS (
        SELECT perfil_name FROM db_manaus.tb_user_perfil WHERE user_login_id = $1
      ),
      ids AS (
        SELECT lap.id_functions
          FROM db_manaus.tb_login_access_perfil lap
          JOIN perfis p ON p.perfil_name = lap.login_perfil_name
        UNION
        SELECT lau.id_functions
          FROM db_manaus.tb_login_access_user lau
         WHERE lau.login_user_login = $1
      )
      SELECT 1
        FROM ids i
        JOIN db_manaus.tb_login_functions f ON f.id_functions::bigint = i.id_functions
       WHERE f.sigla = $2
       LIMIT 1`,
    [login, sigla],
  );
  return rows.length > 0;
}

export async function usuarioPossuiTela(req: NextApiRequest, pathTela: string): Promise<boolean> {
  const login = loginDaRequisicao(req);
  if (!login) return false;
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT 1
       FROM db_manaus.tb_user_perfil up
       JOIN db_manaus."tb_grupo_Permissao" gp ON gp."grupoId" = up.perfil_name
       JOIN db_manaus.tb_telas t ON t."CODIGO_TELA" = gp.tela
      WHERE up.user_login_id = $1 AND t."PATH_TELA" = $2
      LIMIT 1`,
    [login, pathTela],
  );
  return rows.length > 0;
}
