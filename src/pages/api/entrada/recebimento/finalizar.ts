/**
 * Finalizar recebimento — modelo dbent/dbent_recebimento.
 * PUT /api/entrada/recebimento/finalizar
 * Body: entradaId (codent), matricula, observacao?
 * Marca RECEBIDO, cria romaneio automático (dbitent_armazem) e devolução se houver FALTA.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface FinalizarRequest {
  entradaId: string; // codent
  matricula: string;
  observacao?: string;
}

interface FinalizarResponse {
  success: boolean;
  message: string;
  temDivergencia: boolean;
  precosAtualizados?: number;
}

const ARMAZEM_PADRAO = 1003;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { entradaId, matricula, observacao } = (req.body || {}) as FinalizarRequest;
  if (!entradaId || !matricula) {
    return res.status(400).json({ error: 'entradaId e matricula sao obrigatorios' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Operador ativo neste recebimento?
    const checkResult = await client.query(
      `SELECT id FROM db_manaus.entrada_operacoes
        WHERE codent = $1 AND recebedor_matricula = $2 AND status = 'EM_RECEBIMENTO'`,
      [entradaId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'Voce nao esta autorizado a finalizar este recebimento' });
    }

    // Todos os itens conferidos?
    const pendentesResult = await client.query(
      `SELECT COUNT(*) as pendentes
         FROM db_manaus.dbitent ie
         LEFT JOIN db_manaus.entrada_itens_recebimento eir
           ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
          AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
        WHERE ie.codent = $1 AND (eir.id IS NULL OR eir.status_item = 'PENDENTE')`,
      [entradaId]);
    const pendentes = parseInt(pendentesResult.rows[0].pendentes);
    if (pendentes > 0) {
      return res.status(400).json({ error: `Ainda existem ${pendentes} item(ns) pendente(s) de conferencia` });
    }

    // Divergências?
    const divergenciasResult = await client.query(
      `SELECT COUNT(*) as divergencias FROM db_manaus.entrada_itens_recebimento
        WHERE codent = $1 AND status_item IN ('FALTA','EXCESSO','DANIFICADO','ERRADO')`,
      [entradaId]);
    const temDivergencia = parseInt(divergenciasResult.rows[0].divergencias) > 0;

    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO db_manaus, public');

    // Finaliza a operação de recebimento
    const finalizarResult = await client.query(
      `UPDATE db_manaus.entrada_operacoes
          SET status = 'RECEBIDO', fim_recebimento = NOW(), tem_divergencia = $2,
              observacao = COALESCE($3, observacao), updated_at = NOW()
        WHERE codent = $1 AND status = 'EM_RECEBIMENTO' RETURNING id`,
      [entradaId, temDivergencia, observacao || null]);
    if (finalizarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nao foi possivel finalizar o recebimento' });
    }

    // Avança o workflow físico
    await client.query(
      `UPDATE db_manaus.dbent_recebimento SET status = 'RECEBIDO', updated_at = now() WHERE codent = $1`,
      [entradaId]);

    // Romaneio automático (se não houver)
    const romaneioResult = await client.query(`SELECT COUNT(*) as total FROM db_manaus.dbitent_armazem WHERE codent = $1`, [entradaId]);
    if (parseInt(romaneioResult.rows[0].total) === 0) {
      const itensResult = await client.query(`SELECT codprod, codreq, quant FROM db_manaus.dbitent WHERE codent = $1`, [entradaId]);
      for (const item of itensResult.rows) {
        await client.query(
          `INSERT INTO db_manaus.dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [entradaId, item.codprod, item.codreq, ARMAZEM_PADRAO, parseFloat(item.quant)]);
      }
    }

    // Devolução automática (itens com FALTA)
    if (temDivergencia) {
      const itensFalta = await client.query(
        `SELECT eir.id as eir_id, eir.produto_cod,
                COALESCE(p.descr, eir.produto_cod) as produto_nome,
                COALESCE(p.unimed, 'UN') as unidade,
                eir.qtd_esperada, eir.qtd_recebida,
                (eir.qtd_esperada - eir.qtd_recebida) as qtd_devolucao
           FROM db_manaus.entrada_itens_recebimento eir
           LEFT JOIN db_manaus.dbprod p ON p.codprod = eir.produto_cod
          WHERE eir.codent = $1 AND eir.status_item = 'FALTA' AND eir.qtd_recebida < eir.qtd_esperada`,
        [entradaId]);

      if (itensFalta.rows.length > 0) {
        const entDados = await client.query(
          `SELECT COALESCE(em.xnome, '') as fornecedor,
                  COALESCE(CAST(ne.nnf AS VARCHAR), '') as nfe_numero,
                  COALESCE(CAST(ne.serie AS VARCHAR), '') as nfe_serie
             FROM db_manaus.dbent e
             LEFT JOIN db_manaus.dbnfe_ent ne ON ne.chave = e.chave
             LEFT JOIN db_manaus.dbnfe_ent_emit em ON em.codnfe_ent = ne.codnfe_ent
            WHERE e.codent = $1`, [entradaId]);
        const ent = entDados.rows[0] || {};
        const totalItens = itensFalta.rows.length;
        const qtdTotalDevolucao = itensFalta.rows.reduce((acc: number, i: any) => acc + parseFloat(i.qtd_devolucao), 0);

        const devolucaoResult = await client.query(
          `INSERT INTO db_manaus.devolucoes (entrada_id, numero_entrada, fornecedor, nfe_numero, nfe_serie, status, total_itens, qtd_total_devolucao, created_by)
           VALUES (NULL, $1, $2, $3, $4, 'PENDENTE', $5, $6, $7) RETURNING id`,
          [entradaId, ent.fornecedor, ent.nfe_numero, ent.nfe_serie, totalItens, qtdTotalDevolucao, matricula]);
        const devolucaoId = devolucaoResult.rows[0].id;

        for (const item of itensFalta.rows) {
          await client.query(
            `INSERT INTO db_manaus.devolucao_itens (devolucao_id, entrada_item_id, produto_cod, produto_nome, unidade, qtd_esperada, qtd_recebida, qtd_devolucao, motivo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'FALTA')`,
            [devolucaoId, item.eir_id, item.produto_cod, item.produto_nome, item.unidade,
             parseFloat(item.qtd_esperada), parseFloat(item.qtd_recebida), parseFloat(item.qtd_devolucao)]);
        }
      }
    }

    // Log da operação
    await client.query(
      `INSERT INTO db_manaus.entrada_operacoes_log (codent, operacao, status_anterior, status_novo, observacao, created_at)
       VALUES ($1, 'FINALIZAR_RECEBIMENTO', 'EM_RECEBIMENTO', 'RECEBIDO', $2, CURRENT_TIMESTAMP)`,
      [entradaId, `Recebimento finalizado. ${temDivergencia ? 'Com divergencias.' : 'Sem divergencias.'}`]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: temDivergencia ? 'Recebimento finalizado com divergencias.' : 'Recebimento finalizado com sucesso.',
      temDivergencia,
      precosAtualizados: 0,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao finalizar recebimento:', error);
    return res.status(500).json({ error: 'Erro ao finalizar recebimento' });
  } finally {
    if (client) client.release();
  }
}
