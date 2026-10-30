// src/lib/fiscal/erroEmissao.ts
//
// Erro de emissão que NÃO chegou à SEFAZ (certificado, CSC, montagem do XML, rede...).
// Rejeição da SEFAZ já fica em dbfat_nfe (status/motivo); estes erros não deixavam rastro
// nenhum — a fatura aparecia só como "Pendente" e o motivo se perdia ao sair da tela.
// Grava no log de ações (dbacao), no mesmo formato do Delphi: tabela DBFATURA,
// obs 'COD:<codfat> | <mensagem>', com o código do usuário que tentou emitir.

import type { NextApiRequest } from 'next';
import { resolverCodusrDelphi } from '@/lib/usuario/codusrDelphi';

type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };

export const ACAO_ERRO_EMISSAO = 'ERRO EMISSAO NF';

/** Nunca lança — o erro original da emissão é o que importa devolver. */
export async function registrarErroEmissao(
  req: NextApiRequest,
  db: Db,
  codfat: string | null | undefined,
  mensagem: string,
): Promise<void> {
  if (!codfat) return;
  try {
    const usr = await resolverCodusrDelphi(req, db, req.body?.usuario);
    await db.query(
      `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
       VALUES ($1, $2, 'DBFATURA', $3, now())`,
      [
        (usr.codusr || usr.login || 'SISTEMA').substring(0, 60),
        ACAO_ERRO_EMISSAO,
        `COD:${codfat} | ${String(mensagem || 'Erro não especificado')}`.substring(0, 255),
      ],
    );
  } catch (e) {
    console.error('⚠️ Não foi possível registrar o erro de emissão:', e);
  }
}

/**
 * LATERAL com o último erro de emissão da fatura `<alias>.codfat`.
 * Colunas: erro_emissao_data, erro_emissao_msg.
 */
export function sqlUltimoErroEmissao(alias: string): string {
  return `LEFT JOIN LATERAL (
        SELECT a.data AS erro_emissao_data,
               substring(a.obs FROM position(' | ' IN a.obs) + 3) AS erro_emissao_msg
          FROM dbacao a
         WHERE a.tabela = 'DBFATURA' AND a.acao = '${ACAO_ERRO_EMISSAO}'
           AND a.obs LIKE 'COD:' || ${alias}.codfat || ' | %'
         ORDER BY a.data DESC
         LIMIT 1
      ) errnf ON true`;
}
