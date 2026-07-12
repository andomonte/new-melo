import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const LIMITE = 20000; // teto de segurança para "selecionar tudo"

/**
 * Retorna TODOS os códigos (codprod) que casam com a busca atual — usado pelo
 * "Selecionar Tudo (do filtro)" da listagem, para selecionar além da página
 * atual. Espelha o WHERE do /api/produtos/get (busca por codigo/descr/ref).
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const client = await getPgPool().connect();
  try {
    const params: any[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE (codprod ILIKE $1 OR descr ILIKE $1 OR ref ILIKE $1)`;
    }

    // total (para avisar quando exceder o teto)
    const countRes = await client.query(
      `SELECT COUNT(*) AS total FROM db_manaus.dbprod ${where}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const idsRes = await client.query(
      `SELECT codprod FROM db_manaus.dbprod ${where} ORDER BY descr LIMIT ${LIMITE}`,
      params,
    );

    res.status(200).json({
      ids: idsRes.rows.map((r) => r.codprod),
      total,
      limitado: total > LIMITE,
      limite: LIMITE,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
