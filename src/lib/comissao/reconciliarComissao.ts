// src/lib/comissao/reconciliarComissao.ts
// Reconciliação do razão de comissão (fin_comissao_mov) a partir do estado real.
// Idempotente — pode rodar quantas vezes quiser (só gera o que falta).
//
//  1) CRÉDITO (FAT): cada item faturado (não cancelado) que ainda não tem lançamento
//     de crédito → insere +comissão, datado no faturamento.
//  2) DÉBITO de CANCELAMENTO (CAN): cada crédito cuja fatura está agora cancelada
//     (dbfatura.cancel='S') e que ainda não tem débito → insere −comissão, datado HOJE
//     (data da detecção ≈ data do cancelamento). Assim o estorno cai no mês corrente.
//
// Devolução (DI, proporcional) é tratada em passo separado (reconciliarDevolucoes) — TODO.
import type { Pool, PoolClient } from 'pg';
import { SQL_COMISSAO_ITENS } from './calcularComissao';

type Executor = Pick<Pool | PoolClient, 'query'>;

export interface ResultadoReconciliacao {
  creditos: number;
  debitosCancelamento: number;
}

/**
 * Reconcilia o razão para o período [inicio, fim). Para carga histórica, passe um
 * período amplo (ex.: '2000-01-01' até amanhã).
 */
export async function reconciliarComissao(
  db: Executor,
  inicio: string, // 'YYYY-MM-DD'
  fim: string, // 'YYYY-MM-DD' (exclusivo)
): Promise<ResultadoReconciliacao> {
  // 1) CRÉDITOS — só itens com vendedor e comissão > 0 (0 não vira lançamento).
  const cred = await db.query(
    `
    INSERT INTO db_manaus.fin_comissao_mov
      (codvend, tipo_pessoa, tipo, codfat, codvenda, codprod,
       valor_base, perc, valor_comissao, data_mov, data_origem, status)
    SELECT c.codvend, 'V', 'FAT', c.codfat, c.codvenda, c.codprod,
           c.valor_base, c.perc, c.comissao, c.data_fat, c.data_fat, 'A'
    FROM ( ${SQL_COMISSAO_ITENS} ) c
    WHERE c.codvend IS NOT NULL
      AND c.comissao <> 0
      AND NOT EXISTS (
        SELECT 1 FROM db_manaus.fin_comissao_mov m
        WHERE m.tipo = 'FAT' AND m.tipo_pessoa = 'V'
          AND m.codfat = c.codfat AND m.codvenda = c.codvenda
          AND m.codprod = c.codprod AND m.codvend = c.codvend
      )
    `,
    [inicio, fim],
  );

  // 2) DÉBITOS de CANCELAMENTO — crédito existente cuja fatura foi cancelada, sem débito ainda.
  const deb = await db.query(
    `
    INSERT INTO db_manaus.fin_comissao_mov
      (codvend, tipo_pessoa, tipo, codfat, codvenda, codprod,
       valor_base, perc, valor_comissao, data_mov, data_origem, status, obs)
    SELECT m.codvend, m.tipo_pessoa, 'CAN', m.codfat, m.codvenda, m.codprod,
           m.valor_base, m.perc, -m.valor_comissao, CURRENT_DATE, m.data_origem, 'A',
           'Estorno por cancelamento da fatura'
    FROM db_manaus.fin_comissao_mov m
    JOIN db_manaus.dbfatura f ON f.codfat = m.codfat AND f.cancel = 'S'
    WHERE m.tipo = 'FAT'
      AND NOT EXISTS (
        SELECT 1 FROM db_manaus.fin_comissao_mov d
        WHERE d.tipo = 'CAN' AND d.codfat = m.codfat AND d.codvenda = m.codvenda
          AND d.codprod = m.codprod AND d.codvend = m.codvend AND d.tipo_pessoa = m.tipo_pessoa
      )
    `,
  );

  return { creditos: cred.rowCount || 0, debitosCancelamento: deb.rowCount || 0 };
}
