/**
 * Fornecedor (dbcredor) de uma fatura da DI a partir do nome que vem na DI.
 *
 * A DI traz o nome truncado (~30 caracteres) e com grafia diferente do cadastro
 * ("CO LTD" x "CO.,LTD", "INTERNATIONAL" x "INTERNACIONAL", "AND" x "E"). Compara só letras e
 * números, por prefixo, preferindo o casamento exato.
 */
import type { Pool, PoolClient } from 'pg';

type Db = Pool | PoolClient;

// " AND " = " E " (a DI vem em inglês, o cadastro às vezes em português: "BEARINGS AND
// AUTO" x "BEARINGS E AUTO"). Só como palavra solta — não mexe em "SANDERO".
export const SQL_NOME_NORMALIZADO = (col: string) =>
  `regexp_replace(replace(replace(UPPER(${col}), ' AND ', ' E '), 'INTERNACIONAL', 'INTERNATIONAL'), '[^A-Z0-9]', '', 'g')`;

export const SQL_RESOLVER_CREDOR_POR_NOME = `
  SELECT cod_credor, nome
  FROM dbcredor
  WHERE ${SQL_NOME_NORMALIZADO('nome')} LIKE ${SQL_NOME_NORMALIZADO('$1')} || '%'
    AND length(${SQL_NOME_NORMALIZADO('$1')}) >= 6
  ORDER BY (UPPER(TRIM(nome)) LIKE UPPER(TRIM($1)) || '%') DESC, cod_credor
  LIMIT 1
`;

export async function resolverCredorPorNome(db: Db, nome: string | null | undefined): Promise<string | null> {
  const n = String(nome || '').trim();
  if (!n) return null;
  const r = await db.query(SQL_RESOLVER_CREDOR_POR_NOME, [n]);
  return r.rows[0]?.cod_credor ?? null;
}
