import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface ConfirmarEstoqueRequest {
  observacao?: string;
}

interface ConfirmarEstoqueResponse {
  success: boolean;
  message: string;
}

/**
 * Confirmar Estoque — modelo Delphi (dbent/dbent_recebimento).
 * Libera a entrada para recebimento físico: avança o workflow
 * PRECO_CONFIRMADO → AGUARDANDO_RECEBIMENTO e garante o romaneio (dbitent_armazem).
 * NÃO atualiza estoque (isso ocorre ao finalizar a alocação).
 *
 * Obs.: a criação da operação de recebimento (entrada_operacoes) faz parte do fluxo
 * físico (Fatia C) e ainda usa chave inteira; será realinhada ao codent nessa fase.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmarEstoqueResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao }: ConfirmarEstoqueRequest = req.body || {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID (codent) da entrada é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  const ARMAZEM_PADRAO = 1003;

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    const entResult = await client.query(
      `SELECT e.codent, rec.status AS rec_status
         FROM dbent e
         LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
        WHERE e.codent = $1`,
      [id]
    );
    if (entResult.rows.length === 0) {
      throw new Error('Entrada não encontrada');
    }
    const ent = entResult.rows[0];
    if (ent.rec_status !== 'PRECO_CONFIRMADO') {
      throw new Error(`Não é possível liberar para recebimento. Confirme o preço primeiro. Status atual: ${ent.rec_status || 'PENDENTE'}`);
    }

    // Romaneio: se não houver, cria automático com armazém padrão a partir de dbitent
    const romaneioResult = await client.query(
      `SELECT COUNT(*) AS total FROM dbitent_armazem WHERE codent = $1`,
      [id]
    );
    const temRomaneio = parseInt(romaneioResult.rows[0].total, 10) > 0;

    if (!temRomaneio) {
      const itensResult = await client.query(
        `SELECT codprod, codreq, quant FROM dbitent WHERE codent = $1`,
        [id]
      );
      for (const item of itensResult.rows) {
        await client.query(
          `INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [id, item.codprod, item.codreq, ARMAZEM_PADRAO, parseFloat(item.quant)]
        );
      }
      console.log(`Romaneio automático criado p/ ${id}: ${itensResult.rows.length} itens → armazém ${ARMAZEM_PADRAO}`);
    }

    // Avança o workflow físico
    await client.query(
      `UPDATE dbent_recebimento
          SET status = 'AGUARDANDO_RECEBIMENTO',
              data_confirmacao_estoque = now(),
              observacao_estoque = $2,
              updated_at = now()
        WHERE codent = $1`,
      [id, observacao || null]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: temRomaneio
        ? `Entrada ${id} liberada para recebimento (romaneio planejado).`
        : `Entrada ${id} liberada para recebimento (romaneio automático, armazém ${ARMAZEM_PADRAO}).`,
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao confirmar estoque:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao confirmar estoque.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
