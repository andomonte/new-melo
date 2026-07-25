import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Busca por termo (nome, código ou CNPJ) — dbtransp. Sem termo retorna as 500 primeiras.
    const search = String(req.query.search || '').trim();
    const params: any[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search.replace(/\D/g, '')}%`);
      where = `WHERE nome ILIKE $1 OR nomefant ILIKE $1 OR codtransp ILIKE $1
               OR ($2 <> '%%' AND regexp_replace(COALESCE(cpfcgc,''),'[^0-9]','','g') ILIKE $2)`;
    }

    const result = await client.query(`
      SELECT
        codtransp,
        nome,
        nomefant,
        cpfcgc
      FROM dbtransp
      ${where}
      ORDER BY nome
      LIMIT 500
    `, params);

    return res.status(200).json(serializeBigInt({
      success: true,
      data: result.rows.map(t => ({
        codtransp: t.codtransp,
        nome: t.nome || t.nomefant || 'Sem nome',
        cpfcgc: t.cpfcgc
      }))
    }));

  } catch (error) {
    console.error('Erro ao buscar transportadoras:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar transportadoras',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
