/**
 * Endpoint para verificar se operador tem alocacoes ativas
 * GET /api/entrada/alocacao/verificar-ativas
 *
 * Query params:
 * - matricula: matricula do operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface EntradaAtiva {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_recebimento: string;
  status: string;
  status_label: string;
  alocador_nome: string;
  inicio_alocacao: string;
  tem_divergencia: boolean;
}

interface VerificarAtivasResponse {
  temAlocacaoAtiva: boolean;
  quantidadeAtivas: number;
  alocacoesAtivas: EntradaAtiva[];
}

// Query para buscar alocacoes ativas do operador
const ATIVAS_QUERY = `
  SELECT
    op.id,
    e.id as entrada_id,
    e.numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(e.valor_total, 0) as valor_total,
    COALESCE(item_count.total, 0) as qtd_itens,
    op.fim_recebimento as data_recebimento,
    op.status,
    'Em Alocacao' as status_label,
    op.alocador_nome,
    op.inicio_alocacao,
    COALESCE(op.tem_divergencia, false) as tem_divergencia
  FROM entrada_operacoes op
  INNER JOIN entradas_estoque e ON e.id = op.entrada_id
  LEFT JOIN dbnfe_ent n ON e.nfe_id::varchar = n.codnfe_ent::varchar
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  LEFT JOIN (
    SELECT entrada_id, COUNT(*) as total
    FROM entrada_itens
    GROUP BY entrada_id
  ) item_count ON item_count.entrada_id = e.id
  WHERE op.alocador_matricula = $1
    AND op.status = 'EM_ALOCACAO'
  ORDER BY op.inicio_alocacao DESC
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerificarAtivasResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const matricula = req.query.matricula as string;

  if (!matricula?.trim()) {
    return res.status(400).json({ error: 'matricula e obrigatoria' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(ATIVAS_QUERY, [matricula.trim()]);

    const alocacoesAtivas: EntradaAtiva[] = result.rows.map(row => ({
      id: parseInt(row.id),
      entrada_id: parseInt(row.entrada_id),
      numero_entrada: row.numero_entrada,
      nfe_numero: row.nfe_numero,
      nfe_serie: row.nfe_serie,
      fornecedor: row.fornecedor,
      valor_total: parseFloat(row.valor_total || 0),
      qtd_itens: parseInt(row.qtd_itens || 0),
      data_recebimento: row.data_recebimento,
      status: row.status,
      status_label: row.status_label,
      alocador_nome: row.alocador_nome,
      inicio_alocacao: row.inicio_alocacao,
      tem_divergencia: row.tem_divergencia,
    }));

    return res.status(200).json({
      temAlocacaoAtiva: alocacoesAtivas.length > 0,
      quantidadeAtivas: alocacoesAtivas.length,
      alocacoesAtivas,
    });
  } catch (error) {
    console.error('Erro ao verificar alocacoes ativas:', error);

    return res.status(500).json({
      error: 'Erro ao verificar alocacoes ativas',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
