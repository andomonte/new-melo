/**
 * POST /api/devolucao/acao
 * Ações numa devolução de compra aberta (iniciada pela alocação no web).
 *
 * Body:
 *   devId     — nº da devolução (fat_devolucao.dev_id)
 *   acao      — 'cancelar'        → o fornecedor completou a entrega / item aceito: a quantidade
 *                                   sai do armazém DEVOLUCAO/FALTA para o GERAL e fica disponível;
 *                                   o pré-pedido é cancelado.
 *               'gerar-prepedido' → para devolução que nasceu sem cliente do fornecedor.
 *               'estornar-faturamento' → devolução faturada cuja NF não foi autorizada: desfaz a
 *                                   fatura/título/baixa e volta para aguardando emissão.
 *   codcli?   — cliente da devolução (gerar-prepedido, quando o fornecedor não tem vínculo)
 *   username? — quem executou
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { cancelarDevolucaoEntrada, gerarPrePedidoDevolucao } from '@/lib/compras/devolucaoEntrada';
import { estornarFaturamentoDevolucao } from '@/lib/compras/faturarDevolucao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { devId, acao, codcli, username } = req.body || {};
  if (!devId || !/^\d+$/.test(String(devId))) return res.status(400).json({ message: 'Devolução inválida' });
  if (!['cancelar', 'gerar-prepedido', 'estornar-faturamento'].includes(acao)) return res.status(400).json({ message: 'Ação inválida' });

  const cookies = parseCookies({ req });
  const usuario = String(username || cookies.userName || 'Sistema');
  const pool = getPgPool(cookies.filial_melo || 'MANAUS');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let resultado: any = null;
    if (acao === 'cancelar') {
      await cancelarDevolucaoEntrada(client, String(devId), usuario);
    } else if (acao === 'estornar-faturamento') {
      resultado = await estornarFaturamentoDevolucao(client, String(devId), { usuario });
    } else {
      resultado = await gerarPrePedidoDevolucao(client, String(devId), codcli ? String(codcli) : null);
    }
    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: acao === 'cancelar'
        ? `Devolução ${devId} cancelada: quantidade liberada para venda`
        : acao === 'estornar-faturamento'
        ? `Faturamento estornado (fatura ${resultado.codfat} cancelada). A devolução ${devId} voltou para aguardando emissão; a NF ${Number(resultado.nroform)} será reaproveitada na próxima emissão`
        : `Pré-pedido ${resultado.nrovenda} gerado para a devolução ${devId}`,
      data: resultado,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro na ação da devolução:', error);
    return res.status(400).json({ message: error.message || 'Erro na ação da devolução' });
  } finally {
    client.release();
  }
}
