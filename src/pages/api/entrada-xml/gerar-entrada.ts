import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * POST /api/entrada-xml/gerar-entrada
 *
 * Marca a NFe como processada (exec='S') após a associação de itens.
 * A geração efetiva da entrada de estoque é feita separadamente
 * via /api/entradas/gerar-por-chave na tela de Entradas.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.body;

  if (!nfeId) {
    return res.status(400).json({ error: 'NFE ID é obrigatório' });
  }

  const isTestNfe = typeof nfeId === 'string' && (
    nfeId.startsWith('MOCK') ||
    nfeId.startsWith('99') ||
    isNaN(parseInt(nfeId))
  );

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');

    if (!isTestNfe) {
      // Lock para prevenir concorrência
      const lockResult = await client.query(`
        SELECT codnfe_ent, exec as status, nnf as numero_nf
        FROM db_manaus.dbnfe_ent
        WHERE codnfe_ent = $1
        FOR UPDATE NOWAIT
      `, [nfeId]);

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NFe não encontrada' });
      }

      const nfeStatus = lockResult.rows[0].status;
      if (nfeStatus === 'S') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Esta NFe já foi processada (NF: ${lockResult.rows[0].numero_nf})`
        });
      }

      // Verificar se existem associações salvas
      const associacoesCount = await client.query(`
        SELECT COUNT(*) as count
        FROM db_manaus.nfe_item_associacao
        WHERE nfe_id = $1 AND status != 'ASSOCIADO_TESTE'
      `, [nfeId]);

      if (Number(associacoesCount.rows[0].count) === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Nenhuma associação encontrada para esta NFe. Execute a associação de itens primeiro.'
        });
      }

      // Marcar NFe como processada
      await client.query(`
        UPDATE db_manaus.dbnfe_ent
        SET exec = 'S'
        WHERE codnfe_ent = $1
      `, [nfeId]);

      console.log(`✅ NFe ${nfeId} marcada como PROCESSADA (exec='S')`);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'NFe processada com sucesso. Gere a entrada na tela de Entradas de Mercadorias.',
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');

    if (error.code === '55P03') {
      return res.status(409).json({
        error: 'Esta NFe está sendo processada por outro usuário. Aguarde alguns instantes e tente novamente.'
      });
    }

    console.error('Erro ao processar NFe:', error);
    return res.status(500).json({
      error: 'Erro ao processar NFe',
      details: error.message
    });

  } finally {
    if (client) client.release();
  }
}
