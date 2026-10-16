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
  res: NextApiResponse<{ historico: HistoricoPagamento[], total_pago: number, total_juros: number, total_multa: number, total_desconto: number, total_geral: number, qtd_pagamentos: number, qtd_cancelados: number } | { error: string }>
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
      FROM dbfpgto f
      WHERE f.cod_pgto = $1
      ORDER BY f.dt_pgto DESC, f.fpg_cof_id DESC
    `;

    const result = await client.query(query, [id]);

    // Calcular totais (apenas pagamentos não cancelados).
    // total_pago = principal (valor_pgto) — usado para o saldo (saldo = original - principal).
    // total_geral = o que foi EFETIVAMENTE pago = principal + juros + multa - desconto.
    const naoCancelados = result.rows.filter(row => row.cancel !== 'S');
    const soma = (f: (r: any) => number) => naoCancelados.reduce((s, r) => s + (f(r) || 0), 0);
    const total_pago = soma(r => parseFloat(r.valor_pgto || 0));
    const total_juros = soma(r => parseFloat(r.juros || 0));
    const total_multa = soma(r => parseFloat(r.multa || 0));
    const total_desconto = soma(r => parseFloat(r.desconto || 0));
    const total_geral = total_pago + total_juros + total_multa - total_desconto;

    const qtd_pagamentos = naoCancelados.length;
    const qtd_cancelados = result.rows.filter(row => row.cancel === 'S').length;

    return res.status(200).json({
      historico: result.rows,
      total_pago,
      total_juros,
      total_multa,
      total_desconto,
      total_geral,
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
