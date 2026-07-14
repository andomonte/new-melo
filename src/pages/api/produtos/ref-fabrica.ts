import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod } = req.query;

  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({ error: 'codprod é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT rf.cod_id, rf.referencia, rf.codmarca, rf.codcredor,
              m.descr as marca_nome,
              c.nome as credor_nome
       FROM dbprod_ref_fabrica prf
       JOIN dbref_fabrica rf ON rf.cod_id = prf.cod_id
       LEFT JOIN dbmarcas m ON m.codmarca = rf.codmarca
       LEFT JOIN dbcredor c ON c.cod_credor = rf.codcredor
       WHERE prf.codprod = $1
       ORDER BY rf.referencia`,
      [codprod]
    );

    res.status(200).json({ referencias: result.rows });
  } catch (error: any) {
    console.error('Erro ao buscar ref. fábrica:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar referências' });
  } finally {
    client.release();
  }
}
