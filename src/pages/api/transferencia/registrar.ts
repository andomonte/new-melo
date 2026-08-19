import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/transferencia/registrar
 *   { codent, codcli_destino, codfat, arm_id_origem, username, transp?, codtptransp?, vlr_frete?, pedido?, obs?,
 *     itens:[{codprod, qtd, pr_transf}] }
 * Grava o cabeçalho/itens da transferência (arm_transferencia) já com status ENVIADO
 * (NF-e emitida + estoque baixado na origem pelo salvar) e soma dbitent.qtd_transferido.
 * Chamado pelo orquestrador APÓS faturar+emitir com sucesso.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const b = req.body || {};
  const codent = String(b.codent || '').trim();
  const codcli = String(b.codcli_destino || '').trim();
  const codfat = String(b.codfat || '').trim();
  const itens = Array.isArray(b.itens) ? b.itens : [];
  if (!codent || !codcli || !codfat || itens.length === 0) {
    return res.status(400).json({ erro: 'Obrigatórios: codent, codcli_destino, codfat, itens[].' });
  }

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const idr = await client.query(`SELECT COALESCE(MAX(tra_id),0)+1 AS n FROM db_manaus.arm_transferencia`);
    const traId = Number(idr.rows[0].n);

    await client.query(
      `INSERT INTO db_manaus.arm_transferencia
         (tra_id, tra_arm_id_origem, tra_arm_id_destino, tra_codusr_emissao, tra_data,
          tra_transp, tra_pedido, tra_obs, tra_status, tra_cancel,
          tra_codent, tra_codcli_destino, tra_codfat, tra_vlr_frete, tra_codtptransp)
       VALUES ($1,$2,NULL,$3,NOW(),$4,$5,$6,'ENVIADO','N',$7,$8,$9,$10,$11)`,
      [traId, b.arm_id_origem ?? null, String(b.username || ''), b.transp ?? null, b.pedido ?? null,
       b.obs ?? null, codent, codcli, codfat, Number(b.vlr_frete || 0), b.codtptransp ?? null],
    );

    for (const it of itens) {
      await client.query(
        `INSERT INTO db_manaus.arm_it_transferencia (itt_tra_id, itt_codprod, itt_qtd, itt_codent, itt_prunit)
         VALUES ($1,$2,$3,$4,$5)`,
        [traId, it.codprod, Number(it.qtd || 0), codent, Number(it.pr_transf || 0)],
      );
      await client.query(
        `UPDATE db_manaus.dbitent
            SET qtd_transferido = COALESCE(qtd_transferido,0) + $1
          WHERE codent=$2 AND codprod=$3`,
        [Number(it.qtd || 0), codent, it.codprod],
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ sucesso: true, tra_id: traId, itens: itens.length });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao registrar transferência:', error);
    return res.status(500).json({ erro: 'Erro ao registrar transferência', detalhes: error.message });
  } finally {
    client.release();
  }
}
