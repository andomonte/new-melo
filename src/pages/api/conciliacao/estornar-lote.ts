import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/conciliacao/estornar-lote { lote_id, usuario }
 *
 * Estorna TODAS as linhas conciliadas de um lote (reverte baixas + cancela comprovantes),
 * numa única transação. Mesma lógica do /estornar por linha, aplicada em massa.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { lote_id, usuario } = req.body || {};
  if (!lote_id) return res.status(400).json({ erro: 'Informe lote_id.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const linRes = await client.query(
      `SELECT lin_id, lin_titulo, lin_aut_id, lin_codcli FROM conc_linha
        WHERE lin_lote_id = $1 AND lin_status = 'conciliado'`,
      [lote_id],
    );
    if (linRes.rows.length === 0) return res.status(200).json({ sucesso: true, estornadas: 0, mensagem: 'Nenhuma linha conciliada neste lote.' });

    await client.query('BEGIN');
    try {
      let estornadas = 0;
      for (const linha of linRes.rows) {
        const codRecebs: string[] = String(linha.lin_titulo || '').split(',').map((s) => s.trim()).filter(Boolean);
        for (const codReceb of codRecebs) {
          const t = await client.query(`SELECT cancel FROM dbreceb WHERE cod_receb = $1 FOR UPDATE`, [codReceb]);
          if (t.rows.length === 0 || t.rows[0].cancel === 'S') continue;
          await client.query(`UPDATE dbreceb SET rec = NULL, dt_pgto = NULL, valor_rec = 0 WHERE cod_receb = $1`, [codReceb]);
          await client.query(
            `INSERT INTO dbfreceb (cod_freceb, cod_receb, valor, dt_pgto, dt_emissao, tipo, sf, nome)
             VALUES ((SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)),0)+1 FROM dbfreceb WHERE cod_receb=$1),
                     $1, 0, CURRENT_DATE, CURRENT_DATE, 'E', 'N', 'Estorno conciliação (lote)')`,
            [codReceb],
          );
        }
        if (linha.lin_aut_id) {
          await client.query(`UPDATE fin_autenticacao SET aut_cancel = 1 WHERE aut_id = $1::numeric`, [String(linha.lin_aut_id)]);
        }
        const novoStatus = linha.lin_codcli ? 'pendente' : 'a_identificar';
        await client.query(
          `UPDATE conc_linha SET lin_status = $2, lin_titulo = NULL, lin_aut_id = NULL WHERE lin_id = $1`,
          [linha.lin_id, novoStatus],
        );
        estornadas++;
      }

      await client
        .query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1,'ESTORNO CONCILIACAO LOTE','CONC_LOTE',$2,now())`,
          [String(usuario ?? '').substring(0, 60) || 'DESCONHECIDO', `LOTE:${lote_id} | LINHAS:${estornadas}`.substring(0, 255)],
        )
        .catch(() => {});

      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, estornadas });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao estornar lote:', error);
    return res.status(500).json({ erro: 'Erro ao estornar lote', detalhes: error.message });
  } finally {
    client.release();
  }
}
