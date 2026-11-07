/**
 * Estoque por armazém no ciclo da entrada, no modelo do Delphi (package ARMAZEM):
 * a mercadoria entra no armazém na geração, como reservada. Mudar o romaneio move saldo e
 * reserva juntos, e a alocação só libera a reserva: o total nunca é somado de novo.
 */

export const ARMAZEM_GERAL = 1001;

type Executor = { query: (sql: string, params?: any[]) => Promise<any> };

async function garantirLinha(db: Executor, codprod: string, armId: number) {
  await db.query(
    `INSERT INTO cad_armazem_produto (arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado)
     VALUES ($1, $2, 0, 0, 'N') ON CONFLICT (arp_arm_id, arp_codprod) DO NOTHING`,
    [armId, codprod],
  );
}

/** Soma ao armazém como reservado (Delphi: ALT_ROMANEIO, na geração da entrada). */
export async function creditarReservado(db: Executor, codprod: string, armId: number, qtd: number) {
  await garantirLinha(db, codprod, armId);
  await db.query(
    `UPDATE cad_armazem_produto
        SET arp_qtest = COALESCE(arp_qtest, 0) + $1,
            arp_qtest_reservada = COALESCE(arp_qtest_reservada, 0) + $1
      WHERE arp_arm_id = $2 AND arp_codprod = $3`,
    [qtd, armId, codprod],
  );
}

/**
 * Deixa `qtd` reservada no armazém `armId`, trazendo de outros armazéns o que faltar
 * (saldo e reserva juntos). A reserva pode estar fora do romaneio em entradas antigas.
 *
 * @returns quanto não tinha reserva em nenhum armazém.
 */
export async function posicionarReserva(
  db: Executor,
  codprod: string,
  armId: number,
  qtd: number,
): Promise<number> {
  await garantirLinha(db, codprod, armId);
  const { rows } = await db.query(
    `SELECT arp_arm_id, COALESCE(arp_qtest_reservada, 0) AS reservada
       FROM cad_armazem_produto
      WHERE arp_codprod = $1 AND COALESCE(arp_qtest_reservada, 0) > 0
      ORDER BY (arp_arm_id = $2) DESC, arp_arm_id
      FOR UPDATE`,
    [codprod, armId],
  );

  let restante = qtd;
  for (const row of rows) {
    if (restante <= 0) break;
    const parte = Math.min(Number(row.reservada), restante);
    if (Number(row.arp_arm_id) !== armId) {
      await db.query(
        `UPDATE cad_armazem_produto
            SET arp_qtest = COALESCE(arp_qtest, 0) - $1,
                arp_qtest_reservada = COALESCE(arp_qtest_reservada, 0) - $1
          WHERE arp_arm_id = $2 AND arp_codprod = $3`,
        [parte, row.arp_arm_id, codprod],
      );
      await creditarReservado(db, codprod, armId, parte);
    }
    restante -= parte;
  }
  return restante;
}

/** Libera a reserva do armazém sem alterar o saldo (Delphi: CONFIRMAR_ESTOQUE_ARMAZEM). */
export async function liberarReserva(db: Executor, codprod: string, armId: number, qtd: number) {
  await db.query(
    `UPDATE cad_armazem_produto
        SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada, 0) - $1, 0)
      WHERE arp_arm_id = $2 AND arp_codprod = $3`,
    [qtd, armId, codprod],
  );
}

/** Soma ao saldo sem reserva: entrada gerada antes deste modelo, que nunca foi ao armazém. */
export async function creditarSemReserva(db: Executor, codprod: string, armId: number, qtd: number) {
  await garantirLinha(db, codprod, armId);
  await db.query(
    `UPDATE cad_armazem_produto SET arp_qtest = COALESCE(arp_qtest, 0) + $1
      WHERE arp_arm_id = $2 AND arp_codprod = $3`,
    [qtd, armId, codprod],
  );
}
