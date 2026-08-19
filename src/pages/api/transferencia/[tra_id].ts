import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * PUT    /api/transferencia/[tra_id]  → receber (status ENVIADO → RECEBIDO). body: { username }
 * DELETE /api/transferencia/[tra_id]  → cancelar. body: { username }
 *   - EMISSAO: apaga cabeçalho+itens.
 *   - ENVIADO com NF autorizada: recusa (exige cancelamento da NF-e na SEFAZ antes).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const traId = Number(req.query.tra_id);
  if (!traId) return res.status(400).json({ erro: 'tra_id inválido.' });
  const client = await getPgPool().connect();
  try {
    const cur = await client.query(
      `SELECT tra_status, tra_codfat FROM db_manaus.arm_transferencia WHERE tra_id=$1`,
      [traId],
    );
    if (cur.rows.length === 0) return res.status(404).json({ erro: 'Transferência não encontrada.' });
    const st = cur.rows[0].tra_status;

    if (req.method === 'PUT') {
      if (st !== 'ENVIADO') return res.status(409).json({ erro: `Só recebe transferência ENVIADA (status ${st}).` });
      await client.query(
        `UPDATE db_manaus.arm_transferencia
            SET tra_status='RECEBIDO', tra_codusr_recebimento=$2, tra_data_recebimento=NOW()
          WHERE tra_id=$1`,
        [traId, String(req.body?.username || '')],
      ).catch(async () => {
        // fallback: coluna tra_data_recebimento pode não existir
        await client.query(
          `UPDATE db_manaus.arm_transferencia SET tra_status='RECEBIDO', tra_codusr_recebimento=$2 WHERE tra_id=$1`,
          [traId, String(req.body?.username || '')],
        );
      });
      return res.status(200).json({ sucesso: true, tra_id: traId, status: 'RECEBIDO' });
    }

    if (req.method === 'DELETE') {
      if (st === 'RECEBIDO') return res.status(409).json({ erro: 'Transferência já recebida — não pode cancelar.' });
      const nfe = await client.query(
        `SELECT 1 FROM db_manaus.dbfat_nfe WHERE codfat=$1 AND status='100' LIMIT 1`,
        [cur.rows[0].tra_codfat],
      );
      if (nfe.rows.length > 0) {
        return res.status(409).json({
          erro: 'NF-e AUTORIZADA — cancele a nota na SEFAZ (Consulta de Faturas) antes de cancelar a transferência.',
          code: 'NFE_AUTORIZADA',
        });
      }
      await client.query('BEGIN');
      await client.query(`DELETE FROM db_manaus.arm_it_transferencia WHERE itt_tra_id=$1`, [traId]);
      await client.query(`DELETE FROM db_manaus.arm_transferencia WHERE tra_id=$1`, [traId]);
      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, tra_id: traId, cancelada: true });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro na ação de transferência:', error);
    return res.status(500).json({ erro: 'Erro na transferência', detalhes: error.message });
  } finally {
    client.release();
  }
}
