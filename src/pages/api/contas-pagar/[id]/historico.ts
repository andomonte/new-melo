import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

export interface HistoricoPagamento {
  fpg_cof_id: number;
  cod_pgto: string;
  cod_fpgto: string;
  dt_pgto: string;
  valor_pgto: number;
  nro_cheque: string | null;
  cod_conta: string;
  tp_pgto: string;
  cancel: string;
  juros: number;
  multa: number;
  desconto: number;
  username: string;
  forma_descricao?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ historico: HistoricoPagamento[], total_pago: number, qtd_pagamentos: number, qtd_cancelados: number } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da conta é obrigatório' });
  }

  let client;

  try {
    client = await pool.connect();

    // Buscar histórico de pagamentos desta conta (incluindo cancelados)
    const query = `
      SELECT 
        f.fpg_cof_id,
        f.cod_pgto,
        f.cod_fpgto,
        f.dt_pgto,
        f.valor_pgto,
        f.nro_cheque,
        f.cod_conta,
        f.tp_pgto,
        COALESCE(f.cancel, 'N') as cancel,
        COALESCE(f.juros, 0) / 100.0 as juros,
        COALESCE(f.multa, 0) / 100.0 as multa,
        COALESCE(f.desconto, 0) / 100.0 as desconto,
        f.username
      FROM db_manaus.dbfpgto f
      WHERE f.cod_pgto = $1
      ORDER BY f.dt_pgto DESC, f.fpg_cof_id DESC
    `;

    const result = await client.query(query, [id]);

    // Calcular totais (apenas pagamentos não cancelados)
    const total_pago = result.rows
      .filter(row => row.cancel !== 'S')
      .reduce((sum, row) => sum + parseFloat(row.valor_pgto || 0), 0);
    
    const qtd_pagamentos = result.rows.filter(row => row.cancel !== 'S').length;
    const qtd_cancelados = result.rows.filter(row => row.cancel === 'S').length;

    return res.status(200).json({
      historico: result.rows,
      total_pago,
      qtd_pagamentos,
      qtd_cancelados
    });

  } catch (error: any) {
    console.error('Erro ao buscar histórico de pagamentos:', error);
    return res.status(500).json({ 
      error: `Erro ao buscar histórico: ${error.message}`
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
