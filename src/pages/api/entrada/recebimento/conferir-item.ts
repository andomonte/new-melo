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

// entradaItemId = id da linha de conferência (entrada_itens_recebimento).
// Verifica se o operador está ativo no recebimento desta entrada.
const CHECK_OPERADOR_QUERY = `
  SELECT op.id as operacao_id
  FROM db_manaus.entrada_itens_recebimento eir
  INNER JOIN db_manaus.entrada_operacoes op ON op.id = eir.entrada_operacao_id
  WHERE eir.id = $1
    AND op.recebedor_matricula = $2
    AND op.status = 'EM_RECEBIMENTO'
`;

// Atualiza a conferência do item
const UPSERT_ITEM_QUERY = `
  UPDATE db_manaus.entrada_itens_recebimento
     SET qtd_recebida = $2,
         status_item = $3,
         observacao = $4,
         conferido_em = NOW(),
         updated_at = NOW()
   WHERE id = $1
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

    // Atualizar conferencia do item (por id da linha de conferência)
    const updateResult = await client.query(UPSERT_ITEM_QUERY, [
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
