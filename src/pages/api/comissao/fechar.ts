// POST /api/comissao/fechar { ano, mes, username? }
// Fecha (paga) a comissão do mês: soma os movimentos ABERTOS por vendedor, cria/acumula
// o fechamento e marca os movimentos como PAGO. Idempotente: reexecutar só fecha os que
// ainda estiverem abertos. Débitos futuros (cancelamento de venda já paga) nascem no mês
// corrente (data de hoje) e serão pagos no próximo fechamento — nunca alteram o mês fechado.
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
  const codvend = req.body?.codvend ? String(req.body.codvend).trim() : ''; // vazio = todos os vendedores
  const username = (req.body?.username || 'WEB').toString().slice(0, 20);
  if (!ano || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ erro: 'Informe ano e mês válidos.' });
  }
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const fim = `${proxAno}-${String(proxMes).padStart(2, '0')}-01`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const filtroVend = codvend ? 'AND codvend = $6' : '';
    const params = codvend ? [inicio, fim, ano, mes, username, codvend] : [inicio, fim, ano, mes, username];

    // 1) cria/acumula o fechamento por vendedor a partir dos movimentos ABERTOS do mês
    const fech = await client.query(
      `WITH abertos AS (
         SELECT codvend, SUM(valor_comissao) AS total, COUNT(*) AS qtd
           FROM db_manaus.fin_comissao_mov
          WHERE data_mov >= $1 AND data_mov < $2 AND status = 'A' ${filtroVend}
          GROUP BY codvend
       )
       INSERT INTO db_manaus.fin_comissao_fechamento (codvend, ano, mes, total, qtd_mov, fechado_por)
       SELECT codvend, $3, $4, total, qtd, $5 FROM abertos
       ON CONFLICT (codvend, ano, mes) DO UPDATE
         SET total   = db_manaus.fin_comissao_fechamento.total   + EXCLUDED.total,
             qtd_mov = db_manaus.fin_comissao_fechamento.qtd_mov + EXCLUDED.qtd_mov,
             fechado_em = now(), fechado_por = EXCLUDED.fechado_por
       RETURNING id, codvend, total`,
      params,
    );

    // 2) marca os movimentos abertos do mês como PAGO, vinculando ao fechamento do vendedor
    const upd = await client.query(
      `UPDATE db_manaus.fin_comissao_mov m
          SET status = 'P', fechamento_id = fc.id
         FROM db_manaus.fin_comissao_fechamento fc
        WHERE fc.ano = $3 AND fc.mes = $4 AND fc.codvend = m.codvend
          AND m.data_mov >= $1 AND m.data_mov < $2 AND m.status = 'A'
          ${codvend ? 'AND m.codvend = $5' : ''}`,
      codvend ? [inicio, fim, ano, mes, codvend] : [inicio, fim, ano, mes],
    );

    await client.query('COMMIT');
    const totalPago = fech.rows.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
    return res.status(200).json({
      sucesso: true,
      ano,
      mes,
      vendedores: fech.rows.length,
      movimentos_pagos: upd.rowCount || 0,
      total_pago: totalPago,
      escopo: codvend ? `vendedor ${codvend}` : 'todos os vendedores',
      mensagem: `Fechado (${codvend ? `vendedor ${codvend}` : 'todos'}): ${fech.rows.length} vendedor(es), ${upd.rowCount} movimento(s), total R$ ${totalPago.toFixed(2)}.`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao fechar comissão:', error);
    return res.status(500).json({ erro: 'Erro ao fechar comissão', detalhes: error.message });
  } finally {
    client.release();
  }
}
