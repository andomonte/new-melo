/**
 * POST /api/devolucao/transmitir   Body: { devId }
 * Retransmite a NF-e de uma devolução de compra já faturada cuja NF não foi autorizada
 * (rejeição ou falha de comunicação). A fatura não muda.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { emitirNfeDevolucaoCompra } from '@/lib/fiscal/emitirNfeDevolucaoCompra';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  const devId = String(req.body?.devId ?? '');
  if (!/^\d+$/.test(devId)) return res.status(400).json({ message: 'Devolução inválida' });

  const client = await (await getPgPoolFilial(req)).connect();
  try {
    const schema = (await client.query(`SELECT current_schema() AS s`)).rows[0]?.s || 'db_manaus';
    const d = (await client.query(
      `SELECT dev_codfat, dev_status, dev_origem FROM fat_devolucao WHERE dev_id = $1`,
      [devId],
    )).rows[0];
    if (!d) return res.status(404).json({ message: 'Devolução não encontrada' });
    if (d.dev_origem !== 'WEB' || !d.dev_codfat) {
      return res.status(400).json({ message: 'Esta devolução não tem fatura do web para transmitir' });
    }
    const nfe = await emitirNfeDevolucaoCompra(client, d.dev_codfat, schema);
    return res.status(200).json({ success: nfe.autorizada, nfe, message: `${nfe.status} - ${nfe.motivo}` });
  } catch (e: any) {
    console.error('Erro ao retransmitir NF de devolução:', e);
    return res.status(400).json({ message: e.message || 'Erro ao transmitir' });
  } finally {
    client.release();
  }
}
