import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';

/**
 * Estação de Separação — criação do código de acesso no PRIMEIRO ACESSO.
 *
 * Só permite quando o código atual ainda é igual à matrícula (não personalizado).
 * O novo código não pode ser igual à matrícula e deve ser único.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const matricula = String(req.body?.matricula ?? '').trim();
  const novoCodigo = String(req.body?.novoCodigo ?? '').trim();
  if (!matricula) return res.status(400).json({ error: 'Matrícula não informada.', code: 'MATRICULA_OBRIGATORIA' });
  if (novoCodigo.length < 4) return res.status(400).json({ error: 'O código deve ter ao menos 4 dígitos.', code: 'CODIGO_CURTO' });
  if (novoCodigo === matricula) return res.status(400).json({ error: 'O código não pode ser igual à matrícula.', code: 'CODIGO_IGUAL_MATRICULA' });

  const filial = String(req.body?.filial || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // OBS: o código NÃO precisa ser único — identificamos por matrícula e o
    // código funciona como senha (pode repetir entre pessoas diferentes).

    // só troca se ainda for primeiro acesso (codigoacesso == matricula)
    const upd = await client.query(
      `UPDATE dbfunc_estoque
          SET codigoacesso = $2
        WHERE matricula = $1 AND codigoacesso = matricula
        RETURNING matricula, nome`,
      [matricula, novoCodigo],
    );

    if (upd.rowCount === 0) {
      const chk = await client.query(`SELECT 1 FROM dbfunc_estoque WHERE matricula=$1 LIMIT 1`, [matricula]);
      if (chk.rows.length === 0) return res.status(404).json({ error: 'Matrícula não encontrada.', code: 'MATRICULA_INVALIDA' });
      return res.status(409).json({ error: 'O código já foi personalizado.', code: 'CODIGO_JA_CRIADO' });
    }

    return res.status(200).json({ message: 'Código de acesso criado com sucesso.', nome: upd.rows[0].nome });
  } catch (error) {
    console.error('Erro em estacao/criar-codigo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
