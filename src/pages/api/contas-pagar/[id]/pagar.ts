import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface DadosPagamento {
  valor_pago: number;
  dt_pgto: string;
  valor_juros?: number;
  obs_pagamento?: string;
  usuario: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    const dadosPagamento: DadosPagamento = req.body;

    // Validações
    if (!dadosPagamento.valor_pago || !dadosPagamento.dt_pgto || !dadosPagamento.usuario) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: valor_pago, dt_pgto, usuario'
      });
    }

    // Verificar se conta existe e não está paga
    const contaQuery = `
      SELECT
        cod_pgto,
        paga,
        cancel,
        valor_pgto,
        valor_pago,
        cod_credor,
        nro_nf
      FROM dbpgto
      WHERE cod_pgto = $1
    `;

    const contaResult = await client.query(contaQuery, [id]);

    if (contaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Conta a pagar não encontrada'
      });
    }

    const conta = contaResult.rows[0];

    if (conta.cancel === 'S') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Conta cancelada, não pode ser paga'
      });
    }

    if (conta.paga === 'S') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Conta já está paga'
      });
    }

    const valorTotal = parseFloat(conta.valor_pgto);
    const valorPagoAnterior = parseFloat(conta.valor_pago || 0);
    const novoValorPago = parseFloat(dadosPagamento.valor_pago);
    const valorJuros = parseFloat(dadosPagamento.valor_juros || 0);

    // Calcular valores
    const valorTotalComJuros = valorTotal + valorJuros;
    const valorPagoTotal = valorPagoAnterior + novoValorPago;

    // Determinar se está totalmente paga
    const totalmentePaga = valorPagoTotal >= valorTotalComJuros;

    // Atualizar conta a pagar
    const updateQuery = `
      UPDATE dbpgto SET
        valor_pago = $1,
        valor_juros = COALESCE($2, valor_juros, 0),
        dt_pgto = $3,
        paga = $4,
        obs = CASE
          WHEN obs IS NULL OR obs = '' THEN $5
          ELSE obs || ' | ' || $5
        END
      WHERE cod_pgto = $6
    `;

    const obsUpdate = dadosPagamento.obs_pagamento ||
      `Pagamento R$ ${novoValorPago.toFixed(2)} em ${dadosPagamento.dt_pgto} por ${dadosPagamento.usuario}`;

    await client.query(updateQuery, [
      valorPagoTotal,
      dadosPagamento.valor_juros || null,
      dadosPagamento.dt_pgto,
      totalmentePaga ? 'S' : 'N',
      obsUpdate,
      id
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: totalmentePaga ? 'Conta paga com sucesso' : 'Pagamento parcial registrado',
      data: {
        cod_pgto: id,
        totalmente_paga: totalmentePaga,
        valor_pago_total: valorPagoTotal,
        valor_restante: Math.max(0, valorTotalComJuros - valorPagoTotal)
      }
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
