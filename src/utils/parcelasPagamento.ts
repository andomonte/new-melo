import { getPgPool } from '@/lib/pg';

/**
 * Calcula a data de vencimento baseada na quantidade de dias a partir de hoje
 */
export function calcularDataVencimento(dias: number): Date {
  const hoje = new Date();
  const dataVencimento = new Date(hoje);
  dataVencimento.setDate(hoje.getDate() + dias);
  return dataVencimento;
}

/**
 * Salva as parcelas  pagamento na tabela dbprazo_pagamento
 */
export async function salvarParcelasPagamento(codvenda: string, parcelas: Array<{ dia: number }>): Promise<void> {
  const pool = getPgPool();

  // Primeiro, remove as parcelas existentes para esta venda
  await pool.query('DELETE FROM dbprazo_pagamento WHERE codvenda = $1', [codvenda]);

  // Insere as novas parcelas
  for (const parcela of parcelas) {
    const dataVencimento = calcularDataVencimento(parcela.dia);

    await pool.query(
      'INSERT INTO dbprazo_pagamento (data, dia, codvenda) VALUES ($1, $2, $3)',
      [dataVencimento, parcela.dia, codvenda]
    );
  }
}

/**
 * Atualiza uma parcela específica, recalculando a data de vencimento
 */
export async function atualizarParcelaPagamento(id: number, novoDia: number): Promise<void> {
  const pool = getPgPool();
  const novaDataVencimento = calcularDataVencimento(novoDia);

  await pool.query(
    'UPDATE dbprazo_pagamento SET data = $1, dia = $2 WHERE id = $3',
    [novaDataVencimento, novoDia, id]
  );
}

/**
 * Busca todas as parcelas de uma venda
 */
export async function buscarParcelasPagamento(codvenda: string): Promise<Array<{ id: number; data: Date; dia: number; codvenda: string }>> {
  const pool = getPgPool();

  const result = await pool.query(
    'SELECT id, data, dia, codvenda FROM dbprazo_pagamento WHERE codvenda = $1 ORDER BY data',
    [codvenda]
  );

  return result.rows;
}

/**
 * Remove todas as parcelas de uma venda
 */
export async function removerParcelasPagamento(codvenda: string): Promise<void> {
  const pool = getPgPool();
  await pool.query('DELETE FROM dbprazo_pagamento WHERE codvenda = $1', [codvenda]);
}

/**
 * Remove uma parcela específica por ID
 */
export async function removerParcelaPagamento(id: number): Promise<void> {
  const pool = getPgPool();
  await pool.query('DELETE FROM dbprazo_pagamento WHERE id = $1', [id]);
}