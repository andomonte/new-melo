import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/vendas/notificacoes
 * Retorna contadores para o sininho de notificação:
 * - Vendas bloqueadas aguardando desbloqueio
 * - Promoções expirando por data (próximos 7 dias, exceto 1 dia)
 * - Promoções com estoque acabando (menos de 10% restante)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // 1. Vendas bloqueadas
    const bloqueadas = await client.query(
      `SELECT COUNT(*) as qtd FROM dbvenda WHERE status = 'B'`,
    );

    // 2. Promoções expirando por data (entre 2 e 7 dias para expirar)
    const promoExpirando = await client.query(
      `SELECT id_promocao, nome_promocao, data_fim,
              (data_fim::date - CURRENT_DATE) as dias_restantes
       FROM dbpromocao
       WHERE ativa = TRUE
         AND data_fim::date >= CURRENT_DATE
         AND (data_fim::date - CURRENT_DATE) BETWEEN 2 AND 7
       ORDER BY data_fim ASC`,
    );

    // 3. Promoções com estoque acabando (qtd vendida > 90% do máximo)
    const promoEstoque = await client.query(
      `SELECT p.id_promocao, p.nome_promocao,
              pi.codprod, pi.qtd_total_item, pi.qtdVendido,
              CASE WHEN pi.qtd_total_item > 0
                THEN ROUND((pi.qtdVendido::numeric / pi.qtd_total_item) * 100)
                ELSE 0 END as pct_vendido
       FROM dbpromocao p
       JOIN dbpromocao_item pi ON pi.id_promocao = p.id_promocao
       WHERE p.ativa = TRUE
         AND p.data_fim::date >= CURRENT_DATE
         AND pi.qtd_total_item > 0
         AND pi.qtdVendido >= (pi.qtd_total_item * 0.9)
       ORDER BY pct_vendido DESC`,
    );

    const totalNotificacoes =
      Number(bloqueadas.rows[0].qtd) +
      promoExpirando.rows.length +
      promoEstoque.rows.length;

    return res.status(200).json({
      total: totalNotificacoes,
      bloqueadas: {
        qtd: Number(bloqueadas.rows[0].qtd),
      },
      promoExpirando: {
        qtd: promoExpirando.rows.length,
        items: promoExpirando.rows,
      },
      promoEstoque: {
        qtd: promoEstoque.rows.length,
        items: promoEstoque.rows,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar notificações:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
