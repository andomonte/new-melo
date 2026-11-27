/**
 * Devolução de compra MANUAL (Faturamento › Devolução › Nova devolução), como a
 * tela de devolução do Delphi. Regras em lib/compras/devolucaoManual.ts.
 *
 * GET  ?etapa=entradas&filtro=CODIGO|NF|CHAVE&valor=…  → entradas encontradas (com bloqueio)
 * GET  ?etapa=itens&codent=…[&codcli=…]               → itens disponíveis por armazém + destinatário
 * POST { codent, itens:[{codprod,codreq,armId,qtd,motivo}], codcli?, pedido?, obs?, username? }
 *      → grava a devolução aberta + pré-pedido (reserva no armazém de origem)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolFilial } from '@/lib/pg';
import {
  buscarEntradasParaDevolucao,
  conferirDestinatario,
  criarDevolucaoManual,
  destinatarioDaEntrada,
  FiltroEntrada,
  itensDisponiveisDevolucao,
} from '@/lib/compras/devolucaoManual';
import { MOTIVOS_DEVOLUCAO_MANUAL } from '@/lib/compras/devolucaoEntrada';
import { resolverCodusrDelphi } from '@/lib/usuario/codusrDelphi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = await getPgPoolFilial(req);
  const cookies = parseCookies({ req });

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const etapa = String(req.query.etapa || '');
      if (etapa === 'entradas') {
        const filtro = String(req.query.filtro || 'NF').toUpperCase() as FiltroEntrada;
        if (!['CODIGO', 'NF', 'CHAVE'].includes(filtro)) return res.status(400).json({ message: 'Filtro inválido' });
        const data = await buscarEntradasParaDevolucao(pool, filtro, String(req.query.valor || ''));
        return res.status(200).json({ success: true, data });
      }
      if (etapa === 'itens') {
        const codent = String(req.query.codent || '').replace(/\D/g, '').padStart(9, '0');
        const [entrada] = await buscarEntradasParaDevolucao(pool, 'CODIGO', codent);
        if (!entrada) return res.status(404).json({ message: 'Entrada não encontrada' });
        const itens = await itensDisponiveisDevolucao(pool, codent);
        const codcli = req.query.codcli ? String(req.query.codcli).trim() : null;
        const dest = await destinatarioDaEntrada(pool, codent, codcli);
        if (codcli && !dest.cliente) return res.status(404).json({ message: `Cliente ${codcli} não encontrado` });
        const divergencia = dest.cliente
          ? conferirDestinatario({ cpfcgc: entrada.cpfcgc, iest: entrada.iest }, dest.cliente, entrada.cfop)
          : null;
        return res.status(200).json({
          success: true,
          data: { entrada, itens, destinatario: dest.cliente, seraCriado: dest.seraCriado, divergencia, motivos: MOTIVOS_DEVOLUCAO_MANUAL },
        });
      }
      return res.status(400).json({ message: 'Etapa inválida' });
    } catch (e: any) {
      console.error('Erro na devolução manual (consulta):', e);
      return res.status(500).json({ message: e.message || 'Erro ao consultar' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const { codent, itens, codcli, pedido, obs, username } = req.body || {};
  if (!codent || !Array.isArray(itens)) return res.status(400).json({ message: 'Informe a entrada e os itens' });
  const usuario = String(username || cookies.userName || 'Sistema');
  const client = await pool.connect();
  try {
    const usr = await resolverCodusrDelphi(req, client, usuario).catch(() => ({ codusr: null as string | null }));
    await client.query('BEGIN');
    const r = await criarDevolucaoManual(client, {
      codent: String(codent),
      itens: itens.map((i: any) => ({
        codprod: String(i.codprod),
        codreq: i.codreq == null || i.codreq === '' ? null : String(i.codreq),
        armId: Number(i.armId),
        qtd: Number(i.qtd),
        motivo: String(i.motivo || '').toUpperCase(),
      })),
      codcli: codcli ? String(codcli) : null,
      pedido: pedido ? String(pedido) : null,
      obs: obs ? String(obs) : null,
      matricula: usuario,
      nomeusr: usuario,
      codusr: usr?.codusr ?? null,
    });
    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Devolução ${r.devId} gravada · pré-pedido ${r.nrovenda}${r.clienteCriado ? ` · cliente ${r.codcli} cadastrado automaticamente` : ''}`,
      data: r,
    });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro na devolução manual:', e);
    return res.status(400).json({ message: e.message || 'Erro ao gravar a devolução' });
  } finally {
    client.release();
  }
}
