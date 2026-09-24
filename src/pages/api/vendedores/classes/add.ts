import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

/**
 * Cadastra uma nova Classe de Vendedor (dbclassevendedor) — porte do Delphi
 * TEMP.INC_CLASSE: o código (codcv) é gerado pelo banco (MAX+1, 3 dígitos) e só a
 * descrição vem do usuário. Usado pelo botão "+" ao lado do combo de Classe.
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

  const descrRaw = (req.body?.descr ?? '').toString().trim().toUpperCase();
  if (!descrRaw) {
    return res.status(400).json({ error: 'Descrição da classe é obrigatória' });
  }
  const descr = descrRaw.slice(0, 20); // dbclassevendedor.descr (mesmo limite do Delphi)

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Gera o próximo codcv (varchar) como MAX numérico + 1, com 3 dígitos.
    const prox = await client.query(
      `SELECT LPAD(
                (COALESCE(MAX(NULLIF(regexp_replace(codcv, '\\D', '', 'g'), ''))::int, 0) + 1)::text,
                3, '0'
              ) AS codcv
         FROM dbclassevendedor`,
    );
    const codcv = prox.rows[0].codcv as string;

    await client.query(
      `INSERT INTO dbclassevendedor (codcv, descr) VALUES ($1, $2)`,
      [codcv, descr],
    );

    return res.status(201).json({ codcv, descr });
  } catch (error: any) {
    console.error('Erro ao cadastrar classe de vendedor:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao cadastrar classe de vendedor' });
  } finally {
    if (client) client.release();
  }
}
