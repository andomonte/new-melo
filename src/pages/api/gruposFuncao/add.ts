import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Cadastro rápido de Grupo de Função (tabela dbgpfunc). O código (codgpf) é
 * gerado automaticamente (MAX+1, 5 dígitos com zeros à esquerda, padrão Delphi).
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const descr = String(req.body?.descr ?? '').trim().toUpperCase();
  if (!descr) {
    res.status(400).json({ error: 'Descrição é obrigatória' });
    return;
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN');

    // Próximo codgpf: MAX numérico + 1, com zero-padding de 5 dígitos
    const maxRes = await client.query(
      `SELECT codgpf FROM dbgpfunc
        WHERE codgpf ~ '^[0-9]+$'
        ORDER BY CAST(codgpf AS INTEGER) DESC LIMIT 1`,
    );
    const proximo = maxRes.rows.length
      ? parseInt(maxRes.rows[0].codgpf, 10) + 1
      : 1;
    const codgpf = String(proximo).padStart(5, '0');

    // Próximo gpf_id
    const idRes = await client.query(
      'SELECT COALESCE(MAX(gpf_id), 0) + 1 AS next_id FROM dbgpfunc',
    );
    const gpfId = idRes.rows[0].next_id;

    const result = await client.query(
      `INSERT INTO dbgpfunc (codgpf, descr, agregado_substituicao, gpf_id, "AGREGADO_SUBSTUICAO")
       VALUES ($1, $2, 0, $3, 0)
       RETURNING codgpf, descr`,
      [codgpf, descr, gpfId],
    );

    await client.query('COMMIT');
    res.status(201).json({ data: serializeBigInt(result.rows[0]) });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao criar grupo de função:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao criar grupo de função' });
  } finally {
    if (client) client.release();
  }
}
