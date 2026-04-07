import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para consultar demanda de produto
 *
 * Mostra demanda mensal, pendências e transferências por filial
 *
 * POST /api/produtos/demanda
 * Body: {
 *   codprod: string,
 *   filiais: {
 *     portoVelho: boolean,
 *     fortaleza: boolean,
 *     recife: boolean,
 *     joaoPessoa: boolean
 *   }
 * }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod, filiais } = req.body;

  if (!codprod) {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  const pool = getPgPool();

  try {
    // Gerar últimos 12 meses
    const meses = [];
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = data.getFullYear();
      const mes = (data.getMonth() + 1).toString().padStart(2, '0');
      meses.push(`${ano}/${mes}`);
    }

    // Buscar demanda por mês
    // NOTA: Esta query precisa ser ajustada conforme a estrutura real das tabelas
    // Por enquanto está usando uma estrutura genérica
    const demandaPromises = meses.map(async (periodo) => {
      const [ano, mes] = periodo.split('/');

      // Query para buscar vendas/pedidos do mês
      // AJUSTAR: Nome das tabelas e campos conforme o banco real
      const query = `
        SELECT
          COALESCE(SUM(quantidade), 0) as demanda,
          0 as pendencia,
          0 as mao_gar,
          0 as pph_transf,
          0 as rec_transf,
          0 as fl2_transf,
          0 as dp5_transf
        FROM db_manaus.dbvendaitens
        WHERE codprod = $1
          AND EXTRACT(YEAR FROM data) = $2
          AND EXTRACT(MONTH FROM data) = $3
      `;

      try {
        const result = await pool.query(query, [codprod, parseInt(ano), parseInt(mes)]);
        const row = result.rows[0] || {
          demanda: 0,
          pendencia: 0,
          mao_gar: 0,
          pph_transf: 0,
          rec_transf: 0,
          fl2_transf: 0,
          dp5_transf: 0,
        };

        return {
          periodo,
          demanda: parseFloat(row.demanda) || 0,
          pendencia: parseFloat(row.pendencia) || 0,
          mao_gar: parseFloat(row.mao_gar) || 0,
          pph_transf: parseFloat(row.pph_transf) || 0,
          rec_transf: parseFloat(row.rec_transf) || 0,
          fl2_transf: parseFloat(row.fl2_transf) || 0,
          dp5_transf: parseFloat(row.dp5_transf) || 0,
          total:
            (parseFloat(row.demanda) || 0) +
            (parseFloat(row.pendencia) || 0) +
            (parseFloat(row.pph_transf) || 0) +
            (parseFloat(row.rec_transf) || 0) +
            (parseFloat(row.fl2_transf) || 0) +
            (parseFloat(row.dp5_transf) || 0),
        };
      } catch (error) {
        console.error(`Erro ao buscar demanda para ${periodo}:`, error);
        return {
          periodo,
          demanda: 0,
          pendencia: 0,
          mao_gar: 0,
          pph_transf: 0,
          rec_transf: 0,
          fl2_transf: 0,
          dp5_transf: 0,
          total: 0,
        };
      }
    });

    const demanda = await Promise.all(demandaPromises);

    // Calcular estatísticas
    const totalDemanda12Meses = demanda.reduce((sum, item) => sum + item.demanda, 0);
    const totalMao12Meses = demanda.reduce((sum, item) => sum + item.mao_gar, 0);
    const ultimos3Meses = demanda
      .slice(-3)
      .reduce((sum, item) => sum + item.demanda, 0);

    return res.status(200).json({
      demanda,
      stats: {
        demanda12Meses: totalDemanda12Meses,
        mao12Meses: totalMao12Meses,
        ultimos3Meses: ultimos3Meses,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar demanda:', error);
    return res.status(500).json({
      error: 'Erro ao buscar demanda',
      message: error.message,
    });
  }
}
