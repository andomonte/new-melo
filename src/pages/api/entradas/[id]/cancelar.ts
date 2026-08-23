import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * POST /api/entradas/[id]/cancelar
 *
 * Cancela a entrada (paridade Delphi ENTRADASEFAZ.Cancel_Ent):
 *  - reverte o estoque somado ao gerar (dbprod.qtest; qtdreservada só se ainda
 *    estava reservado, i.e., antes de confirmar estoque);
 *  - cancela o romaneio (dbitent_armazem) e devolve o estoque por armazém;
 *  - reverte a quantidade atendida dos pedidos e reabre as ordens fechadas;
 *  - seta dbent.status='C' e dbent_recebimento.status='CANCELADA';
 *  - reseta a NFe (exec='N') para poder reprocessar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao } = req.body || {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: 'ID (codent) da entrada é obrigatório' });
  }

  let client;
  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    const ent = (
      await client.query(
        `SELECT e.codent, e.chave, rec.status AS rec_status,
                (SELECT natop FROM dbnfe_ent WHERE chave = e.chave LIMIT 1) AS natop,
                (SELECT codnfe_ent FROM dbnfe_ent WHERE chave = e.chave LIMIT 1) AS nfe_id
           FROM dbent e
           LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
          WHERE e.codent = $1`,
        [id],
      )
    ).rows[0];

    if (!ent) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Entrada não encontrada' });
    }
    if ((ent.rec_status || '') === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Entrada já está cancelada' });
    }

    // Estoque ainda reservado (antes de confirmar estoque)?
    const reservado =
      !ent.rec_status || ['PENDENTE', 'PRECO_CONFIRMADO'].includes(ent.rec_status);
    const isImp = ent.natop === 'ENTRADA_IMPORTACAO';

    const itens = (
      await client.query(
        `SELECT codprod, codreq, COALESCE(quant,0) AS quant FROM dbitent WHERE codent = $1`,
        [id],
      )
    ).rows;

    // 1) Reverte estoque base (qtest sempre; qtdreservada só se ainda reservado)
    for (const it of itens) {
      const q = Number(it.quant);
      if (reservado) {
        await client.query(
          `UPDATE dbprod
              SET qtest = GREATEST(COALESCE(qtest,0) - $2, 0),
                  qtdreservada = GREATEST(COALESCE(qtdreservada,0) - $2, 0)
            WHERE codprod = $1`,
          [it.codprod, q],
        );
      } else {
        await client.query(
          `UPDATE dbprod SET qtest = GREATEST(COALESCE(qtest,0) - $2, 0) WHERE codprod = $1`,
          [it.codprod, q],
        );
      }
    }

    // 2) Romaneio: devolve estoque por armazém e apaga a distribuição
    const romaneio = (
      await client.query(
        `SELECT codprod, arm_id, COALESCE(qtd,0) AS qtd FROM dbitent_armazem WHERE codent = $1`,
        [id],
      )
    ).rows;
    for (const rom of romaneio) {
      await client.query(
        `UPDATE cad_armazem_produto
            SET arp_qtest = GREATEST(COALESCE(arp_qtest,0) - $3, 0)
          WHERE arp_arm_id = $1 AND arp_codprod = $2`,
        [rom.arm_id, rom.codprod, Number(rom.qtd)],
      );
    }
    await client.query(`DELETE FROM dbitent_armazem WHERE codent = $1`, [id]);

    // 3) Reverte quantidade atendida dos pedidos + reabre ordens fechadas
    //    (não para importação, espelhando o gate do gerar-por-chave)
    if (!isImp) {
      for (const it of itens) {
        const codreq = String(it.codreq || '');
        if (!codreq || codreq === 'AUTOMATIC' || codreq.startsWith('99') || codreq.startsWith('FB')) continue;
        await client.query(
          `UPDATE cmp_it_requisicao ri
              SET itr_quantidade_atendida = GREATEST(COALESCE(ri.itr_quantidade_atendida,0) - $2, 0)
             FROM cmp_ordem_compra o
            WHERE o.orc_id::text = $1
              AND ri.itr_req_id = o.orc_req_id
              AND ri.itr_req_versao = o.orc_req_versao
              AND ri.itr_codprod = $3`,
          [codreq, Number(it.quant), it.codprod],
        );
      }
      const codreqs = Array.from(
        new Set(
          itens
            .map((i) => String(i.codreq || ''))
            .filter((r) => r && r !== 'AUTOMATIC' && !r.startsWith('99') && !r.startsWith('FB')),
        ),
      );
      if (codreqs.length > 0) {
        await client.query(
          `UPDATE cmp_ordem_compra
              SET orc_status = 'A'
            WHERE orc_id::text = ANY($1) AND orc_status = 'F'`,
          [codreqs],
        );
      }
    }

    // 4) Status da entrada = cancelada
    await client.query(`UPDATE dbent SET status = 'C', est_alocado = 0 WHERE codent = $1`, [id]);
    await client.query(
      `INSERT INTO dbent_recebimento (codent, status, observacoes, updated_at)
       VALUES ($1, 'CANCELADA', $2, now())
       ON CONFLICT (codent) DO UPDATE SET
         status = 'CANCELADA',
         observacoes = COALESCE(dbent_recebimento.observacoes, '') || E'\n[CANCELADA] ' || COALESCE(EXCLUDED.observacoes, ''),
         updated_at = now()`,
      [id, observacao || ''],
    );

    // 5) Reseta a NFe para poder reprocessar
    if (ent.nfe_id) {
      await client.query(`UPDATE dbnfe_ent SET exec = 'N' WHERE codnfe_ent = $1`, [ent.nfe_id]);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Entrada ${id} cancelada com sucesso.`,
      data: { entradaId: id, novoStatus: 'CANCELADA' },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao cancelar entrada:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao cancelar entrada: ' + (error instanceof Error ? error.message : 'Erro desconhecido'),
    });
  } finally {
    if (client) client.release();
  }
}
