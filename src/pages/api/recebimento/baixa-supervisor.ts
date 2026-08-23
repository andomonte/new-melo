import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import type { PoolClient } from 'pg';

/**
 * Baixa de SUPERVISOR (login normal do sistema) para separação/conferência
 * pendentes — usado na tela de Recebimento para dar baixa em atrasados cujo
 * separador/conferente não está disponível.
 *
 * - status '2' (Em Separação) → '3' (Separado), fimseparacao=NOW
 * - status '4' (Em Conferência) → '5' (Conferido), finalizadopedido=NOW
 * Registra quem deu baixa em dbacao. NÃO exige que seja o mesmo separador/conferente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  const nrovenda = String(req.body?.nrovenda ?? '').trim();
  const username = String(req.body?.username ?? '').trim() || 'SUPERVISOR';
  if (!nrovenda) return res.status(400).json({ erro: 'Informe o número do pedido.' });

  const filial = String(req.body?.filial || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const v = await client.query(
      `SELECT codvenda, nrovenda, statuspedido, separador, conferente
         FROM dbvenda
        WHERE regexp_replace(COALESCE(nrovenda,''), '^0+', '') = regexp_replace($1, '^0+', '')
        ORDER BY data DESC NULLS LAST LIMIT 1`,
      [nrovenda],
    );
    if (v.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: `Pedido ${nrovenda} não encontrado.` });
    }
    const venda = v.rows[0];

    let novoStatus: string;
    let acao: string;
    let upd;
    if (venda.statuspedido === '2') {
      novoStatus = '3';
      acao = 'BAIXA_SEPARACAO';
      upd = await client.query(
        `UPDATE dbvenda SET statuspedido='3', fimseparacao=NOW(), dtupdate=NOW()
          WHERE codvenda=$1 AND statuspedido='2' RETURNING codvenda, nrovenda`,
        [venda.codvenda],
      );
    } else if (venda.statuspedido === '4') {
      novoStatus = '5';
      acao = 'BAIXA_CONFERENCIA';
      upd = await client.query(
        `UPDATE dbvenda SET statuspedido='5', finalizadopedido=NOW(), dtupdate=NOW()
          WHERE codvenda=$1 AND statuspedido='4' RETURNING codvenda, nrovenda`,
        [venda.codvenda],
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(409).json({
        erro: `Pedido ${venda.nrovenda} não está em separação nem em conferência (status ${venda.statuspedido ?? '—'}).`,
      });
    }

    if (!upd || upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Não foi possível dar baixa — o pedido pode ter sido alterado.' });
    }

    // Log da ação (não bloqueia a baixa se dbacao não existir no schema)
    try {
      const responsavel = venda.statuspedido === '2' ? venda.separador : venda.conferente;
      await client.query(
        `INSERT INTO dbacao (codusr, acao, tabela, obs, data) VALUES ($1, $2, 'DBVENDA', $3, now())`,
        [
          username.substring(0, 60),
          acao,
          `NROVENDA:${venda.nrovenda} | BAIXA SUPERVISOR | iniciado por: ${responsavel || '—'}`.substring(0, 255),
        ],
      );
    } catch (e) {
      console.warn('dbacao não registrado (schema sem tabela?):', (e as Error).message);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      sucesso: true,
      nrovenda: venda.nrovenda,
      de: venda.statuspedido,
      para: novoStatus,
      mensagem: acao === 'BAIXA_SEPARACAO' ? 'Separação finalizada (baixa do supervisor).' : 'Conferência finalizada (baixa do supervisor).',
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Erro na baixa do supervisor:', error);
    return res.status(500).json({ erro: 'Erro ao dar baixa', detalhes: error.message });
  } finally {
    if (client) client.release();
  }
}
