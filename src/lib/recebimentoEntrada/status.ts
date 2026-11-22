/**
 * Situações do fluxo físico da entrada (dbent_recebimento.status) que permitem
 * INICIAR o recebimento.
 *
 * Regra desde 22/11/2026: entrada gerada já pode ser recebida, com ou sem preço
 * confirmado. Antes era preciso "Confirmar Preço" e "Confirmar Estoque" (só
 * AGUARDANDO_RECEBIMENTO). O preço confirmado é marcado por
 * dbent_recebimento.data_confirmacao_preco, independente desta situação.
 */
export const STATUS_PODE_RECEBER = ['PENDENTE', 'PRECO_CONFIRMADO', 'AGUARDANDO_RECEBIMENTO'];

/**
 * A ALOCAÇÃO é o passo que libera o produto para venda (solta a reserva), então ela
 * exige o preço confirmado (Confirmar Preço ou Confirmar sem Custo) — no Delphi o
 * estoque só era liberado depois do preço. Decisão de 22/11/2026, a validar com a Melo.
 * Confirmado = data_confirmacao_preco preenchida, ou dbent.status='F' (modelo anterior).
 */
export async function precoConfirmadoDaEntrada(
  client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  codent: string,
): Promise<boolean> {
  const r = await client.query(
    `SELECT (rec.data_confirmacao_preco IS NOT NULL OR e.status = 'F') AS ok
       FROM dbent e
       LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
      WHERE e.codent = $1`,
    [codent],
  );
  return r.rows[0]?.ok === true;
}

export const MSG_PRECO_PENDENTE_ALOCACAO = (codent: string) =>
  `A entrada ${codent} ainda não teve o preço confirmado. A alocação libera o produto para venda e só pode ser feita depois do "Confirmar Preço" (ou "Confirmar sem Custo") na tela Compras > Entradas.`;
