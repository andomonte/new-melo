import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para buscar relatório de conciliação de cartão
 * 
 * Retorna registros agrupados por status:
 * - CONCILIADO: Títulos encontrados e vinculados
 * - NAO_LOCALIZADO: Transações não encontradas no sistema
 * - ERRO: Problemas no processamento
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { dataInicio, dataFim, status, filial } = req.query;

  const pool = getPgPool();

  try {
    let query = `
      SELECT 
        id,
        loja,
        filial,
        nsu,
        dt_transacao,
        autorizacao,
        tid,
        bandeira,
        tipo_transacao,
        parcela,
        valor_bruto,
        taxa,
        valor_liquido,
        status,
        cod_receb,
        cod_freceb,
        observacao,
        dt_importacao
      FROM db_manaus.fin_cartao_receb_import
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filtros opcionais
    if (dataInicio) {
      query += ` AND dt_transacao >= $${paramIndex}`;
      params.push(dataInicio);
      paramIndex++;
    }

    if (dataFim) {
      query += ` AND dt_transacao <= $${paramIndex}`;
      params.push(dataFim);
      paramIndex++;
    }

    if (status && status !== 'TODOS') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (filial && filial !== 'TODAS') {
      query += ` AND filial = $${paramIndex}`;
      params.push(filial);
      paramIndex++;
    }

    query += ` ORDER BY dt_transacao DESC, nsu`;

    const resultado = await pool.query(query, params);

    // Estatísticas
    const estatisticas = await pool.query(`
      SELECT 
        status,
        COUNT(*) as quantidade,
        SUM(valor_bruto) as valor_bruto_total,
        SUM(valor_liquido) as valor_liquido_total
      FROM db_manaus.fin_cartao_receb_import
      WHERE 1=1
        ${dataInicio ? `AND dt_transacao >= $1` : ''}
        ${dataFim ? `AND dt_transacao <= $${dataInicio ? 2 : 1}` : ''}
        ${filial && filial !== 'TODAS' ? `AND filial = $${[dataInicio, dataFim].filter(Boolean).length + 1}` : ''}
      GROUP BY status
    `, [...(dataInicio ? [dataInicio] : []), ...(dataFim ? [dataFim] : []), ...(filial && filial !== 'TODAS' ? [filial] : [])]);

    return res.status(200).json({
      registros: resultado.rows,
      estatisticas: estatisticas.rows,
      total: resultado.rows.length
    });

  } catch (error: any) {
    console.error('Erro ao buscar relatório:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar relatório',
      message: error.message 
    });
  }
}
