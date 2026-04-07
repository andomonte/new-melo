/**
 * Endpoint para buscar alocacoes finalizadas (historico)
 * GET /api/entrada/alocacao/finalizados
 *
 * Query params:
 * - matricula: matricula do operador
 * - limit: quantidade maxima de registros (default: 10)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface AlocacaoFinalizada {
  id: number;
  numero_entrada: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_alocacao: string;
  tempo_alocacao: string | null;
  arm_descricao: string | null;
}

interface FinalizadosResponse {
  data: AlocacaoFinalizada[];
  meta: {
    total: number;
  };
}

// Query para buscar alocacoes finalizadas
const FINALIZADOS_QUERY = `
  SELECT
    op.id,
    e.numero_entrada,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(NULLIF(e.valor_total::text, '')::numeric, 0) as valor_total,
    COALESCE(item_count.total, 0) as qtd_itens,
    op.fim_alocacao as data_alocacao,
    CASE
      WHEN op.inicio_alocacao IS NOT NULL AND op.fim_alocacao IS NOT NULL
      THEN EXTRACT(EPOCH FROM (op.fim_alocacao - op.inicio_alocacao))
      ELSE NULL
    END as tempo_segundos,
    arm.arm_descricao
  FROM entrada_operacoes op
  INNER JOIN entradas_estoque e ON e.id = op.entrada_id
  LEFT JOIN dbnfe_ent n ON NULLIF(e.nfe_id::text, '')::varchar = n.codnfe_ent::varchar
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  LEFT JOIN cad_armazem arm ON arm.arm_id = op.arm_id
  LEFT JOIN (
    SELECT entrada_id, COUNT(*) as total
    FROM entrada_itens
    GROUP BY entrada_id
  ) item_count ON item_count.entrada_id = e.id
  WHERE op.alocador_matricula = $1
    AND op.status = 'ALOCADO'
  ORDER BY op.fim_alocacao DESC
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

    const finalizados: AlocacaoFinalizada[] = result.rows.map(row => ({
      id: parseInt(row.id),
      numero_entrada: row.numero_entrada,
      fornecedor: row.fornecedor,
      valor_total: parseFloat(row.valor_total || 0),
      qtd_itens: parseInt(row.qtd_itens || 0),
      data_alocacao: row.data_alocacao,
      tempo_alocacao: formatTempo(row.tempo_segundos ? parseFloat(row.tempo_segundos) : null),
      arm_descricao: row.arm_descricao,
    }));

    console.log(`Alocacoes finalizadas: ${finalizados.length} encontradas para ${matricula}`);

    return res.status(200).json({
      data: finalizados,
      meta: { total: finalizados.length },
    });
  } catch (error) {
    console.error('Erro ao buscar alocacoes finalizadas:', error);

    return res.status(500).json({
      error: 'Erro ao buscar alocacoes finalizadas',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
