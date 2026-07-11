import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Verifica se já existe um produto com a mesma REFERÊNCIA e MARCA (o sistema
 * não pode ter duplicados). Retorna o produto existente (se houver) para o
 * front oferecer editar em vez de cadastrar de novo — como o "zoom" do cliente.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const ref = String(req.query.ref ?? '').trim().toUpperCase();
  const codmarca = String(req.query.codmarca ?? '').trim();
  // codprod a ignorar (na edição, para não achar o próprio produto)
  const ignorarCodprod = String(req.query.ignorarCodprod ?? '').trim();

  if (!ref || !codmarca) {
    return res.status(200).json({ existe: false });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const params: any[] = [ref, codmarca];
    let where = 'UPPER(ref) = $1 AND codmarca = $2';
    if (ignorarCodprod) {
      params.push(ignorarCodprod);
      where += ' AND codprod <> $3';
    }
    const result = await client.query(
      `SELECT codprod, ref, descr, codmarca FROM dbprod WHERE ${where} LIMIT 1`,
      params,
    );

    if (result.rowCount && result.rowCount > 0) {
      return res.status(200).json({
        existe: true,
        produto: serializeBigInt(result.rows[0]),
      });
    }
    return res.status(200).json({ existe: false });
  } catch (error: any) {
    console.error('Erro ao verificar ref+marca:', error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
