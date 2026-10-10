import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/contas-receber/cancelar-lote
 * body: { cod_receb: string[], motivo: string, usuario: string }
 *
 * Cancela em LOTE apenas títulos AVULSOS (sem fatura e sem grupo: cod_fat IS NULL
 * AND codgp IS NULL). Títulos vinculados a fatura/grupo, já recebidos, já cancelados
 * ou enviados ao banco são IGNORADOS (retornados em `ignorados` com o motivo).
 *
 * Mesma gravação do cancelamento unitário (cancelar.ts): dbreceb.cancel='S',
 * lançamento 'C' em dbfreceb e log em dbacao (quem/quando/motivo).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });

  const { cod_receb, motivo, usuario } = req.body || {};
  const ids: string[] = Array.isArray(cod_receb) ? cod_receb.map(String).filter(Boolean) : cod_receb ? [String(cod_receb)] : [];
  if (ids.length === 0) return res.status(400).json({ erro: 'Informe cod_receb (lista).' });

  const motivoTxt = String(motivo ?? '').trim();
  if (motivoTxt.length < 5) return res.status(400).json({ erro: 'Informe o motivo do cancelamento (mínimo 5 caracteres).' });
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      // Próximo cod_freceb global (varchar numérico) — incrementado a cada lançamento
      // para não colidir dentro do lote.
      const mx = await client.query(`SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)), 0) AS m FROM dbfreceb`);
      let proxFreceb = Number(mx.rows[0]?.m || 0);

      const cancelados: string[] = [];
      const ignorados: { cod_receb: string; motivo: string }[] = [];

      for (const id of ids) {
        const t = await client.query(
          `SELECT cod_receb, cancel, rec, bradesco, cod_fat, codgp
           FROM dbreceb WHERE cod_receb=$1 FOR UPDATE`,
          [id],
        );
        if (t.rows.length === 0) { ignorados.push({ cod_receb: id, motivo: 'não encontrado' }); continue; }
        const r = t.rows[0];
        if (r.cancel === 'S') { ignorados.push({ cod_receb: id, motivo: 'já cancelado' }); continue; }
        if (r.rec === 'S') { ignorados.push({ cod_receb: id, motivo: 'já recebido' }); continue; }
        if (r.bradesco === 'S' || r.bradesco === 'B') { ignorados.push({ cod_receb: id, motivo: 'enviado ao banco' }); continue; }
        // Regra do lote: só AVULSO (sem fatura e sem grupo).
        if (r.cod_fat != null || r.codgp != null) { ignorados.push({ cod_receb: id, motivo: 'vinculado a fatura/grupo (não é avulso)' }); continue; }

        await client.query(`UPDATE dbreceb SET cancel='S' WHERE cod_receb=$1`, [id]);
        proxFreceb += 1;
        await client.query(
          `INSERT INTO dbfreceb (cod_freceb, cod_receb, valor, dt_pgto, dt_emissao, tipo, sf, nome)
           VALUES ($1, $2, 0, CURRENT_DATE, CURRENT_DATE, 'C', 'N', $3)`,
          [String(proxFreceb), id, motivoTxt.substring(0, 100)],
        );
        cancelados.push(id);
      }

      // Log de ação (um registro para o lote), igual ao padrão de auditoria.
      if (cancelados.length > 0) {
        await client
          .query(
            `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
             VALUES ($1, 'CANCEL.TITULO', 'DBRECEB', $2, now())`,
            [usuarioTxt.substring(0, 60), `LOTE COD:${cancelados.join(',')} | MOTIVO: ${motivoTxt}`.substring(0, 255)],
          )
          .catch(() => {});
      }

      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, cancelados: cancelados.length, titulos: cancelados, ignorados });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao cancelar títulos em lote:', error);
    return res.status(500).json({ erro: 'Erro ao cancelar títulos em lote', detalhes: error.message });
  } finally {
    client.release();
  }
}
