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
  entrada_id: string; // codent
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
    e.codent as entrada_id,
    e.codent as numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(e.totalnf, 0) as valor_total,
    COALESCE((SELECT COUNT(*) FROM db_manaus.dbitent WHERE codent = e.codent), 0) as qtd_itens,
    op.fim_recebimento as data_recebimento,
    op.status,
    'Em Alocacao' as status_label,
    op.alocador_nome,
    op.inicio_alocacao,
    COALESCE(op.tem_divergencia, false) as tem_divergencia
  FROM db_manaus.entrada_operacoes op
  INNER JOIN db_manaus.dbent e ON e.codent = op.codent
  LEFT JOIN db_manaus.dbnfe_ent n ON n.chave = e.chave
  LEFT JOIN db_manaus.dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
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
      entrada_id: row.entrada_id, // codent
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
