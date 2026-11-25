import type { PoolClient } from 'pg';

/**
 * Código IBGE do município pela cidade + UF do cadastro (dbmunicipio).
 * O cadastro de fornecedor pegava o município do BAIRRO (busca aproximada por nome em
 * dbbairro): bairro sem cadastro (ex.: TAMBORE, Barueri) quebrava o salvar, e bairro com o
 * mesmo nome em outra cidade ("CENTRO") trazia o município errado. Cidade + UF é o dado certo.
 * Compara sem acento e sem diferença de maiúsculas. Devolve null se não achar.
 */
export async function municipioPorCidade(client: PoolClient, cidade?: string | null, uf?: string | null): Promise<string | null> {
  const c = String(cidade || '').trim();
  const u = String(uf || '').trim().toUpperCase();
  if (!c || !/^[A-Z]{2}$/.test(u) || u === 'EX') return null;
  const semAcento = (expr: string) =>
    `translate(upper(${expr}), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')`;
  const r = await client.query(
    `SELECT codmunicipio FROM dbmunicipio
      WHERE upper(trim(uf)) = $2 AND ${semAcento('trim(descricao)')} = ${semAcento('$1')}
      LIMIT 1`, [c, u]);
  return r.rows[0]?.codmunicipio ? String(r.rows[0].codmunicipio) : null;
}
