/**
 * Endpoint para iniciar alocacao de uma entrada
 * PUT /api/entrada/alocacao/iniciar
 *
 * Body:
 * - entradaId: ID da entrada
 * - matriculaAlocador: matricula do operador
 * - nomeAlocador: nome do operador
 * - armId: ID do armazem de destino
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolEstacaoEntrada } from '@/lib/recebimentoEntrada/filial';
import { PoolClient } from 'pg';
import { precoConfirmadoDaEntrada, MSG_PRECO_PENDENTE_ALOCACAO } from '@/lib/recebimentoEntrada/status';

interface IniciarRequest {
  entradaId: string; // codent
  matriculaAlocador: string;
  nomeAlocador: string;
  armId: number;
}

interface IniciarResponse {
  success: boolean;
  message: string;
}

// Verificar se operador ja tem alocacao ativa
const CHECK_ATIVO_QUERY = `
  SELECT id, codent
  FROM entrada_operacoes
  WHERE alocador_matricula = $1 AND status = 'EM_ALOCACAO'
  LIMIT 1
`;

// Verificar se entrada esta pronta para alocacao
const CHECK_ENTRADA_QUERY = `
  SELECT id, status, alocador_nome
  FROM entrada_operacoes
  WHERE codent = $1
`;

// Atualizar operacao para iniciar alocacao
const INICIAR_ALOCACAO_QUERY = `
  UPDATE entrada_operacoes
  SET status = 'EM_ALOCACAO', alocador_matricula = $2, alocador_nome = $3,
      arm_id = $4, inicio_alocacao = NOW(), updated_at = NOW()
  WHERE codent = $1 AND status = 'RECEBIDO'
  RETURNING id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IniciarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as IniciarRequest;
  const { entradaId, matriculaAlocador, nomeAlocador, armId } = body;

  if (!entradaId || !matriculaAlocador || !nomeAlocador || !armId) {
    return res.status(400).json({
      error: 'entradaId, matriculaAlocador, nomeAlocador e armId sao obrigatorios',
    });
  }

  const cookies = parseCookies({ req });
  // filial do link da tela (header x-filial-estacao); ver lib/recebimentoEntrada/filial.ts
  const { filial, pool, schema } = poolEstacaoEntrada(req);

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador ja tem alocacao ativa
    const ativoResult = await client.query(CHECK_ATIVO_QUERY, [matriculaAlocador]);
    if (ativoResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Voce ja possui uma alocacao em andamento. Finalize-a primeiro.',
      });
    }

    // Verificar status da entrada
    const entradaResult = await client.query(CHECK_ENTRADA_QUERY, [entradaId]);
    if (entradaResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Entrada nao encontrada ou ainda nao foi recebida.',
      });
    }

    const operacao = entradaResult.rows[0];
    if (operacao.status === 'EM_ALOCACAO') {
      return res.status(400).json({
        error: `Esta entrada ja esta sendo alocada por ${operacao.alocador_nome}`,
      });
    }

    if (operacao.status !== 'RECEBIDO') {
      return res.status(400).json({
        error: 'Esta entrada nao esta disponivel para alocacao.',
      });
    }

    // Alocação libera para venda: exige o preço confirmado (lib/recebimentoEntrada/status.ts)
    if (!(await precoConfirmadoDaEntrada(client, entradaId))) {
      return res.status(400).json({ error: MSG_PRECO_PENDENTE_ALOCACAO(entradaId) });
    }

    // Iniciar alocacao
    const iniciarResult = await client.query(INICIAR_ALOCACAO_QUERY, [
      entradaId,
      matriculaAlocador,
      nomeAlocador,
      armId,
    ]);

    if (iniciarResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Nao foi possivel iniciar a alocacao.',
      });
    }

    // Avança o workflow físico
    await client.query(
      `UPDATE dbent_recebimento SET status = 'EM_ALOCACAO', updated_at = now() WHERE codent = $1`,
      [entradaId]);

    console.log('Alocacao iniciada:', {
      entradaId,
      alocador: nomeAlocador,
      armId,
      filial,
    });

    return res.status(200).json({
      success: true,
      message: 'Alocacao iniciada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao iniciar alocacao:', error);

    return res.status(500).json({
      error: 'Erro ao iniciar alocacao',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
