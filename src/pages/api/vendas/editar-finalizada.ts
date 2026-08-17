import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para editar vendas finalizadas (não faturadas).
 *
 * PATCH /api/vendas/editar-finalizada
 * Body: { codvenda, itens: [{ codprod, qtd }], itensRemovidos: [codprod], usuario }
 *
 * Regras:
 * - Só vendas com status 'N' (não faturada)
 * - Quantidade só pode diminuir (nunca aumentar)
 * - Quantidade zero não é permitida
 * - Itens podem ser removidos
 * - Recalcula total da venda + impostos
 * - Registra auditoria em dbanalise_liberacao + dbanalise_liberacao_itens
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codvenda, itens, itensRemovidos, usuario } = req.body;

  if (!codvenda) {
    return res.status(400).json({ error: 'codvenda é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar status da venda
    const vendaResult = await client.query(
      'SELECT status, codcli FROM dbvenda WHERE codvenda = $1',
      [codvenda],
    );
    if (vendaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const { status, codcli } = vendaResult.rows[0];
    if (status === 'F') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Venda já faturada — não pode ser editada' });
    }
    if (status === 'C') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Venda cancelada — não pode ser editada' });
    }

    const user = usuario || 'SISTEMA';

    // 2. Criar registro de auditoria
    const analiseResult = await client.query(
      `INSERT INTO db_manaus.dbanalise_liberacao (codvenda, resultado, usuario)
       VALUES ($1, 'EDITADA', $2) RETURNING id`,
      [codvenda, user],
    );
    const idAnalise = analiseResult.rows[0].id;

    // Snapshot dos itens originais
    const itensOriginais = await client.query(
      'SELECT codprod, qtd, prunit, prcompra FROM dbitvenda WHERE codvenda = $1',
      [codvenda],
    );
    for (const item of itensOriginais.rows) {
      await client.query(
        `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, valor_anterior)
         VALUES ($1, $2, 'ORIGINAL', $3)`,
        [idAnalise, item.codprod, `qtd:${item.qtd} pr:${Number(item.prunit).toFixed(2)}`],
      );
    }

    // 3. Processar alterações de quantidade
    if (itens && Array.isArray(itens)) {
      for (const item of itens) {
        if (!item.codprod || !item.qtd) continue;

        const novaQtd = Number(item.qtd);
        if (novaQtd <= 0) continue; // Qtd zero não permitida

        // Buscar qtd original
        const original = await client.query(
          'SELECT qtd, prunit FROM dbitvenda WHERE codvenda = $1 AND codprod = $2',
          [codvenda, item.codprod],
        );
        if (original.rows.length === 0) continue;

        const qtdOriginal = Number(original.rows[0].qtd);
        const prunit = Number(original.rows[0].prunit);

        // Só permite diminuir
        if (novaQtd >= qtdOriginal) continue;

        // Atualizar quantidade
        await client.query(
          'UPDATE dbitvenda SET qtd = $3 WHERE codvenda = $1 AND codprod = $2',
          [codvenda, item.codprod, novaQtd],
        );

        // Recalcular impostos via função PostgreSQL
        try {
          const { rows } = await client.query(
            `SELECT * FROM db_manaus.calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              String(item.codprod).trim().padStart(6, '0'),
              String(codcli ?? '').trim(),
              novaQtd,
              prunit,
              'SAIDA',
              'VENDA',
              'NOTA_FISCAL',
              '04',
              'N',
              0,
            ],
          );
          const r = rows[0];
          if (r) {
            const num = (v: any) => Number(v ?? 0);
            await client.query(
              `UPDATE dbitvenda SET
                aliquota_icms = $3, baseicms = $4, totalicms = $5,
                aliquota_ipi = $6, baseipi = $7, totalipi = $8,
                pis = $9, basepis = $10, valorpis = $11,
                cofins = $12, basecofins = $13, valorcofins = $14,
                totalsubst_trib = $15, basesubst_trib = $16,
                totalproduto = $17
               WHERE codvenda = $1 AND codprod = $2`,
              [
                codvenda, item.codprod,
                num(r.icms), num(r.baseicms), num(r.totalicms),
                num(r.ipi), num(r.baseipi), num(r.totalipi),
                num(r.pis), num(r.basepis), num(r.valorpis),
                num(r.cofins), num(r.basecofins), num(r.valorcofins),
                num(r.totalsubst_trib), num(r.basesubst_trib),
                num(r.totalproduto),
              ],
            );
          }
        } catch (taxErr: any) {
          console.error(`Erro ao recalcular impostos para ${item.codprod}:`, taxErr.message);
        }

        // Registrar auditoria
        await client.query(
          `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, campo, valor_anterior, valor_novo)
           VALUES ($1, $2, 'ALTERAR', 'qtd', $3, $4)`,
          [idAnalise, item.codprod, String(qtdOriginal), String(novaQtd)],
        );

        // Liberar reserva da diferença
        const diff = qtdOriginal - novaQtd;
        if (diff > 0) {
          await client.query(
            `UPDATE cad_armazem_produto
             SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada, 0) - $2, 0)
             WHERE arp_codprod = $1`,
            [item.codprod, diff],
          );
        }
      }
    }

    // 4. Processar remoções
    if (itensRemovidos && Array.isArray(itensRemovidos)) {
      for (const codprod of itensRemovidos) {
        // Buscar dados antes de deletar
        const itemRef = await client.query(
          'SELECT qtd, prunit FROM dbitvenda WHERE codvenda = $1 AND codprod = $2',
          [codvenda, codprod],
        );
        if (itemRef.rows.length === 0) continue;

        const qtdDel = Number(itemRef.rows[0].qtd);
        const prDel = Number(itemRef.rows[0].prunit);

        // Deletar item
        await client.query(
          'DELETE FROM dbitvenda WHERE codvenda = $1 AND codprod = $2',
          [codvenda, codprod],
        );

        // Liberar reserva
        if (qtdDel > 0) {
          await client.query(
            `UPDATE cad_armazem_produto
             SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada, 0) - $2, 0)
             WHERE arp_codprod = $1`,
            [codprod, qtdDel],
          );
        }

        // Registrar auditoria
        await client.query(
          `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, valor_anterior)
           VALUES ($1, $2, 'REMOVER', $3)`,
          [idAnalise, codprod, `qtd:${qtdDel} pr:${prDel.toFixed(2)}`],
        );
      }
    }

    // 5. Recalcular total da venda
    const totalResult = await client.query(
      'SELECT COALESCE(SUM(qtd * prunit), 0) as total FROM dbitvenda WHERE codvenda = $1',
      [codvenda],
    );
    await client.query(
      'UPDATE dbvenda SET total = $2 WHERE codvenda = $1',
      [codvenda, totalResult.rows[0].total],
    );

    // 6. Marcar conclusão da auditoria
    await client.query(
      `UPDATE db_manaus.dbanalise_liberacao
       SET resultado = 'EDITADA', dt_conclusao = NOW()
       WHERE id = $1`,
      [idAnalise],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      ok: true,
      total: Number(totalResult.rows[0].total),
      idAnalise,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao editar venda finalizada:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
