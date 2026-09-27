// src/lib/comissao/calcularComissao.ts
// Motor de cálculo de comissão do vendedor — espelho da regra do Delphi
// (UniRelFatura.pas / Gerarx_ComissaoVendedorSintetico), validado contra dados reais.
//
// Base: comissão sobre FATURADO, item a item.
//   perc_vendedor = (dbvenda.tele='S') ? dbvend.comtele : dbvend.comnormal
//   se dbfatura.comdif(N/T) > 0 → perc = LEAST(comdif, perc_vendedor)   (teto = % do vendedor)
//   senão se dbitvenda.comissao > 0 → perc = LEAST(item, perc_vendedor)  (usa o MENOR)
//   senão → perc = perc_vendedor
//   comissao_item = (prunit*qtd) * perc / 100
//
// Só entram faturas/vendas NÃO canceladas. Estorno financeiro NÃO afeta (é sobre faturado).
import type { Pool, PoolClient } from 'pg';

type Executor = Pick<Pool | PoolClient, 'query'>;

export interface ItemComissao {
  codvend: string;
  codfat: string;
  codvenda: string;
  codprod: string;
  data_fat: string; // YYYY-MM-DD
  valor_base: number;
  perc: number;
  comissao: number;
}

// CTE reutilizável. $1 = data início (>=), $2 = data fim (<). Placeholders extras devem
// continuar a partir de $3 se o chamador acrescentar filtros.
export const SQL_COMISSAO_ITENS = `
  WITH itens AS (
    SELECT i.codvend, f.codfat, i.codvenda, i.codprod, f.data::date AS data_fat,
           (i.prunit * i.qtd) AS valor_base,
           (CASE WHEN v.tele = 'S' THEN COALESCE(ve.comtele,0) ELSE COALESCE(ve.comnormal,0) END) AS perc_vend,
           (CASE WHEN v.tele = 'S' THEN COALESCE(f.comdift,0) ELSE COALESCE(f.comdifn,0) END) AS comdif,
           COALESCE(i.comissao, 0) AS perc_item
    FROM db_manaus.dbfatura f
    JOIN db_manaus.fatura_venda fv ON fv.codfat = f.codfat
    JOIN db_manaus.dbvenda v ON v.codvenda = fv.codvenda
    JOIN db_manaus.dbitvenda i ON i.codvenda = v.codvenda
    LEFT JOIN db_manaus.dbvend ve ON ve.codvend = i.codvend
    WHERE COALESCE(f.cancel, '') <> 'S'
      AND COALESCE(v.cancel, '') <> 'S'
      AND f.data >= $1 AND f.data < $2
  )
  SELECT codvend, codfat, codvenda, codprod, data_fat, valor_base,
         (CASE
            WHEN comdif > 0 THEN LEAST(comdif, perc_vend)
            WHEN perc_item > 0 THEN LEAST(perc_item, perc_vend)
            ELSE perc_vend
          END) AS perc,
         ROUND(valor_base *
           (CASE
              WHEN comdif > 0 THEN LEAST(comdif, perc_vend)
              WHEN perc_item > 0 THEN LEAST(perc_item, perc_vend)
              ELSE perc_vend
            END) / 100, 2) AS comissao
  FROM itens
`;

/** Comissão por item faturado (não cancelado) no período [inicio, fim). */
export async function comissaoItensFaturados(
  db: Executor,
  inicio: string, // 'YYYY-MM-DD'
  fim: string, // 'YYYY-MM-DD' (exclusivo)
): Promise<ItemComissao[]> {
  const r = await db.query(SQL_COMISSAO_ITENS, [inicio, fim]);
  return r.rows.map((x: any) => ({
    codvend: x.codvend,
    codfat: x.codfat,
    codvenda: x.codvenda,
    codprod: x.codprod,
    data_fat: x.data_fat instanceof Date ? x.data_fat.toISOString().slice(0, 10) : String(x.data_fat),
    valor_base: Number(x.valor_base) || 0,
    perc: Number(x.perc) || 0,
    comissao: Number(x.comissao) || 0,
  }));
}
