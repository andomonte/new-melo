import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/caixa/consultar-prevendas?desde=yyyy-mm-dd&termo=&limit=
 * Consulta (SOMENTE LEITURA) de PRÉ-PEDIDOS/pré-vendas para o operador de caixa
 * localizar e copiar o número. Faturável = status NOT IN ('F','B','C') AND cancel='N'
 * (mesma regra do faturar do caixa) — são os pré-pedidos pendentes.
 * Filtros: "a partir de" (data) e Localizar (nº da venda, código ou nome do cliente).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });

  const desde = String(req.query.desde || '').trim();
  const termo = String(req.query.termo || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const params: any[] = [];
    let idx = 1;
    let where = `v.status NOT IN ('F','B','C') AND COALESCE(v.cancel,'N') = 'N'`;

    if (/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      where += ` AND v.data >= $${idx++}`;
      params.push(desde);
    }

    if (termo) {
      const soDigitos = /^\d+$/.test(termo);
      const pLike = `%${termo}%`;
      if (soDigitos) {
        where += ` AND (v.nrovenda = $${idx} OR v.codcli = $${idx} OR UPPER(c.nome) LIKE UPPER($${idx + 1}))`;
        params.push(termo); // $idx
        params.push(pLike); // $idx+1
        idx += 2;
      } else {
        where += ` AND UPPER(c.nome) LIKE UPPER($${idx})`;
        params.push(pLike);
        idx += 1;
      }
    }

    params.push(limit);
    // Total = v.total (mesmo campo da Central de Vendas, listar-vendas.ts). O
    // SUM(totalproduto) não bate porque não inclui IPI/ST; v.total é o total cheio.
    const q = `
      SELECT v.codvenda, v.nrovenda, v.data, v.tipo, v.status, v.obs,
             v.codcli, v.codvend, c.nome AS nome_cliente,
             COALESCE(v.total, 0) AS total
        FROM dbvenda v
        LEFT JOIN dbclien c ON c.codcli = v.codcli
       WHERE ${where}
       ORDER BY v.data DESC, v.nrovenda DESC
       LIMIT $${idx}`;

    const r = await client.query(q, params);
    return res.status(200).json({
      prevendas: r.rows.map((x) => ({
        codvenda: x.codvenda,
        nrovenda: x.nrovenda,
        data: x.data,
        tipo: x.tipo,
        status: x.status,
        obs: x.obs || '',
        codcli: x.codcli,
        codvend: x.codvend,
        nome_cliente: x.nome_cliente,
        total: Number(x.total || 0),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao consultar pré-pedidos:', error);
    return res.status(500).json({ erro: 'Erro ao consultar pré-pedidos', detalhes: error.message });
  } finally {
    client.release();
  }
}
