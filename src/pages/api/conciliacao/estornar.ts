import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/conciliacao/estornar { lin_id, usuario }
 *
 * Estorna a conciliação de UMA linha: reverte a baixa dos títulos (rec/dt_pgto/valor_rec + 'E'
 * em dbfreceb, igual ao Retirar Baixa), cancela o comprovante (aut_cancel=1) e volta a linha
 * para 'pendente' (ou 'a_identificar' se não havia cliente). Transação única.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { lin_id, usuario } = req.body || {};
  if (!lin_id) return res.status(400).json({ erro: 'Informe lin_id.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const linRes = await client.query(
      `SELECT lin_titulo, lin_aut_id, lin_status, lin_codcli FROM conc_linha WHERE lin_id = $1`,
      [lin_id],
    );
    if (linRes.rows.length === 0) return res.status(404).json({ erro: 'Linha não encontrada.' });
    const linha = linRes.rows[0];
    if (linha.lin_status !== 'conciliado') return res.status(400).json({ erro: 'Linha não está conciliada.' });
    const codRecebs: string[] = String(linha.lin_titulo || '').split(',').map((s) => s.trim()).filter(Boolean);

    await client.query('BEGIN');
    try {
      for (const codReceb of codRecebs) {
        const t = await client.query(`SELECT cancel FROM dbreceb WHERE cod_receb = $1 FOR UPDATE`, [codReceb]);
        if (t.rows.length === 0 || t.rows[0].cancel === 'S') continue;
        await client.query(
          `UPDATE dbreceb SET rec = NULL, dt_pgto = NULL, valor_rec = 0 WHERE cod_receb = $1`,
          [codReceb],
        );
        await client.query(
          `INSERT INTO dbfreceb (cod_freceb, cod_receb, valor, dt_pgto, dt_emissao, tipo, sf, nome)
           VALUES ((SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)),0)+1 FROM dbfreceb WHERE cod_receb=$1),
                   $1, 0, CURRENT_DATE, CURRENT_DATE, 'E', 'N', 'Estorno conciliação')`,
          [codReceb],
        );
      }

      if (linha.lin_aut_id) {
        await client.query(`UPDATE fin_autenticacao SET aut_cancel = 1 WHERE aut_id = $1::numeric`, [String(linha.lin_aut_id)]);
      }

      const novoStatus = linha.lin_codcli ? 'pendente' : 'a_identificar';
      await client.query(
        `UPDATE conc_linha SET lin_status = $2, lin_titulo = NULL, lin_aut_id = NULL WHERE lin_id = $1`,
        [lin_id, novoStatus],
      );

      await client
        .query(
          `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
           VALUES ($1,'ESTORNO CONCILIACAO','CONC_LINHA',$2,now())`,
          [String(usuario ?? '').substring(0, 60) || 'DESCONHECIDO', `LIN:${lin_id} | TIT:${codRecebs.join(',')}`.substring(0, 255)],
        )
        .catch(() => {});

      await client.query('COMMIT');
      return res.status(200).json({ sucesso: true, estornados: codRecebs.length, novoStatus });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao estornar conciliação:', error);
    return res.status(500).json({ erro: 'Erro ao estornar', detalhes: error.message });
  } finally {
    client.release();
  }
}
