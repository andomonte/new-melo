import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';

/**
 * Estação de Conferência — painel ao vivo.
 *  - emConferencia: TODAS em conferência (statuspedido='4') na filial
 *  - finalizadas: conferidas HOJE (statuspedido='5', finalizadopedido = hoje)
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

    const emConf = await client.query(
      `SELECT v.codvenda, v.nrovenda, v.inicioconferencia AS inicio,
              COALESCE(f.nome, v.conferente, '—') AS nome
         FROM dbvenda v
         LEFT JOIN dbfunc_estoque f ON v.conferente = f.matricula
        WHERE v.statuspedido = '4'
          AND v.inicioconferencia::date = CURRENT_DATE
        ORDER BY v.inicioconferencia ASC`,
    );

    const fin = await client.query(
      `SELECT v.codvenda, v.nrovenda, v.inicioconferencia AS inicio, v.finalizadopedido AS fim,
              COALESCE(f.nome, v.conferente, '—') AS nome
         FROM dbvenda v
         LEFT JOIN dbfunc_estoque f ON v.conferente = f.matricula
        WHERE v.statuspedido = '5'
          AND v.finalizadopedido::date = CURRENT_DATE
        ORDER BY v.finalizadopedido DESC`,
    );

    return res.status(200).json({
      emConferencia: emConf.rows,
      finalizadas: fin.rows,
    });
  } catch (error) {
    console.error('Erro em conferencia/estacao/lista:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
