import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

/**
 * Ativa/Inativa um vendedor pela CLASSE (dbvend.codcv) — fiel ao Delphi, onde a classe
 * "001 - INATIVO" marca o vendedor como inativo. Inativar = setar codcv='001';
 * Reativar = setar codcv da classe escolhida pelo operador.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const codvend = (req.body?.codvend ?? '').toString().trim();
  const codcv = (req.body?.codcv ?? '').toString().trim();
  if (!codvend || !codcv) {
    return res.status(400).json({ error: 'codvend e codcv são obrigatórios' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    const r = await client.query(
      `UPDATE dbvend SET codcv = $1 WHERE codvend = $2`,
      [codcv, codvend],
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'Vendedor não encontrado' });
    }
    return res.status(200).json({ sucesso: true, codvend, codcv });
  } catch (error: any) {
    console.error('Erro ao alterar situação do vendedor:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao alterar situação do vendedor' });
  } finally {
    if (client) client.release();
  }
}
