import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

/**
 * Estação de Separação — finalizar separação.
 *
 * Regras:
 *  - separador autenticado por matrícula + código (dbfunc_estoque)
 *  - só o separador que INICIOU pode finalizar (WHERE separador=matricula)
 *  - venda precisa estar em statuspedido='2'
 *  - grava statuspedido='3', fimseparacao=NOW()
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
          SET statuspedido='3', fimseparacao=NOW(), dtupdate=NOW()
        WHERE codvenda=$1 AND statuspedido='2' AND separador=$2
        RETURNING codvenda, nrovenda, inicioseparacao, fimseparacao`,
      [codvenda, func.matricula],
    );

    if (upd.rowCount === 0) {
      // descobrir o motivo para uma mensagem clara
      const chk = await client.query(
        `SELECT statuspedido, separador FROM dbvenda WHERE codvenda=$1 LIMIT 1`,
        [codvenda],
      );
      const row = chk.rows[0];
      if (!row) return res.status(404).json({ error: 'Pedido não encontrado.', code: 'PEDIDO_NAO_ENCONTRADO' });
      if (row.statuspedido !== '2') return res.status(409).json({ error: 'Este pedido não está em separação.', code: 'STATUS_INVALIDO' });
      if (row.separador !== func.matricula) return res.status(403).json({ error: 'Apenas o separador que iniciou pode finalizar este pedido.', code: 'NAO_E_DONO' });
      return res.status(409).json({ error: 'Não foi possível finalizar.', code: 'CONCORRENCIA' });
    }

    return res.status(200).json({
      message: 'Separação finalizada com sucesso',
      data: {
        codvenda: upd.rows[0].codvenda,
        nrovenda: upd.rows[0].nrovenda,
        nome: func.nome,
        inicioseparacao: upd.rows[0].inicioseparacao,
        fimseparacao: upd.rows[0].fimseparacao,
      },
    });
  } catch (error) {
    console.error('Erro em estacao/finalizar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
