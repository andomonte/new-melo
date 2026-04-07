import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    console.log('🏦 API Budget - Buscando dados atuais do budget');
    
    client = await pool.connect();

    // Buscar o budget mais recente
    const budgetQuery = `
      SELECT 
        buc_id,
        buc_data,
        buc_valor as valor_total,
        buc_valor_utilizado as valor_utilizado,
        buc_valor_pendencia as valor_pendente
      FROM db_manaus.fin_budget_compra 
      ORDER BY buc_data DESC 
      LIMIT 1
    `;

    const budgetResult = await client.query(budgetQuery);
    
    if (budgetResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Nenhum budget encontrado' 
      });
    }

    const budgetAtual = budgetResult.rows[0];
    
    // Calcular valores derivados
    const valorTotal = parseFloat(budgetAtual.valor_total || 0);
    const valorUtilizado = parseFloat(budgetAtual.valor_utilizado || 0);
    const valorPendente = parseFloat(budgetAtual.valor_pendente || 0);
    const valorDisponivel = valorTotal - valorUtilizado - valorPendente;
    const percentualUtilizado = valorTotal > 0 ? (valorUtilizado / valorTotal) * 100 : 0;

    // Buscar solicitações de budget adicional recentes
    const solicitacoesQuery = `
      SELECT 
        bua_id,
        bua_valor,
        bua_motivo,
        bua_status,
        bua_data,
        bua_req_id,
        bua_codusr_solicitante
      FROM db_manaus.fin_budget_adicional 
      WHERE bua_buc_id = $1 
      ORDER BY bua_data DESC 
      LIMIT 10
    `;

    const solicitacoesResult = await client.query(solicitacoesQuery, [budgetAtual.buc_id]);

    console.log('✅ API Budget - Dados encontrados:', {
      valorTotal,
      valorUtilizado,
      valorPendente,
      valorDisponivel,
      percentualUtilizado: percentualUtilizado.toFixed(2) + '%'
    });

    const responseData = {
      success: true,
      data: {
        budget: {
          id: budgetAtual.buc_id,
          data: budgetAtual.buc_data,
          valorTotal,
          valorUtilizado,
          valorPendente,
          valorDisponivel,
          percentualUtilizado,
        },
        solicitacoes: solicitacoesResult.rows.map(row => ({
          id: row.bua_id,
          valor: parseFloat(row.bua_valor || 0),
          motivo: row.bua_motivo,
          status: row.bua_status, // A=Aprovado, R=Rejeitado, P=Pendente
          data: row.bua_data,
          requisicaoId: row.bua_req_id,
          solicitante: row.bua_codusr_solicitante
        }))
      }
    };

    res.status(200).json(serializeBigInt(responseData));

  } catch (error) {
    console.error('❌ Erro ao buscar budget:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}