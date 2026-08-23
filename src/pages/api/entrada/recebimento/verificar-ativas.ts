/**
 * Endpoint para verificar se operador tem recebimentos ativos
 * GET /api/entrada/recebimento/verificar-ativas
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
  data_entrada: string;
  status: string;
  status_label: string;
  recebedor_nome: string;
  inicio_recebimento: string;
}

interface VerificarAtivasResponse {
  temRecebimentoAtivo: boolean;
  quantidadeAtivas: number;
  recebimentosAtivos: EntradaAtiva[];
}

// Query para buscar recebimentos ativos do operador
const ATIVAS_QUERY = `
  SELECT
    op.id,
    e.codent as entrada_id,
    e.codent as numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(e.totalnf, 0) as valor_total,
    COALESCE((SELECT COUNT(*) FROM dbitent WHERE codent = e.codent), 0) as qtd_itens,
    e.dtent as data_entrada,
    op.status,
    'Em Recebimento' as status_label,
    op.recebedor_nome,
    op.inicio_recebimento
  FROM entrada_operacoes op
  INNER JOIN dbent e ON e.codent = op.codent
  LEFT JOIN dbnfe_ent n ON n.chave = e.chave
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  WHERE op.recebedor_matricula = $1
    AND op.status = 'EM_RECEBIMENTO'
  ORDER BY op.inicio_recebimento DESC
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

    const recebimentosAtivos: EntradaAtiva[] = result.rows.map(row => ({
      id: parseInt(row.id),
      entrada_id: row.entrada_id, // codent
      numero_entrada: row.numero_entrada,
      nfe_numero: row.nfe_numero,
      nfe_serie: row.nfe_serie,
      fornecedor: row.fornecedor,
      valor_total: parseFloat(row.valor_total || 0),
      qtd_itens: parseInt(row.qtd_itens || 0),
      data_entrada: row.data_entrada,
      status: row.status,
      status_label: row.status_label,
      recebedor_nome: row.recebedor_nome,
      inicio_recebimento: row.inicio_recebimento,
    }));

    return res.status(200).json({
      temRecebimentoAtivo: recebimentosAtivos.length > 0,
      quantidadeAtivas: recebimentosAtivos.length,
      recebimentosAtivos,
    });
  } catch (error) {
    console.error('Erro ao verificar recebimentos ativos:', error);

    return res.status(500).json({
      error: 'Erro ao verificar recebimentos ativos',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
