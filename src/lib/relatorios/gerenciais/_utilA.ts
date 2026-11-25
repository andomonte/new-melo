/**
 * Apoio dos relatórios do lote A (vendas/comissão/metas). Só funções que montam trechos de SQL
 * FIXOS (sem valor do usuário) ou tratam o resultado — os valores vão sempre como parâmetro.
 */

import type { Consultavel } from '../tipos';

/** Fuso das datas de venda (dbvenda.data é timestamptz). */
export const FUSO = 'America/Manaus';

/**
 * Aviso de lacuna no histórico de vendas do PG (o migrado vai até 06/2025 e o web grava desde
 * 08/2026): lista os meses do período com menos de `minimo` vendas. Devolve [] se não houver.
 */
export async function avisoLacunaVendas(db: Consultavel, de: string, ate: string, minimo = 50): Promise<string[]> {
  const r = await db.query(
    `SELECT to_char(m, 'MM/YYYY') AS mes
       FROM generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') m
       LEFT JOIN (SELECT date_trunc('month', data AT TIME ZONE '${FUSO}') AS mm, count(*) AS n
                    FROM dbvenda
                   WHERE data >= ($1::date::timestamp AT TIME ZONE '${FUSO}') AND data < (($2::date + 1)::timestamp AT TIME ZONE '${FUSO}')
                   GROUP BY 1) v ON v.mm = m
      WHERE COALESCE(v.n, 0) < $3
      ORDER BY m`, [de, ate, minimo]);
  if (!r.rows.length) return [];
  const meses = r.rows.map((x) => x.mes);
  const lista = meses.length > 8 ? `${meses.slice(0, 8).join(', ')}… (${meses.length} meses)` : meses.join(', ');
  return [`Pouca ou nenhuma venda no banco novo em ${lista}: o histórico migrado vai até 06/2025 e o web grava desde 08/2026. O resultado desses meses não reflete o movimento real.`];
}

/**
 * Filtro de período para uma coluna de data/timestamp, por dia (inclusivo nas duas pontas).
 * `comFuso` = coluna timestamptz (converte o dia local para o instante certo).
 */
export function periodo(col: string, pDe: number, pAte: number, comFuso = false): string {
  if (comFuso) {
    return `${col} >= ($${pDe}::date::timestamp AT TIME ZONE '${FUSO}') AND ${col} < (($${pAte}::date + 1)::timestamp AT TIME ZONE '${FUSO}')`;
  }
  return `${col} >= $${pDe}::date AND ${col} < ($${pAte}::date + 1)`;
}

/** Dia local (AAAA-MM-DD, texto) de uma coluna; `comFuso` para timestamptz. */
export const diaIso = (col: string, comFuso = false) =>
  `to_char(${comFuso ? `(${col} AT TIME ZONE '${FUSO}')` : col}, 'YYYY-MM-DD')`;

/** Dia local DD/MM/AAAA (texto) — usado como rótulo de quebra. */
export const diaBR = (col: string, comFuso = false) =>
  `to_char(${comFuso ? `(${col} AT TIME ZONE '${FUSO}')` : col}, 'DD/MM/YYYY')`;

/** Hora local HH:MI (texto). */
export const hora = (col: string, comFuso = false) =>
  `to_char(${comFuso ? `(${col} AT TIME ZONE '${FUSO}')` : col}, 'HH24:MI')`;

/**
 * Situação da venda em texto (dbvenda.status/cancel), no espírito do Delphi
 * (cancelada / aguardando liberação / liberada aguardando faturamento / faturada).
 */
export const situacaoVenda = (v: string) => `CASE
    WHEN ${v}.cancel = 'S' OR ${v}.status = 'C' THEN 'Cancelada'
    WHEN ${v}.status = 'F' THEN 'Faturada'
    WHEN ${v}.status = 'B' THEN 'Aguardando liberação'
    WHEN ${v}.status IN ('N', 'L', 'I', 'S') THEN 'Liberada, aguardando faturamento'
    ELSE 'Status ' || COALESCE(${v}.status, '-') END`;

/** Tipos de documento de venda do Delphi (dbvenda.tipo). */
export const OPCOES_TIPO_VENDA = [
  { valor: '1', rotulo: 'D1' },
  { valor: 'P', rotulo: 'Pré-pedido' },
  { valor: 'C', rotulo: 'Cautela' },
];

/** Usuários sem duplicidade (dbusuario tem codusr repetido). Junte por lpad(codusr, 4, '0'). */
export const CTE_USUARIOS = `usr AS (SELECT codusr, min(nomeusr) AS nomeusr FROM dbusuario GROUP BY codusr)`;

/** Converte para número os campos indicados (pg devolve numeric/bigint como texto). */
export function numerar<T extends Record<string, any>>(rows: T[], campos: string[]): T[] {
  for (const r of rows) for (const c of campos) if (r[c] != null) (r as any)[c] = Number(r[c]);
  return rows;
}

/** Moeda pt-BR para linhas de resumo. */
export const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quantidade pt-BR para linhas de resumo. */
export const qtd = (v: number) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
