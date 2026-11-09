/**
 * Regras de cancelamento da NOTA DE NACIONALIZAÇÃO (fatura com importacao_id).
 *
 * - A nota de nacionalização não baixa estoque (as peças entram pela ENTRADA da
 *   importação). Então cancelar a fatura nunca devolve estoque, e a venda por trás
 *   é cancelada junto (não volta para "Liberada", senão viraria venda nacional solta).
 * - Se a entrada da DI já foi gerada, a nota não pode ser cancelada: a entrada ficaria
 *   apontando para uma nota cancelada.
 */
import type { Pool, PoolClient } from 'pg';

type Db = Pool | PoolClient;

export interface InfoNacionalizacao {
  importacaoId: number;
  nroDi: string | null;
  /** Mensagem de bloqueio quando a entrada da DI já foi gerada; null se pode cancelar. */
  bloqueio: string | null;
}

/** null quando a fatura não é de nacionalização. */
export async function infoNacionalizacaoDaFatura(db: Db, codfat: string): Promise<InfoNacionalizacao | null> {
  const f = await db.query(
    `SELECT f.importacao_id, i.nro_di, i.status
       FROM dbfatura f
       LEFT JOIN dbent_importacao i ON i.id = f.importacao_id
      WHERE f.codfat = $1 AND f.importacao_id IS NOT NULL`,
    [String(codfat)],
  );
  if (f.rows.length === 0) return null;
  const { importacao_id, nro_di, status } = f.rows[0];

  // Entrada gerada: a DI vai para 'E' no gerar-entradas, e cada pré-entrada leva
  // infcpl 'IMPORTACAO:<id>:<fatura>'. Confere os dois (a DI pode ter voltado de status).
  const ent = await db.query(
    `SELECT count(*)::int AS n FROM dbnfe_ent WHERE infcpl LIKE $1`,
    [`IMPORTACAO:${importacao_id}:%`],
  );
  const temEntrada = status === 'E' || Number(ent.rows[0]?.n) > 0;

  return {
    importacaoId: Number(importacao_id),
    nroDi: nro_di ?? null,
    bloqueio: temEntrada
      ? `A entrada da importação (DI ${nro_di ?? importacao_id}) já foi gerada a partir desta nota de ` +
        'nacionalização. Cancele/estorne a entrada antes de cancelar a nota.'
      : null,
  };
}
