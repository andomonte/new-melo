import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

/**
 * Estação de Conferência — autentica por MATRÍCULA + CÓDIGO (dbfunc_estoque,
 * mesmo cadastro da separação) e retorna a conferência em aberto do conferente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const filial = String(req.body?.filial || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const auth = await autenticarSeparador(client, req.body?.matricula, req.body?.codigo);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code });
    if (auth.primeiroAcesso) {
      return res.status(200).json({ matricula: auth.matricula, nome: auth.nome, primeiroAcesso: true, ativa: null });
    }

    const a = await client.query(
      `SELECT codvenda, nrovenda, inicioconferencia AS inicio
         FROM dbvenda
        WHERE conferente = $1 AND statuspedido = '4'
        ORDER BY inicioconferencia ASC LIMIT 1`,
      [auth.matricula],
    );

    return res.status(200).json({
      matricula: auth.matricula,
      nome: auth.nome,
      primeiroAcesso: false,
      ativa: a.rows[0] || null,
    });
  } catch (error) {
    console.error('Erro em conferencia/estacao/identificar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
