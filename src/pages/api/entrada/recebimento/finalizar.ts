/**
 * Endpoint para finalizar recebimento de uma entrada
 * PUT /api/entrada/recebimento/finalizar
 *
 * Body:
 * - entradaId: ID da entrada
 * - matricula: matricula do operador
 * - observacao: observacao geral opcional
 *
 * Confirmacao de precos e feita separadamente na tela de Entradas.
 * Cria romaneio automatico se nao existir.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface FinalizarRequest {
  entradaId: number;
  matricula: string;
  observacao?: string;
}

interface FinalizarResponse {
  success: boolean;
  message: string;
  temDivergencia: boolean;
  precosAtualizados?: number;
}

// Verificar se operador esta ativo no recebimento desta entrada
const CHECK_OPERADOR_QUERY = `
  SELECT id
  FROM entrada_operacoes
  WHERE entrada_id = $1
    AND recebedor_matricula = $2
    AND status = 'EM_RECEBIMENTO'
`;

// Verificar se todos os itens foram conferidos
const CHECK_ITENS_PENDENTES_QUERY = `
  SELECT COUNT(*) as pendentes
  FROM entrada_itens ei
  LEFT JOIN entrada_itens_recebimento eir ON eir.entrada_item_id = ei.id
  WHERE ei.entrada_id = $1
    AND (eir.id IS NULL OR eir.status_item = 'PENDENTE')
`;

// Verificar se tem divergencias
const CHECK_DIVERGENCIAS_QUERY = `
  SELECT COUNT(*) as divergencias
  FROM entrada_itens_recebimento eir
  INNER JOIN entrada_itens ei ON ei.id = eir.entrada_item_id
  WHERE ei.entrada_id = $1
    AND eir.status_item IN ('FALTA', 'EXCESSO', 'DANIFICADO', 'ERRADO')
`;

// Finalizar operacao
const FINALIZAR_OPERACAO_QUERY = `
  UPDATE entrada_operacoes
  SET
    status = 'RECEBIDO',
    fim_recebimento = NOW(),
    tem_divergencia = $2,
    observacao = COALESCE($3, observacao),
    updated_at = NOW()
  WHERE entrada_id = $1
    AND status = 'EM_RECEBIMENTO'
  RETURNING id
`;

// Atualizar status da entrada
const ATUALIZAR_ENTRADA_QUERY = `
  UPDATE entradas_estoque
  SET
    status = 'RECEBIDO',
    updated_at = NOW()
  WHERE id = $1
  RETURNING numero_entrada
`;

// Buscar itens da entrada para calculo de custo
const BUSCAR_ITENS_ENTRADA_QUERY = `
  SELECT
    ei.produto_cod,
    ei.quantidade,
    ei.valor_unitario as custo_entrada,
    ei.req_id
  FROM entrada_itens ei
  WHERE ei.entrada_id = $1
`;

// Verificar romaneio existente
const CHECK_ROMANEIO_QUERY = `
  SELECT COUNT(*) as total
  FROM dbitent_armazem
  WHERE codent = $1
`;

// Criar romaneio automatico
const CRIAR_ROMANEIO_QUERY = `
  INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT DO NOTHING
`;

// Buscar itens com FALTA para devolucao
const BUSCAR_ITENS_FALTA_QUERY = `
  SELECT
    eir.entrada_item_id,
    ei.produto_cod,
    COALESCE(p.descr, ei.produto_cod) as produto_nome,
    COALESCE(p.unimed, 'UN') as unidade,
    ei.quantidade as qtd_esperada,
    eir.qtd_recebida,
    (ei.quantidade - eir.qtd_recebida) as qtd_devolucao
  FROM entrada_itens_recebimento eir
  INNER JOIN entrada_itens ei ON ei.id = eir.entrada_item_id
  LEFT JOIN dbprod p ON p.codprod = ei.produto_cod
  WHERE ei.entrada_id = $1
    AND eir.status_item = 'FALTA'
    AND eir.qtd_recebida < ei.quantidade
`;

// Buscar dados da entrada para devolucao
const BUSCAR_ENTRADA_DEVOLUCAO_QUERY = `
  SELECT
    ee.numero_entrada,
    COALESCE(em.xnome, ee.fornecedor_cod, '') as fornecedor,
    COALESCE(CAST(ne.nnf AS VARCHAR), '') as nfe_numero,
    COALESCE(CAST(ne.serie AS VARCHAR), '') as nfe_serie
  FROM entradas_estoque ee
  LEFT JOIN dbnfe_ent ne ON ne.codnfe_ent = ee.nfe_id
  LEFT JOIN dbnfe_ent_emit em ON em.codnfe_ent = ne.codnfe_ent
  WHERE ee.id = $1
`;

// Criar devolucao
const CRIAR_DEVOLUCAO_QUERY = `
  INSERT INTO devolucoes (entrada_id, numero_entrada, fornecedor, nfe_numero, nfe_serie, status, total_itens, qtd_total_devolucao, created_by)
  VALUES ($1, $2, $3, $4, $5, 'PENDENTE', $6, $7, $8)
  RETURNING id
`;

// Criar item de devolucao
const CRIAR_DEVOLUCAO_ITEM_QUERY = `
  INSERT INTO devolucao_itens (devolucao_id, entrada_item_id, produto_cod, produto_nome, unidade, qtd_esperada, qtd_recebida, qtd_devolucao, motivo)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'FALTA')
`;

// Marcar entrada com devolucao
const MARCAR_ENTRADA_DEVOLUCAO_QUERY = `
  UPDATE entradas_estoque SET tem_devolucao = true, updated_at = NOW() WHERE id = $1
`;

// Log de operacao
const LOG_OPERACAO_QUERY = `
  INSERT INTO entrada_operacoes_log (
    entrada_id,
    operacao,
    status_anterior,
    status_novo,
    observacao,
    created_at
  ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
`;

// Armazem padrao para romaneio automatico
const ARMAZEM_PADRAO = 1003;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as FinalizarRequest;
  const { entradaId, matricula, observacao } = body;

  if (!entradaId || !matricula) {
    return res.status(400).json({
      error: 'entradaId e matricula sao obrigatorios',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Verificar se operador esta ativo no recebimento
    const checkResult = await client.query(CHECK_OPERADOR_QUERY, [entradaId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Voce nao esta autorizado a finalizar este recebimento',
      });
    }

    // Verificar se todos os itens foram conferidos
    const pendentesResult = await client.query(CHECK_ITENS_PENDENTES_QUERY, [entradaId]);
    const pendentes = parseInt(pendentesResult.rows[0].pendentes);
    if (pendentes > 0) {
      return res.status(400).json({
        error: `Ainda existem ${pendentes} item(ns) pendente(s) de conferencia`,
      });
    }

    // Verificar se tem divergencias
    const divergenciasResult = await client.query(CHECK_DIVERGENCIAS_QUERY, [entradaId]);
    const temDivergencia = parseInt(divergenciasResult.rows[0].divergencias) > 0;

    // Iniciar transacao
    await client.query('BEGIN');

    // 1. Finalizar operacao de recebimento
    const finalizarResult = await client.query(FINALIZAR_OPERACAO_QUERY, [
      entradaId,
      temDivergencia,
      observacao || null,
    ]);

    if (finalizarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nao foi possivel finalizar o recebimento',
      });
    }

    // 2. Atualizar status da entrada
    const entradaResult = await client.query(ATUALIZAR_ENTRADA_QUERY, [entradaId]);
    const numeroEntrada = entradaResult.rows[0]?.numero_entrada;

    // 3. Buscar itens da entrada (para romaneio automatico)
    const itensResult = await client.query(BUSCAR_ITENS_ENTRADA_QUERY, [entradaId]);

    // 4. ROMANEIO - Criar automaticamente se nao existir
    if (numeroEntrada) {
      const romaneioResult = await client.query(CHECK_ROMANEIO_QUERY, [numeroEntrada]);
      const temRomaneio = parseInt(romaneioResult.rows[0].total) > 0;

      if (!temRomaneio) {
        console.log(`Criando romaneio automatico para entrada ${numeroEntrada}...`);

        for (const item of itensResult.rows) {
          const qtd = parseFloat(item.quantidade);
          await client.query(CRIAR_ROMANEIO_QUERY, [
            numeroEntrada,
            item.produto_cod,
            item.req_id,
            ARMAZEM_PADRAO,
            qtd,
          ]);
        }

        console.log(`Romaneio criado: ${itensResult.rows.length} itens -> armazem ${ARMAZEM_PADRAO}`);
      }
    }

    // 5. DEVOLUCAO - Criar automaticamente se tem itens com FALTA
    if (temDivergencia) {
      const itensFalta = await client.query(BUSCAR_ITENS_FALTA_QUERY, [entradaId]);

      if (itensFalta.rows.length > 0) {
        const entradaDados = await client.query(BUSCAR_ENTRADA_DEVOLUCAO_QUERY, [entradaId]);
        const ent = entradaDados.rows[0];

        const totalItens = itensFalta.rows.length;
        const qtdTotalDevolucao = itensFalta.rows.reduce(
          (acc: number, item: any) => acc + parseFloat(item.qtd_devolucao),
          0,
        );

        const devolucaoResult = await client.query(CRIAR_DEVOLUCAO_QUERY, [
          entradaId,
          ent.numero_entrada,
          ent.fornecedor,
          ent.nfe_numero,
          ent.nfe_serie,
          totalItens,
          qtdTotalDevolucao,
          matricula,
        ]);

        const devolucaoId = devolucaoResult.rows[0].id;

        for (const item of itensFalta.rows) {
          await client.query(CRIAR_DEVOLUCAO_ITEM_QUERY, [
            devolucaoId,
            item.entrada_item_id,
            item.produto_cod,
            item.produto_nome,
            item.unidade,
            parseFloat(item.qtd_esperada),
            parseFloat(item.qtd_recebida),
            parseFloat(item.qtd_devolucao),
          ]);
        }

        await client.query(MARCAR_ENTRADA_DEVOLUCAO_QUERY, [entradaId]);

        console.log(`Devolucao #${devolucaoId} criada: ${totalItens} itens, qtd total ${qtdTotalDevolucao}`);
      }
    }

    // 6. Log da operacao
    const logMessage = `Recebimento finalizado. ${temDivergencia ? 'Com divergencias.' : 'Sem divergencias.'}`;

    await client.query(LOG_OPERACAO_QUERY, [
      entradaId,
      'FINALIZAR_RECEBIMENTO',
      'EM_RECEBIMENTO',
      'RECEBIDO',
      logMessage,
    ]);

    await client.query('COMMIT');

    console.log('Recebimento finalizado:', {
      entradaId,
      numeroEntrada,
      matricula,
      temDivergencia,
      filial,
    });

    const mensagemFinal = temDivergencia
      ? 'Recebimento finalizado com divergencias.'
      : 'Recebimento finalizado com sucesso.';

    return res.status(200).json({
      success: true,
      message: mensagemFinal,
      temDivergencia,
      precosAtualizados: 0,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao finalizar recebimento:', error);

    return res.status(500).json({
      error: 'Erro ao finalizar recebimento',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
