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
  entrada_id: string; // codent (chave opaca usada pelo frontend)
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
// Fonte: dbent + dbent_recebimento (workflow) + entrada_operacoes (por codent).
const ENTRADAS_QUERY = `
  SELECT
    COALESCE(op.id, 0) as id,
    e.codent as entrada_id,
    e.codent as numero_entrada,
    COALESCE(n.nnf::text, '') as nfe_numero,
    COALESCE(n.serie::text, '') as nfe_serie,
    COALESCE(emit.xnome, 'Fornecedor nao identificado') as fornecedor,
    COALESCE(e.totalnf, 0)::numeric as valor_total,
    COALESCE(item_count.total, 0) as qtd_itens,
    e.dtent as data_entrada,
    COALESCE(op.status, rec.status) as status,
    CASE COALESCE(op.status, rec.status)
      WHEN 'AGUARDANDO_RECEBIMENTO' THEN 'Aguardando'
      WHEN 'EM_RECEBIMENTO' THEN 'Em Recebimento'
      WHEN 'RECEBIDO' THEN 'Recebido'
      ELSE 'Desconhecido'
    END as status_label,
    op.recebedor_nome,
    op.inicio_recebimento,
    rec.data_confirmacao_preco IS NOT NULL as preco_confirmado,
    rec.data_confirmacao_preco
  FROM db_manaus.dbent e
  JOIN db_manaus.dbent_recebimento rec ON rec.codent = e.codent
  LEFT JOIN db_manaus.dbnfe_ent n ON n.chave = e.chave
  LEFT JOIN db_manaus.dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  LEFT JOIN db_manaus.entrada_operacoes op ON op.codent = e.codent
  LEFT JOIN (
    SELECT codent, COUNT(*) as total FROM db_manaus.dbitent GROUP BY codent
  ) item_count ON item_count.codent = e.codent
  WHERE
    rec.status IN ('AGUARDANDO_RECEBIMENTO', 'EM_RECEBIMENTO')
    AND ($1 = '' OR op.recebedor_nome = $1 OR op.recebedor_nome IS NULL)
  ORDER BY
    CASE WHEN op.recebedor_nome = $1 AND op.status = 'EM_RECEBIMENTO' THEN 0 ELSE 1 END,
    e.dtent DESC
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
      entrada_id: row.entrada_id, // codent (string opaca)
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
