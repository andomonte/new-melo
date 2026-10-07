import { PoolClient, Pool } from 'pg';

/**
 * Cidade/UF da filial — usados como Local/UF de Desembaraço da NF-e de nacionalização.
 *
 * Fonte preferida: tb_filial (cadastro central, campos cidade/uf — migration 064),
 * resolvida pelo nome da filial (cookie filial_melo), mesmo padrão de getFilialTimezone.
 * Em schemas onde tb_filial é VIEW sem cidade/uf, cai para dadosempresa (município/uf
 * da própria empresa da filial). Nunca lança — retorna defaults vazios.
 */
export async function getFilialCidadeUf(
  client: PoolClient | Pool,
  filial: string,
): Promise<{ cidade: string; uf: string }> {
  // 1) tb_filial.cidade/uf (cadastro da filial)
  try {
    const r = await client.query(
      `SELECT cidade, uf FROM tb_filial WHERE nome_filial = $1 LIMIT 1`,
      [filial],
    );
    const row = r.rows[0];
    if (row && (row.cidade || row.uf)) {
      return {
        cidade: String(row.cidade || '').trim(),
        uf: String(row.uf || '').trim().toUpperCase(),
      };
    }
  } catch {
    /* tb_filial pode ser VIEW sem cidade/uf em schemas de filial — usa fallback */
  }

  // 2) Fallback: dados da própria empresa da filial (dadosempresa)
  try {
    const r = await client.query(
      `SELECT municipio, uf FROM dadosempresa LIMIT 1`,
    );
    const row = r.rows[0];
    if (row) {
      return {
        cidade: String(row.municipio || '').trim(),
        uf: String(row.uf || '').trim().toUpperCase(),
      };
    }
  } catch {
    /* ignora */
  }

  return { cidade: '', uf: '' };
}
