import { PoolClient, Pool } from 'pg';

/**
 * Retorna o timezone da filial.
 * Busca na tb_filial pelo nome da filial (cookie filial_melo).
 * Fallback: 'America/Manaus'
 */
export async function getFilialTimezone(
  client: PoolClient | Pool,
  filial: string,
): Promise<string> {
  try {
    const result = await client.query(
      `SELECT timezone FROM db_manaus.tb_filial WHERE nome_filial = $1 LIMIT 1`,
      [filial],
    );
    return result.rows[0]?.timezone || 'America/Manaus';
  } catch {
    return 'America/Manaus';
  }
}

/**
 * Expressão SQL para a data atual no timezone da filial.
 * Uso: substituir CURRENT_DATE por esta expressão.
 * Ex: `INSERT INTO ... VALUES (..., ${currentDateSQL('America/Manaus')}, ...)`
 */
export function currentDateSQL(timezone: string): string {
  return `(NOW() AT TIME ZONE '${timezone}')::date`;
}

/**
 * Expressão SQL para o timestamp atual no timezone da filial.
 * Uso: substituir NOW() ou CURRENT_TIMESTAMP por esta expressão.
 */
export function currentTimestampSQL(timezone: string): string {
  return `(NOW() AT TIME ZONE '${timezone}')`;
}
