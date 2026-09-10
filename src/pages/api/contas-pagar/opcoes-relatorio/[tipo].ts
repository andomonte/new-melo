import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Opções (combobox pesquisável) para os filtros dos relatórios de Contas a Pagar.
 * Rota: /api/contas-pagar/opcoes-relatorio/<tipo>?search=<termo>
 *   conta_financeira | pagas_sem_nf → cad_conta_financeira (cof_id / cof_descricao)
 *   comprador                       → dbcompradores (codcomprador / nome)
 *   centro_custo                    → cad_centro_custo (cec_id / cec_descricao)
 *   grupo_centro                    → cad_grupo_centro_custo (gcc_id / gcc_descricao)
 * Sempre inclui a opção "— TODOS —" (value '__TODOS__') no topo.
 */

const CONFIG: Record<string, { sql: string; idCol: string; searchCols: string[] }> = {
  conta_financeira: {
    idCol: 'cof_id',
    searchCols: ['cof_id::text', 'cof_descricao'],
    sql: `SELECT cof_id::text AS value, (cof_id || ' - ' || COALESCE(cof_descricao,'(sem descrição)')) AS label
          FROM cad_conta_financeira`,
  },
  pagas_sem_nf: {
    idCol: 'cof_id',
    searchCols: ['cof_id::text', 'cof_descricao'],
    sql: `SELECT cof_id::text AS value, (cof_id || ' - ' || COALESCE(cof_descricao,'(sem descrição)')) AS label
          FROM cad_conta_financeira`,
  },
  comprador: {
    idCol: 'codcomprador',
    searchCols: ['codcomprador', 'nome'],
    sql: `SELECT codcomprador::text AS value, (codcomprador || ' - ' || COALESCE(nome,'')) AS label
          FROM dbcompradores`,
  },
  centro_custo: {
    idCol: 'cec_id',
    searchCols: ['cec_id::text', 'cec_descricao'],
    sql: `SELECT cec_id::text AS value, (cec_id || ' - ' || COALESCE(cec_descricao,'')) AS label
          FROM cad_centro_custo`,
  },
  grupo_centro: {
    idCol: 'gcc_id',
    searchCols: ['gcc_id::text', 'gcc_descricao'],
    sql: `SELECT gcc_id::text AS value, (gcc_id || ' - ' || COALESCE(gcc_descricao,'')) AS label
          FROM cad_grupo_centro_custo`,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });

  const tipo = String(req.query.tipo || '');
  const search = String(req.query.search || '').trim();
  const cfg = CONFIG[tipo];
  if (!cfg) return res.status(400).json({ erro: `Tipo de opção inválido: ${tipo}` });

  const pool = getPgPool();
  try {
    const vals: any[] = [];
    let where = '';
    if (search) {
      // busca por código OU descrição/nome
      vals.push(`%${search.toUpperCase()}%`);
      const ors = cfg.searchCols.map((c) => `UPPER(${c}) LIKE $1`).join(' OR ');
      where = ` WHERE ${ors}`;
    }
    const sql = `${cfg.sql}${where} ORDER BY ${cfg.idCol} ${search ? '' : 'LIMIT 500'}`;
    const { rows } = await pool.query(sql, vals);
    const opcoes = [{ value: '__TODOS__', label: '— TODOS —' }, ...rows];
    return res.status(200).json({ opcoes });
  } catch (error: any) {
    console.error('[opcoes-relatorio] erro:', error);
    return res.status(500).json({ erro: 'Erro ao carregar opções', detalhes: error?.message });
  }
}
