// POST /api/comissao/reabrir { ano, mes, codvend? }
// Reabre o fechamento: volta os movimentos para ABERTO (status='A', fechamento_id=NULL)
// e remove o(s) fechamento(s) do mês. codvend vazio = todos os vendedores.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const ano = parseInt(String(req.body?.ano || ''), 10);
  const mes = parseInt(String(req.body?.mes || ''), 10);
  const codvend = req.body?.codvend ? String(req.body.codvend).trim() : '';
  if (!ano || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ erro: 'Informe ano e mês válidos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) volta os movimentos vinculados aos fechamentos deste mês para ABERTO
    const upd = await client.query(
      `UPDATE db_manaus.fin_comissao_mov m
          SET status = 'A', fechamento_id = NULL
         FROM db_manaus.fin_comissao_fechamento fc
        WHERE m.fechamento_id = fc.id
          AND fc.ano = $1 AND fc.mes = $2
          ${codvend ? 'AND fc.codvend = $3' : ''}`,
      codvend ? [ano, mes, codvend] : [ano, mes],
    );

    // 2) remove o(s) fechamento(s)
    const del = await client.query(
      `DELETE FROM db_manaus.fin_comissao_fechamento
        WHERE ano = $1 AND mes = $2 ${codvend ? 'AND codvend = $3' : ''}`,
      codvend ? [ano, mes, codvend] : [ano, mes],
    );

    await client.query('COMMIT');
    return res.status(200).json({
      sucesso: true,
      ano,
      mes,
      escopo: codvend ? `vendedor ${codvend}` : 'todos os vendedores',
      movimentos_reabertos: upd.rowCount || 0,
      fechamentos_removidos: del.rowCount || 0,
      mensagem: `Reaberto (${codvend ? `vendedor ${codvend}` : 'todos'}): ${upd.rowCount} movimento(s).`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao reabrir comissão:', error);
    return res.status(500).json({ erro: 'Erro ao reabrir comissão', detalhes: error.message });
  } finally {
    client.release();
  }
}
