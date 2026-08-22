import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/vendas-a-fechar?dataDe&dataAte&tipo&busca
 *
 * Lista as vendas NÃO FATURADAS (espelha VENDAS.Venda_Filtro, vTipoSit='N'):
 *   status IN ('0','N','I','S','1','D','2','L') AND cancel <> 'S'
 * Filtros: período (data), tipo de venda (C/P/T) e busca (cliente/vendedor/nº venda).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const dataDe = String(req.query.dataDe || '').trim() || null;
  const dataAte = String(req.query.dataAte || '').trim() || null;
  const tipo = String(req.query.tipo || 'T').trim().toUpperCase(); // C | P | T
  const busca = String(req.query.busca || '').trim();

  const pool = getPgPool();
  try {
    const params: any[] = [];
    const cond: string[] = [
      `v.status IN ('0','N','I','S','1','D','2','L')`,
      `(v.cancel IS NULL OR v.cancel <> 'S')`,
    ];
    if (dataDe) {
      params.push(dataDe);
      cond.push(`v.data >= $${params.length}`);
    }
    if (dataAte) {
      params.push(dataAte);
      cond.push(`v.data <= $${params.length}`);
    }
    if (tipo === 'C' || tipo === 'P') {
      params.push(tipo);
      cond.push(`v.tipo = $${params.length}`);
    }
    if (busca) {
      params.push(`%${busca}%`);
      const i = params.length;
      cond.push(
        `(c.nome ILIKE $${i} OR v.nrovenda ILIKE $${i} OR vd.nome ILIKE $${i})`,
      );
    }

    const sql = `
      SELECT v.codvenda, v.nrovenda, v.data, v.tipo, v.total, v.obs, v.status,
             c.nome AS cliente_nome, vd.nome AS vendedor_nome
        FROM db_manaus.dbvenda v
        LEFT JOIN db_manaus.dbclien c ON c.codcli = v.codcli
        LEFT JOIN db_manaus.dbvend vd ON vd.codvend = v.codvend
       WHERE ${cond.join(' AND ')}
       ORDER BY v.data, v.tipo, v.nrovenda
       LIMIT 2000`;

    const { rows } = await pool.query(sql, params);
    return res.status(200).json({ vendas: rows, total: rows.length });
  } catch (error: any) {
    console.error('Erro ao listar vendas a fechar:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao listar vendas.', detalhes: error?.message });
  }
}
