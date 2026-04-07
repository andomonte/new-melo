import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { 
    valor, 
    motivo, 
    requisicaoId, 
    requisicaoVersao, 
    codusr, 
    filial 
  } = req.body;

  // Validações
  if (!valor || !motivo || !requisicaoId || !requisicaoVersao || !codusr) {
    return res.status(400).json({
      success: false,
      message: 'Dados obrigatórios: valor, motivo, requisicaoId, requisicaoVersao, codusr'
    });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    console.log('💰 API Budget - Solicitando budget adicional:', {
      valor,
      motivo,
      requisicaoId,
      codusr
    });

    client = await pool.connect();

    // Buscar o budget atual para vincular
    const budgetAtualQuery = `
      SELECT buc_id 
      FROM db_manaus.fin_budget_compra 
      ORDER BY buc_data DESC 
      LIMIT 1
    `;
    
    const budgetResult = await client.query(budgetAtualQuery);
    
    if (budgetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Budget atual não encontrado'
      });
    }

    const budgetAtualId = budgetResult.rows[0].buc_id;

    // Gerar novo ID para a solicitação
    const novoIdQuery = `
      SELECT COALESCE(MAX(bua_id), 0) + 1 as novo_id 
      FROM db_manaus.fin_budget_adicional
    `;
    
    const novoIdResult = await client.query(novoIdQuery);
    const novoId = novoIdResult.rows[0].novo_id;

    // Inserir nova solicitação
    const insertQuery = `
      INSERT INTO db_manaus.fin_budget_adicional (
        bua_id,
        bua_valor,
        bua_motivo,
        bua_status,
        bua_data,
        bua_buc_id,
        bua_req_id,
        bua_req_versao,
        bua_codusr_solicitante,
        bua_filial
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      novoId,
      parseFloat(valor),
      motivo,
      'P', // P = Pendente
      budgetAtualId,
      parseInt(requisicaoId),
      parseInt(requisicaoVersao),
      codusr,
      filial || null
    ];

    const insertResult = await client.query(insertQuery, values);
    const solicitacao = insertResult.rows[0];

    console.log('✅ API Budget - Solicitação criada:', {
      id: solicitacao.bua_id,
      valor: solicitacao.bua_valor,
      status: solicitacao.bua_status
    });

    const responseData = {
      success: true,
      message: 'Solicitação de budget adicional criada com sucesso',
      data: {
        id: solicitacao.bua_id,
        valor: parseFloat(solicitacao.bua_valor),
        motivo: solicitacao.bua_motivo,
        status: solicitacao.bua_status,
        data: solicitacao.bua_data,
        requisicaoId: solicitacao.bua_req_id
      }
    };

    res.status(201).json(serializeBigInt(responseData));

  } catch (error) {
    console.error('❌ Erro ao solicitar budget adicional:', error);
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