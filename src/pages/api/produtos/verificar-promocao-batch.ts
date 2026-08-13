import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * POST /api/produtos/verificar-promocao-batch
 * Body: { codprods: string[] }
 * Retorna: { [codprod]: { id_promocao_item, id_promocao, nome_promocao, ativa, valor_desconto_item, tipo_desconto_item,
 *            qtde_minima_item, qtde_maxima_item, qtd_total_item, qtdvendido, valor_desconto_promocao_geral,
 *            tipo_desconto_promocao_geral, permite_balcao } }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprods } = req.body || {};
  if (!Array.isArray(codprods) || codprods.length === 0) {
    return res.status(200).json({});
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const placeholders = codprods.map((_, i) => `$${i + 2}`).join(',');
    const now = new Date().toISOString();

    const result = await client.query(
      `SELECT
          dpi.id_promocao_item,
          dpi.codprod,
          dpi.valor_desconto_item,
          dpi.tipo_desconto_item,
          dpi.qtde_minima_item,
          dpi.qtde_maxima_item,
          dpi.qtd_total_item,
          dpi.qtdvendido,
          dp.id_promocao,
          dp.nome_promocao,
          dp.ativa,
          dp.valor_desconto AS valor_desconto_promocao_geral,
          dp.tipo_desconto AS tipo_desconto_promocao_geral,
          COALESCE(dp.permite_balcao, false) AS permite_balcao
       FROM dbpromocao_item dpi
       JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
       WHERE dp.ativa = TRUE
         AND $1 BETWEEN dp.data_inicio AND dp.data_fim
         AND dpi.codprod IN (${placeholders})`,
      [now, ...codprods],
    );

    // Agrupar por codprod (pega a primeira promoção ativa de cada)
    const map: Record<string, any> = {};
    for (const row of result.rows) {
      const cod = String(row.codprod);
      if (!map[cod]) {
        map[cod] = serializeBigInt(row);
      }
    }

    res.status(200).json(map);
  } catch (error: any) {
    console.error('Erro ao verificar promoções batch:', error);
    res.status(200).json({});
  } finally {
    client.release();
  }
}
