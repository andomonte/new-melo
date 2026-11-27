/**
 * POST /api/devolucao/emitir
 * Emite a NF de devolução de compra pela tela Faturamento › Devolução (como o
 * botão "Emitir Devolução" do Delphi):
 *   1) numa transação: fatura + itens (espelho) + baixa do armazém 1004 e da reserva +
 *      título a receber de 30 dias + devolução fechada (lib/compras/faturarDevolucao.ts);
 *   2) depois do COMMIT: transmite a NF-e (lib/fiscal/emitirNfeDevolucaoCompra.ts). Se a
 *      SEFAZ rejeitar, a fatura fica gravada e a NF pode ser retransmitida
 *      (POST /api/devolucao/transmitir), como no faturamento comum.
 *
 * Body: { devId, cfops?: {chave: cfop}, transporte?: {...}, obs?, username? }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolFilial } from '@/lib/pg';
import { faturarDevolucaoEntrada } from '@/lib/compras/faturarDevolucao';
import { conferirCertificadoEmissao, emitirNfeDevolucaoCompra } from '@/lib/fiscal/emitirNfeDevolucaoCompra';
import { resolverCodusrDelphi, MSG_SEM_CODIGO_DELPHI } from '@/lib/usuario/codusrDelphi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  const { devId, cfops, transporte, obs, username } = req.body || {};
  if (!devId || !/^\d+$/.test(String(devId))) return res.status(400).json({ message: 'Devolução inválida' });

  const cookies = parseCookies({ req });
  const pool = await getPgPoolFilial(req);
  const client = await pool.connect();
  let fat: Awaited<ReturnType<typeof faturarDevolucaoEntrada>> | null = null;
  let schema = 'db_manaus';
  try {
    schema = (await client.query(`SELECT current_schema() AS s`)).rows[0]?.s || schema;
    const usr = await resolverCodusrDelphi(req, client, String(username || cookies.userName || ''));
    if (!usr.codusr) {
      client.release();
      return res.status(400).json({ message: MSG_SEM_CODIGO_DELPHI });
    }
    // Certificado antes de gravar: erro de configuração não pode deixar fatura sem NF.
    try {
      await conferirCertificadoEmissao(client);
    } catch (e: any) {
      client.release();
      return res.status(400).json({ message: `NF não emitida e nada foi gravado: ${e?.message || e}` });
    }

    await client.query('BEGIN');
    fat = await faturarDevolucaoEntrada(client, String(devId), {
      cfops: cfops && typeof cfops === 'object' ? cfops : undefined,
      transporte,
      obs,
      codusr: usr.codusr,
      schema,
    });
    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao faturar devolução:', e);
    client.release();
    return res.status(400).json({ message: e.message || 'Erro ao faturar a devolução' });
  }

  // Transmissão fora da transação (a fatura já está gravada).
  let nfe: any = null;
  try {
    nfe = await emitirNfeDevolucaoCompra(client, fat.codfat, schema);
  } catch (e: any) {
    console.error('Erro ao transmitir NF de devolução:', e);
    nfe = { autorizada: false, status: 'ERRO', motivo: e?.message || String(e), chave: null };
  } finally {
    client.release();
  }

  return res.status(200).json({
    success: true,
    codfat: fat.codfat,
    nroform: fat.nroform,
    serie: fat.serie,
    totalnf: fat.totalnf,
    codReceb: fat.codReceb,
    nfe,
    message: nfe?.autorizada
      ? `NF ${Number(fat.nroform)} de devolução autorizada`
      : `Fatura ${fat.codfat} gravada; NF não autorizada: ${nfe?.motivo ?? ''}`,
  });
}
