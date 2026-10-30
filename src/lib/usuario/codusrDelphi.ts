// src/lib/usuario/codusrDelphi.ts
//
// Código do usuário no Delphi (dbusuario.codusr, varchar 4) do usuário logado.
// O Delphi grava esse código no log de ações (DBACAO) — ex.: FATURAMENTOS.GERAR_FATURAM
// faz inc_acao_usr(codusr,'INCLUIR','DBFATURA','COD:'||codfat), e é por ali que se sabe
// quem criou a fatura.
//
// Resolução: Código Delphi do perfil (tb_user_perfil.codusr_delphi, login + filial — central)
//   → dbusuario_delphi da filial com o mesmo nome do login → null.

import type { NextApiRequest } from 'next';
import { getPgPool, filialDaRequisicao } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';

type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };

export interface UsuarioDelphi {
  login: string;
  codusr: string | null;
}

export async function resolverCodusrDelphi(
  req: NextApiRequest,
  dbFilial: Db,
  loginFallback?: string | null,
): Promise<UsuarioDelphi> {
  const login = (getUserFromRequest(req)?.login_user_login || loginFallback || '').trim();
  if (!login) return { login: '', codusr: null };

  try {
    const r = await getPgPool().query(
      `SELECT codusr_delphi FROM db_manaus.tb_user_perfil
        WHERE UPPER(user_login_id) = UPPER($1) AND codusr_delphi IS NOT NULL
        ORDER BY (UPPER(nome_filial) = $2) DESC
        LIMIT 1`,
      [login, filialDaRequisicao(req)],
    );
    const cod = String(r.rows[0]?.codusr_delphi ?? '').trim();
    if (cod) return { login, codusr: cod.substring(0, 4) };
  } catch {
    /* segue para o fallback por nome */
  }

  try {
    const r = await dbFilial.query(
      `SELECT codusr FROM dbusuario_delphi WHERE UPPER(btrim(nomeusr)) = UPPER($1) LIMIT 1`,
      [login],
    );
    const cod = String(r.rows[0]?.codusr ?? '').trim();
    if (cod) return { login, codusr: cod.substring(0, 4) };
  } catch {
    /* dbusuario_delphi ausente nesta filial */
  }

  return { login, codusr: null };
}

export const MSG_SEM_CODIGO_DELPHI =
  'Usuário sem Código Delphi nesta filial. Cadastre-o em Controle de Acesso > Usuários (campo Código Delphi).';
