/**
 * Endpoint para conferir um item especifico
 * PUT /api/entrada/recebimento/conferir-item
 *
 * Body:
 * - entradaItemId: ID do item na tabela entrada_itens
 * - qtdRecebida: quantidade recebida
 * - statusItem: OK | FALTA | EXCESSO | DANIFICADO | ERRADO
 * - observacao: observacao opcional
 * - matricula: matricula do operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface ConferirItemRequest {
  entradaItemId: number;
  qtdRecebida: number;
  statusItem: 'OK' | 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'ERRADO';
  observacao?: string;
  matricula: string;
}

interface ConferirItemResponse {
  success: boolean;
  message: string;
}

// Verificar se o operador esta ativo no recebimento desta entrada
const CHECK_OPERADOR_QUERY = `
  SELECT op.id as operacao_id
  FROM entrada_operacoes op
  INNER JOIN entrada_itens ei ON ei.entrada_id = op.entrada_id
  WHERE ei.id = $1
    AND op.recebedor_matricula = $2
    AND op.status = 'EM_RECEBIMENTO'
`;

// Atualizar ou criar registro de conferencia do item
const UPSERT_ITEM_QUERY = `
  INSERT INTO entrada_itens_recebimento (
    entrada_operacao_id,
    entrada_item_id,
    produto_cod,
    qtd_esperada,
    qtd_recebida,
    status_item,
    observacao,
    conferido_em,
    created_at,
    updated_at
  )
  SELECT
    $1,
    ei.id,
    ei.produto_cod,
    ei.quantidade,
    $3,
    $4,
    $5,
    NOW(),
    NOW(),
    NOW()
  FROM entrada_itens ei
  WHERE ei.id = $2
  ON CONFLICT (entrada_item_id)
  DO UPDATE SET
    qtd_recebida = $3,
    status_item = $4,
    observacao = $5,
    conferido_em = NOW(),
    updated_at = NOW()
  RETURNING id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConferirItemResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as ConferirItemRequest;
  const { entradaItemId, qtdRecebida, statusItem, observacao, matricula } = body;

  // Validacoes
  if (!entradaItemId || qtdRecebida === undefined || !statusItem || !matricula) {
    return res.status(400).json({
      error: 'entradaItemId, qtdRecebida, statusItem e matricula sao obrigatorios',
    });
  }

  const validStatus = ['OK', 'FALTA', 'EXCESSO', 'DANIFICADO', 'ERRADO'];
  if (!validStatus.includes(statusItem)) {
    return res.status(400).json({
      error: `statusItem invalido. Use: ${validStatus.join(', ')}`,
    });
  }

  if (qtdRecebida < 0) {
    return res.status(400).json({
      error: 'qtdRecebida nao pode ser negativa',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador esta ativo no recebimento
    const checkResult = await client.query(CHECK_OPERADOR_QUERY, [entradaItemId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Voce nao esta autorizado a conferir este item ou nao esta em recebimento ativo',
      });
    }

    const operacaoId = checkResult.rows[0].operacao_id;

    // Atualizar conferencia do item
    const updateResult = await client.query(UPSERT_ITEM_QUERY, [
      operacaoId,
      entradaItemId,
      qtdRecebida,
      statusItem,
      observacao || null,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Nao foi possivel conferir o item',
      });
    }

    console.log('Item conferido:', {
      entradaItemId,
      qtdRecebida,
      statusItem,
      matricula,
      filial,
    });

    return res.status(200).json({
      success: true,
      message: 'Item conferido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao conferir item:', error);

    return res.status(500).json({
      error: 'Erro ao conferir item',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
