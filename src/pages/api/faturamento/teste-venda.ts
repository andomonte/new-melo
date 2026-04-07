// pages/api/faturamento/teste-venda.ts
// API simples para testar se a venda existe
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codvenda } = req.query;

  if (!codvenda || typeof codvenda !== 'string') {
    return res.status(400).json({ error: 'Código da venda é obrigatório.' });
  }

  try {
    const client = await getPgPool().connect();

    // Query simples para verificar se a venda existe
    const query = `
      SELECT 
        v.codvenda,
        v.data,
        v.codcli,
        v.total,
        COUNT(i.codprod) as produtos_count
      FROM dbvenda v
      LEFT JOIN dbitvenda i ON i.codvenda = v.codvenda
      WHERE v.codvenda = $1
      GROUP BY v.codvenda, v.data, v.codcli, v.total;
    `;

    console.log('🔍 Testando venda:', codvenda);
    const result = await client.query(query, [codvenda]);
    client.release();

    console.log('📊 Resultado da query:', result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Venda não encontrada',
        codvenda: codvenda,
        debug: 'Venda não existe na tabela dbvenda',
      });
    }

    const venda = result.rows[0];

    return res.status(200).json({
      success: true,
      venda: venda,
      message: `Venda ${codvenda} encontrada com ${venda.produtos_count} produtos`,
    });
  } catch (error) {
    console.error('❌ Erro ao testar venda:', error);
    return res.status(500).json({
      error: 'Erro ao testar venda',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
