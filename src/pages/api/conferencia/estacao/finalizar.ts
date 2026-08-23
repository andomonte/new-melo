import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

/**
 * Estação de Conferência — finalizar conferência.
 *
 * Regras:
 *  - conferente autenticado por matrícula + código (dbfunc_estoque)
 *  - só o conferente que INICIOU pode finalizar (WHERE conferente=matricula)
 *  - venda precisa estar em statuspedido='4'
 *  - grava statuspedido='5' (Conferido), finalizadopedido=NOW()
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const codvenda = String(req.body?.codvenda ?? '').trim();
  if (!codvenda) return res.status(400).json({ error: 'Pedido não informado.', code: 'PEDIDO_OBRIGATORIO' });

  const filial = String(req.body?.filial || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const auth = await autenticarSeparador(client, req.body?.matricula, req.body?.codigo);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code });
    if (auth.primeiroAcesso) {
      return res.status(200).json({ code: 'PRIMEIRO_ACESSO', matricula: auth.matricula, nome: auth.nome });
    }
    const func = { matricula: auth.matricula, nome: auth.nome };

    const upd = await client.query(
      `UPDATE dbvenda
          SET statuspedido='5', finalizadopedido=NOW(), dtupdate=NOW()
        WHERE codvenda=$1 AND statuspedido='4' AND conferente=$2
        RETURNING codvenda, nrovenda, inicioconferencia AS inicio, finalizadopedido AS fim`,
      [codvenda, func.matricula],
    );

    if (upd.rowCount === 0) {
      const chk = await client.query(
        `SELECT statuspedido, conferente FROM dbvenda WHERE codvenda=$1 LIMIT 1`,
        [codvenda],
      );
      const row = chk.rows[0];
      if (!row) return res.status(404).json({ error: 'Pedido não encontrado.', code: 'PEDIDO_NAO_ENCONTRADO' });
      if (row.statuspedido !== '4') return res.status(409).json({ error: 'Este pedido não está em conferência.', code: 'STATUS_INVALIDO' });
      if (row.conferente !== func.matricula) return res.status(403).json({ error: 'Apenas o conferente que iniciou pode finalizar este pedido.', code: 'NAO_E_DONO' });
      return res.status(409).json({ error: 'Não foi possível finalizar.', code: 'CONCORRENCIA' });
    }

    return res.status(200).json({
      message: 'Conferência finalizada com sucesso',
      data: {
        codvenda: upd.rows[0].codvenda,
        nrovenda: upd.rows[0].nrovenda,
        nome: func.nome,
        inicio: upd.rows[0].inicio,
        fim: upd.rows[0].fim,
      },
    });
  } catch (error) {
    console.error('Erro em conferencia/estacao/finalizar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
