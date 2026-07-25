import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * Reabrir entrada — modelo Delphi (dbent/dbent_recebimento).
 * Volta o workflow para PENDENTE, reabre o dbent (status 'A'), limpa as confirmações e,
 * se a entrada estava DISPONIVEL_VENDA, reverte o romaneio/estoque por armazém e a NFe.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    await client.query('SET LOCAL search_path TO db_manaus, public');

    const checkResult = await client.query(
      `SELECT e.codent, e.chave, rec.status AS rec_status,
              (SELECT codnfe_ent FROM db_manaus.dbnfe_ent WHERE chave = e.chave LIMIT 1) AS nfe_id
         FROM db_manaus.dbent e
         LEFT JOIN db_manaus.dbent_recebimento rec ON rec.codent = e.codent
        WHERE e.codent = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Entrada não encontrada' });
    }

    const entrada = checkResult.rows[0];
    const statusAtual = entrada.rec_status || 'PENDENTE';

    if (statusAtual === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Entrada cancelada não pode ser reaberta' });
    }

    // Se estava disponível para venda, reverter romaneio/estoque por armazém
    if (statusAtual === 'DISPONIVEL_VENDA') {
      const romaneioResult = await client.query(
        `SELECT codprod, arm_id, qtd FROM db_manaus.dbitent_armazem WHERE codent = $1`,
        [id]
      );

      const produtosInsuficientes: string[] = [];
      for (const rom of romaneioResult.rows) {
        const est = await client.query(
          `SELECT arp_qtest FROM db_manaus.cad_armazem_produto WHERE arp_arm_id = $1 AND arp_codprod = $2`,
          [rom.arm_id, rom.codprod]
        );
        if (est.rows.length > 0) {
          const qtstArmazem = parseFloat(est.rows[0].arp_qtest || 0);
          const qtdNecessaria = parseFloat(rom.qtd);
          if (qtstArmazem < qtdNecessaria) {
            produtosInsuficientes.push(`${rom.codprod} no armazém ${rom.arm_id}: disponível ${qtstArmazem}, necessário ${qtdNecessaria}`);
          }
        }
      }

      if (produtosInsuficientes.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Não é possível reabrir esta entrada. Estoque insuficiente para reverter a operação.',
          detalhes: produtosInsuficientes,
        });
      }

      for (const rom of romaneioResult.rows) {
        const qtd = parseFloat(rom.qtd);
        await client.query(
          `UPDATE db_manaus.dbprod SET qtdreservada = COALESCE(qtdreservada, 0) + $2 WHERE codprod = $1`,
          [rom.codprod, qtd]
        );
        await client.query(
          `UPDATE db_manaus.cad_armazem_produto SET arp_qtest = GREATEST(COALESCE(arp_qtest, 0) - $3, 0)
             WHERE arp_arm_id = $1 AND arp_codprod = $2`,
          [rom.arm_id, rom.codprod, qtd]
        );
      }

      await client.query(`DELETE FROM db_manaus.dbitent_armazem WHERE codent = $1`, [id]);
      await client.query(`UPDATE db_manaus.dbent SET est_alocado = 0 WHERE codent = $1`, [id]);
    }

    // Reabre o dbent e volta o workflow para PENDENTE, limpando as confirmações
    await client.query(`UPDATE db_manaus.dbent SET status = 'A' WHERE codent = $1`, [id]);
    await client.query(
      `INSERT INTO db_manaus.dbent_recebimento
         (codent, status, observacoes, data_confirmacao_preco, observacao_preco,
          data_confirmacao_estoque, observacao_estoque, updated_at)
       VALUES ($1, 'PENDENTE', $2, NULL, NULL, NULL, NULL, now())
       ON CONFLICT (codent) DO UPDATE SET
         status = 'PENDENTE',
         observacoes = COALESCE(db_manaus.dbent_recebimento.observacoes, '') || E'\n[REABERTA] ' || COALESCE(EXCLUDED.observacoes, ''),
         data_confirmacao_preco = NULL, observacao_preco = NULL,
         data_confirmacao_estoque = NULL, observacao_estoque = NULL,
         updated_at = now()`,
      [id, observacao || '']
    );

    // Reverter a NFe para não processada
    if (entrada.nfe_id) {
      await client.query(`UPDATE db_manaus.dbnfe_ent SET exec = 'N' WHERE codnfe_ent = $1`, [entrada.nfe_id]);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Entrada ${id} reaberta com sucesso!`,
      data: { entradaId: id, numeroEntrada: id, novoStatus: 'PENDENTE' },
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao reabrir entrada:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao reabrir entrada: ' + (error instanceof Error ? error.message : 'Erro desconhecido'),
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
