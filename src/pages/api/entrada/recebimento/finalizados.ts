/**
 * Endpoint para buscar recebimentos finalizados (historico)
 * GET /api/entrada/recebimento/finalizados
 *
 * Query params:
 * - matricula: matricula do operador
 * - limit: quantidade maxima de registros (default: 10)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface RecebimentoFinalizado {
  id: number;
  numero_entrada: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_recebimento: string;
  tempo_recebimento: string | null;
  tem_divergencia: boolean;
}

interface FinalizadosResponse {
  data: RecebimentoFinalizado[];
  meta: {
    total: number;
  };
}

// Query para buscar recebimentos finalizados
const FINALIZADOS_QUERY = `
  SELECT
    op.id,
    e.numero_entrada,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(NULLIF(e.valor_total::text, '')::numeric, 0) as valor_total,
    COALESCE(item_count.total, 0) as qtd_itens,
    op.fim_recebimento as data_recebimento,
    CASE
      WHEN op.inicio_recebimento IS NOT NULL AND op.fim_recebimento IS NOT NULL
      THEN EXTRACT(EPOCH FROM (op.fim_recebimento - op.inicio_recebimento))
      ELSE NULL
    END as tempo_segundos,
    COALESCE(op.tem_divergencia, false) as tem_divergencia
  FROM entrada_operacoes op
  INNER JOIN entradas_estoque e ON e.id = op.entrada_id
  LEFT JOIN dbnfe_ent n ON NULLIF(e.nfe_id::text, '')::varchar = n.codnfe_ent::varchar
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  LEFT JOIN (
    SELECT entrada_id, COUNT(*) as total
    FROM entrada_itens
    GROUP BY entrada_id
  ) item_count ON item_count.entrada_id = e.id
  WHERE op.recebedor_matricula = $1
    AND op.status = 'RECEBIDO'
  ORDER BY op.fim_recebimento DESC
  LIMIT $2
`;

function formatTempo(segundos: number | null): string | null {
  if (!segundos) return null;

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);

  if (horas > 0) {
    return `${horas}h ${minutos}min`;
  }
  return `${minutos}min`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizadosResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const matricula = req.query.matricula as string;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!matricula?.trim()) {
    return res.status(400).json({ error: 'matricula e obrigatoria' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(FINALIZADOS_QUERY, [matricula.trim(), limit]);

    const finalizados: RecebimentoFinalizado[] = result.rows.map(row => ({
      id: parseInt(row.id),
      numero_entrada: row.numero_entrada,
      fornecedor: row.fornecedor,
      valor_total: parseFloat(row.valor_total || 0),
      qtd_itens: parseInt(row.qtd_itens || 0),
      data_recebimento: row.data_recebimento,
      tempo_recebimento: formatTempo(row.tempo_segundos ? parseFloat(row.tempo_segundos) : null),
      tem_divergencia: row.tem_divergencia,
    }));

    console.log(`Recebimentos finalizados: ${finalizados.length} encontrados para ${matricula}`);

    return res.status(200).json({
      data: finalizados,
      meta: { total: finalizados.length },
    });
  } catch (error) {
    console.error('Erro ao buscar recebimentos finalizados:', error);

    return res.status(500).json({
      error: 'Erro ao buscar recebimentos finalizados',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
