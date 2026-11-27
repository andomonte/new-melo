/**
 * GET /api/devolucao/espelho?devId=…
 * Espelho fiscal da NF de devolução de compra (itens, CFOP sugerido, impostos espelhados da
 * NF do fornecedor, totais e pendências). Só leitura. Ver lib/compras/devolucaoEspelho.ts.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { montarEspelhoDevolucao } from '@/lib/compras/devolucaoEspelho';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  const devId = String(req.query.devId ?? '');
  if (!/^\d+$/.test(devId)) return res.status(400).json({ message: 'Devolução inválida' });

  const client = await (await getPgPoolFilial(req)).connect();
  try {
    const espelho = await montarEspelhoDevolucao(client, devId);
    return res.status(200).json(espelho);
  } catch (e: any) {
    return res.status(400).json({ message: e.message || 'Erro ao montar o espelho' });
  } finally {
    client.release();
  }
}
