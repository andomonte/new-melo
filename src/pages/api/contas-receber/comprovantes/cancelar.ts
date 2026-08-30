import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/contas-receber/comprovantes/cancelar  { aut_id, usuario, motivo? }
 *
 * Espelha spComprovante_Cancelar do Delphi: cancela o comprovante (aut_cancel=1) e ESTORNA
 * os títulos dele — reverte rec/dt_pgto/valor_rec e grava lançamento 'E' em dbfreceb
 * (mesma reversão do "Retirar Baixa"). Bloqueia se já cancelado.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });

  const { aut_id, usuario, motivo } = req.body || {};
  if (!aut_id) return res.status(400).json({ erro: 'Informe o aut_id.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const cab = await client.query(
      `SELECT COALESCE(aut_cancel,0) AS aut_cancel FROM fin_autenticacao WHERE aut_id = $1::numeric`,
      [String(aut_id)],
    );
    if (cab.rows.length === 0) return res.status(404).json({ erro: 'Comprovante não encontrado.' });
    if (Number(cab.rows[0].aut_cancel) === 1) return res.status(400).json({ erro: 'Comprovante já cancelado.' });

    const itens = await client.query(
      `SELECT ita_cod_receb FROM fin_item_autenticacao WHERE ita_id = $1::numeric`,
      [String(aut_id)],
    );
    const codRecebs: string[] = itens.rows.map((r) => String(r.ita_cod_receb)).filter(Boolean);

    await client.query('BEGIN');
    try {
      let estornados = 0;
      for (const codReceb of codRecebs) {
        const t = await client.query(
          `SELECT rec, cancel FROM dbreceb WHERE cod_receb = $1 FOR UPDATE`,
          [codReceb],
        );
        if (t.rows.length === 0) continue;
        if (t.rows[0].cancel === 'S') continue; // título já cancelado — pula
        // Reverte o recebimento (igual ao Retirar Baixa).
        await client.query(
          `UPDATE dbreceb SET rec = NULL, dt_pgto = NULL, valor_rec = 0 WHERE cod_receb = $1`,
          [codReceb],
        );
        await client.query(
          `INSERT INTO dbfreceb (cod_freceb, cod_receb, valor, dt_pgto, dt_emissao, tipo, sf, nome)
           VALUES ((SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)),0)+1 FROM dbfreceb WHERE cod_receb=$1),
                   $1, 0, CURRENT_DATE, CURRENT_DATE, 'E', 'N', $2)`,
          [codReceb, `Estorno comprovante ${aut_id}${motivo ? ' — ' + motivo : ''}`.substring(0, 60)],
        );
        estornados++;
      }

      await client.query(`UPDATE fin_autenticacao SET aut_cancel = 1 WHERE aut_id = $1::numeric`, [String(aut_id)]);

      // Log da ação (dbacao) — quem cancelou e por quê.
      await client
        .query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1, 'CANCELAR COMPROVANTE', 'FIN_AUTENTICACAO', $2, now())`,
          [
            String(usuario ?? '').substring(0, 60) || 'DESCONHECIDO',
            `AUT:${aut_id} | ESTORNADOS:${estornados}${motivo ? ' | MOTIVO:' + motivo : ''}`.substring(0, 255),
          ],
        )
        .catch(() => {});

      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, aut_id, estornados });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao cancelar comprovante:', error);
    return res.status(500).json({ erro: 'Erro ao cancelar comprovante', detalhes: error.message });
  } finally {
    client.release();
  }
}
