import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Nota: Filtros de status e tipo_envio foram removidos pois não existem campos correspondentes
    // nas tabelas dbremessa_arquivo e dbremessa_detalhe
    const params: any[] = [];
    let paramIndex = 1;

    // Buscar histórico da tabela dbremessa_detalhe
    const query = `
      SELECT
        d."CODREMESSA" as id,
        NOW() as data_envio,
        NULL as periodo_inicio,
        NULL as periodo_fim,
        'download' as tipo_envio,
        NULL as email_destino,
        COUNT(d."CODREMESSA_DETALHE") as registros_enviados,
        SUM(d."VALOR") as valor_total,
        CONCAT('remessa_', d."CODREMESSA", '.txt') as nome_arquivo,
        'sucesso' as status,
        NULL as erro_descricao,
        'SYSTEM' as usuario_nome
      FROM dbremessa_detalhe d
      GROUP BY d."CODREMESSA"
      ORDER BY d."CODREMESSA" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Buscar total de registros
    const countQuery = `
      SELECT COUNT(DISTINCT "CODREMESSA") as total
      FROM dbremessa_detalhe
    `;

    const countParams = params.slice(0, -2); // Remove limit e offset
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.status(200).json({
      historico: result.rows,
      paginacao: {
        pagina: parseInt(page as string),
        limite: parseInt(limit as string),
        total,
        totalPaginas: totalPages
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar histórico de remessas:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}