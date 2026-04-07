/**
 * Endpoint para listar entradas disponiveis para recebimento
 * GET /api/entrada/recebimento/entradas
 *
 * Query params:
 * - nomeRecebedor: filtra entradas em recebimento por este operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface EntradaParaReceber {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_entrada: string;
  status: string;
  status_label: string;
  recebedor_nome?: string;
  inicio_recebimento?: string;
  preco_confirmado?: boolean;
  data_confirmacao_preco?: string;
}

interface EntradasResponse {
  data: EntradaParaReceber[];
  meta: {
    total: number;
  };
}

// Query para buscar entradas com status de operacao
const ENTRADAS_QUERY = `
  SELECT
    COALESCE(op.id, 0) as id,
    e.id as entrada_id,
    e.numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    CASE
      WHEN e.valor_total IS NULL OR e.valor_total::text = '' THEN 0
      ELSE e.valor_total::numeric
    END as valor_total,
    COALESCE(item_count.total, 0) as qtd_itens,
    e.created_at as data_entrada,
    COALESCE(op.status, 'AGUARDANDO_RECEBIMENTO') as status,
    CASE COALESCE(op.status, 'AGUARDANDO_RECEBIMENTO')
      WHEN 'AGUARDANDO_RECEBIMENTO' THEN 'Aguardando'
      WHEN 'EM_RECEBIMENTO' THEN 'Em Recebimento'
      WHEN 'RECEBIDO' THEN 'Recebido'
      ELSE 'Desconhecido'
    END as status_label,
    op.recebedor_nome,
    op.inicio_recebimento,
    e.data_confirmacao_preco IS NOT NULL as preco_confirmado,
    e.data_confirmacao_preco
  FROM entradas_estoque e
  LEFT JOIN dbnfe_ent n ON e.nfe_id IS NOT NULL AND e.nfe_id::text <> '' AND e.nfe_id::text = n.codnfe_ent::text
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  LEFT JOIN entrada_operacoes op ON op.entrada_id = e.id
  LEFT JOIN (
    SELECT entrada_id, COUNT(*) as total
    FROM entrada_itens
    GROUP BY entrada_id
  ) item_count ON item_count.entrada_id = e.id
  WHERE
    (op.status IS NULL OR op.status IN ('AGUARDANDO_RECEBIMENTO', 'EM_RECEBIMENTO'))
    AND ($1 = '' OR op.recebedor_nome = $1 OR op.recebedor_nome IS NULL)
  ORDER BY
    CASE WHEN op.recebedor_nome = $1 AND op.status = 'EM_RECEBIMENTO' THEN 0 ELSE 1 END,
    e.created_at DESC
  LIMIT 50
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EntradasResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const nomeRecebedor = (req.query.nomeRecebedor as string) || '';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const result = await client.query(ENTRADAS_QUERY, [nomeRecebedor]);

    const entradas: EntradaParaReceber[] = result.rows.map(row => ({
      id: parseInt(row.id),
      entrada_id: parseInt(row.entrada_id),
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
      preco_confirmado: row.preco_confirmado === true,
      data_confirmacao_preco: row.data_confirmacao_preco,
    }));

    console.log(`Entradas para recebimento: ${entradas.length} encontradas`);

    return res.status(200).json({
      data: entradas,
      meta: { total: entradas.length },
    });
  } catch (error) {
    console.error('Erro ao buscar entradas para recebimento:', error);

    return res.status(500).json({
      error: 'Erro ao buscar entradas',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
