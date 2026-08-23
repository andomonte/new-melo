import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para cancelar vendas não faturadas.
 *
 * PATCH /api/vendas/cancelar-venda
 * Body: { codvenda, usuario }
 *
 * Regras:
 * - Só vendas com status 'N' (não faturada) ou 'B' (bloqueada)
 * - Faturadas (F) e já canceladas (C) não podem ser canceladas
 * - Libera reserva de estoque (arp_qtest_reservada) por armazém
 * - Muda status para 'C' (cancelada)
 * - Registra auditoria em dbanalise_liberacao
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codvenda, usuario } = req.body;

  if (!codvenda) {
    return res.status(400).json({ error: 'codvenda é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar status da venda
    const vendaResult = await client.query(
      'SELECT status, codcli, total FROM dbvenda WHERE codvenda = $1',
      [codvenda],
    );
    if (vendaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const { status, codcli, total } = vendaResult.rows[0];
    if (status === 'F') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Venda já faturada — não pode ser cancelada' });
    }
    if (status === 'C') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Venda já está cancelada' });
    }

    const user = usuario || 'SISTEMA';

    // 2. Buscar itens para liberar reserva
    const itens = await client.query(
      'SELECT codprod, qtd, arm_id FROM dbitvenda WHERE codvenda = $1',
      [codvenda],
    );

    // 3. Liberar reserva de estoque por armazém
    for (const item of itens.rows) {
      const qtd = Number(item.qtd);
      if (qtd > 0 && item.arm_id) {
        await client.query(
          `UPDATE cad_armazem_produto
           SET arp_qtest_reservada = GREATEST(COALESCE(arp_qtest_reservada, 0) - $2, 0)
           WHERE arp_codprod = $1 AND arp_arm_id = $3`,
          [item.codprod, qtd, item.arm_id],
        );
      }
    }

    // 4. Mudar status para cancelada
    await client.query(
      "UPDATE dbvenda SET status = 'C' WHERE codvenda = $1",
      [codvenda],
    );

    // 5. Reduzir débito do cliente
    if (codcli && Number(total) > 0) {
      await client.query(
        `UPDATE dbclien SET debito = GREATEST(COALESCE(debito, 0) - $1, 0) WHERE codcli = $2`,
        [Number(total), codcli],
      );
    }

    // 6. Registrar auditoria
    await client.query(
      `INSERT INTO dbanalise_liberacao (codvenda, resultado, usuario, dt_conclusao)
       VALUES ($1, 'CANCELADA', $2, NOW())`,
      [codvenda, user],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      ok: true,
      message: `Venda ${codvenda} cancelada. Estoque reservado liberado (${itens.rows.length} itens).`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao cancelar venda:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
