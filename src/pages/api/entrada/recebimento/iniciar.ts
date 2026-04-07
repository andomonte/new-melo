/**
 * Endpoint para iniciar recebimento de uma entrada
 * PUT /api/entrada/recebimento/iniciar
 *
 * Body:
 * - entradaId: ID da entrada
 * - matriculaRecebedor: matricula do operador
 * - nomeRecebedor: nome do operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface IniciarRequest {
  entradaId: number;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}

interface IniciarResponse {
  success: boolean;
  message: string;
  operacaoId?: number;
}

// Verificar se operador ja tem recebimento ativo
const CHECK_ATIVO_QUERY = `
  SELECT id, entrada_id
  FROM entrada_operacoes
  WHERE recebedor_matricula = $1
    AND status = 'EM_RECEBIMENTO'
  LIMIT 1
`;

// Verificar se entrada ja esta em recebimento
const CHECK_ENTRADA_QUERY = `
  SELECT id, recebedor_nome
  FROM entrada_operacoes
  WHERE entrada_id = $1
    AND status = 'EM_RECEBIMENTO'
  LIMIT 1
`;

// Buscar ou criar registro de operacao
const UPSERT_OPERACAO_QUERY = `
  INSERT INTO entrada_operacoes (
    entrada_id,
    status,
    recebedor_matricula,
    recebedor_nome,
    inicio_recebimento,
    created_at,
    updated_at
  )
  VALUES ($1, 'EM_RECEBIMENTO', $2, $3, NOW(), NOW(), NOW())
  ON CONFLICT (entrada_id)
  DO UPDATE SET
    status = 'EM_RECEBIMENTO',
    recebedor_matricula = $2,
    recebedor_nome = $3,
    inicio_recebimento = NOW(),
    updated_at = NOW()
  WHERE entrada_operacoes.status = 'AGUARDANDO_RECEBIMENTO'
  RETURNING id
`;

// Criar registros de itens para conferencia
const CREATE_ITENS_RECEBIMENTO_QUERY = `
  INSERT INTO entrada_itens_recebimento (
    entrada_operacao_id,
    entrada_item_id,
    produto_cod,
    qtd_esperada,
    status_item,
    created_at,
    updated_at
  )
  SELECT
    $1,
    ei.id,
    ei.produto_cod,
    ei.quantidade,
    'PENDENTE',
    NOW(),
    NOW()
  FROM entrada_itens ei
  WHERE ei.entrada_id = $2
    AND NOT EXISTS (
      SELECT 1 FROM entrada_itens_recebimento eir
      WHERE eir.entrada_item_id = ei.id
    )
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IniciarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as IniciarRequest;
  const { entradaId, matriculaRecebedor, nomeRecebedor } = body;

  if (!entradaId || !matriculaRecebedor || !nomeRecebedor) {
    return res.status(400).json({
      error: 'entradaId, matriculaRecebedor e nomeRecebedor sao obrigatorios',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador ja tem recebimento ativo
    const ativoResult = await client.query(CHECK_ATIVO_QUERY, [matriculaRecebedor]);
    if (ativoResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Voce ja possui um recebimento em andamento. Finalize-o primeiro.',
      });
    }

    // Verificar se entrada ja esta em recebimento por outro operador
    const entradaResult = await client.query(CHECK_ENTRADA_QUERY, [entradaId]);
    if (entradaResult.rows.length > 0) {
      const outroRecebedor = entradaResult.rows[0].recebedor_nome;
      return res.status(400).json({
        error: `Esta entrada ja esta sendo recebida por ${outroRecebedor}`,
      });
    }

    // Iniciar transacao
    await client.query('BEGIN');

    // Criar/atualizar operacao
    const operacaoResult = await client.query(UPSERT_OPERACAO_QUERY, [
      entradaId,
      matriculaRecebedor,
      nomeRecebedor,
    ]);

    if (operacaoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nao foi possivel iniciar o recebimento. Entrada pode ja estar em outro status.',
      });
    }

    const operacaoId = operacaoResult.rows[0].id;

    // Criar registros de itens para conferencia
    await client.query(CREATE_ITENS_RECEBIMENTO_QUERY, [operacaoId, entradaId]);

    await client.query('COMMIT');

    console.log('Recebimento iniciado:', {
      operacaoId,
      entradaId,
      recebedor: nomeRecebedor,
      filial,
    });

    return res.status(200).json({
      success: true,
      message: 'Recebimento iniciado com sucesso',
      operacaoId,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao iniciar recebimento:', error);

    return res.status(500).json({
      error: 'Erro ao iniciar recebimento',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
