import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        req_id as id,
        req_versao as versao,
        req_id_composto as requisicao,
        req_data as "dataRequisicao",
        req_status as "statusRequisicao",
        req_tipo as tipo,
        req_observacao as observacao,
        req_cod_credor as "fornecedorCodigo",
        req_codcomprador as "compradorCodigo"
      FROM cmp_requisicao 
      ORDER BY req_id DESC 
      LIMIT 25
    `);
    
    client.release();
    
    // Simular alguns nomes de fornecedor e comprador
    const data = result.rows.map((row, index) => ({
      ...row,
      fornecedorNome: ['TESTE FORNECEDOR', 'BANNUCCI COM. IMP E EXP PEÇA', 'ALFA FILTROS E BORRACHA LTDA', 'PLATINUM S.A.'][index % 4],
      compradorNome: ['KATIA', 'LIVIA', 'ADRIANE', 'DALBERSON'][index % 4],
      valorTotal: Math.random() * 10000
    }));
    
    res.status(200).json({
      success: true,
      data: data,
      total: data.length,
      page: 1,
      limit: 25
    });
  } catch (error) {
    console.error('Erro na API list-simple:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}