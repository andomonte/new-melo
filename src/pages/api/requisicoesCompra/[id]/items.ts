import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    // Get requisition items
    let client;
    try {
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
      }

      // Use the ID as string since database stores req_id as string like '12002010059'
      const requisitionId = id.toString();
      client = await pool.connect();

      console.log('API - Buscando itens para requisição ID (string):', requisitionId);

      // Get items for the specific requisition with product info
      const result = await client.query(`
        SELECT
          ri.itr_req_id as req_id,
          ri.itr_req_versao as req_versao,
          ri.itr_codprod as codprod,
          ri.itr_pr_unitario as preco_unitario,
          ri.itr_quantidade as quantidade,
          ri.itr_base_indicacao as base_indicacao,
          ri.itr_quantidade_atendida as quantidade_atendida,
          ri.itr_quantidade_sugerida as quantidade_sugerida,
          ri.itr_data_sugestao as data_sugestao,
          ri.itr_quantidade_fechada as quantidade_fechada,
          (ri.itr_quantidade * ri.itr_pr_unitario) as preco_total,
          ROW_NUMBER() OVER (ORDER BY ri.itr_codprod) as item_seq,
          ri.itr_base_indicacao as observacao,
          p.descr as produto_nome,
          p.ref as produto_ref,
          p.codmarca as produto_marca_codigo,
          m.descr as produto_marca_nome,
          COALESCE(p.multiplo, 1) as multiplo,
          COALESCE(p.multiplocompra, p.multiplo, 1) as multiplo_compra
        FROM db_manaus.cmp_it_requisicao ri
        LEFT JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
        LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
        WHERE ri.itr_req_id = $1
        ORDER BY ri.itr_codprod
      `, [requisitionId]);

      const items = result.rows || [];
      console.log('API - Encontrados', items.length, 'itens para requisição', requisitionId);
      
      if (items.length === 0) {
        // Vamos verificar se existe algum item na tabela para debug
        const debugResult = await client.query(`
          SELECT itr_req_id as req_id, COUNT(*) as total
          FROM db_manaus.cmp_it_requisicao
          GROUP BY itr_req_id
          ORDER BY itr_req_id DESC
          LIMIT 10
        `);
        console.log('API - DEBUG: Últimas 10 requisições com itens:', debugResult.rows);
      }

      res.status(200).json({
        success: true,
        data: items
      });

    } catch (error) {
      console.error('Error fetching requisition items:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        code: (error as any)?.code
      });
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  } else if (req.method === 'PUT') {
    // Update requisition items
    let client;
    try {
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
      }

      // Use the ID as string since database stores req_id as string like '12002010059'
      const requisitionId = id.toString();
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          message: 'Items deve ser um array'
        });
      }

      client = await pool.connect();

      // Start transaction
      await client.query('BEGIN');

      try {
        // Delete existing items
        await client.query(
          'DELETE FROM db_manaus.cmp_it_requisicao WHERE itr_req_id = $1',
          [requisitionId]
        );

        // Insert new items
        if (items.length > 0) {
          const insertQuery = `
            INSERT INTO db_manaus.cmp_it_requisicao 
            (itr_req_id, itr_req_versao, itr_codprod, itr_quantidade, itr_pr_unitario, itr_base_indicacao, itr_quantidade_atendida)
            VALUES ($1, 1, $2, $3, $4, $5, 0)
          `;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            await client.query(insertQuery, [
              requisitionId,
              item.produtoCodigo || item.codprod || '',
              item.quantidade || 1,
              item.preco_unitario || item.valorUnitario || 0,
              item.observacao || ''
            ]);
          }
        }

        // Commit transaction
        await client.query('COMMIT');

        res.status(200).json({
          success: true,
          message: 'Itens atualizados com sucesso'
        });

      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Error updating requisition items:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  } else {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }
}