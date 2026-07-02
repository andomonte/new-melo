import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Busca referências de fábrica existentes (tabela dbref_fabrica), com filtro
 * por digitação — equivalente ao popup "Referência de Fábrica" do Delphi.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT rf.cod_id, rf.referencia, rf.codmarca, rf.codcredor,
              m.descr AS marca_nome
         FROM dbref_fabrica rf
         LEFT JOIN dbmarcas m ON m.codmarca = rf.codmarca
        WHERE ($1 = '' OR rf.referencia ILIKE '%' || $1 || '%')
        ORDER BY rf.referencia
        LIMIT 50`,
      [q],
    );
    res.status(200).json({ referencias: serializeBigInt(result.rows) });
  } catch (error: any) {
    console.error('Erro ao buscar referências de fábrica:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao buscar referências' });
  } finally {
    client.release();
  }
}
