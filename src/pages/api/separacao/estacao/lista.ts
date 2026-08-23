import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';

/**
 * Estação de Separação — painel ao vivo.
 *  - emSeparacao: TODAS as separações em andamento (statuspedido='2') na filial
 *  - finalizadas: finalizadas HOJE (statuspedido='3', fimseparacao = data de hoje)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const filial = String((req.query?.filial as string) || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const emSep = await client.query(
      `SELECT v.codvenda, v.nrovenda, v.inicioseparacao,
              COALESCE(f.nome, v.separador, '—') AS nome
         FROM dbvenda v
         LEFT JOIN dbfunc_estoque f ON v.separador = f.matricula
        WHERE v.statuspedido = '2'
        ORDER BY v.inicioseparacao ASC`,
    );

    const fin = await client.query(
      `SELECT v.codvenda, v.nrovenda, v.inicioseparacao, v.fimseparacao,
              COALESCE(f.nome, v.separador, '—') AS nome
         FROM dbvenda v
         LEFT JOIN dbfunc_estoque f ON v.separador = f.matricula
        WHERE v.statuspedido = '3'
          AND v.fimseparacao::date = CURRENT_DATE
        ORDER BY v.fimseparacao DESC`,
    );

    return res.status(200).json({
      emSeparacao: emSep.rows,
      finalizadas: fin.rows,
    });
  } catch (error) {
    console.error('Erro em estacao/lista:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
