import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Espelha o spVALIDAR_SUBSTITUICAO do Delphi: informa se um produto já está
 * envolvido em uma substituição.
 *   - substituido: este produto FOI substituído por outro (é codprod_orig) ->
 *     retorna os dados do substituto.
 *   - substituto:  este produto É substituto de outro (é codprod_subs) ->
 *     retorna os dados do original.
 *
 * GET /api/produtos/substituir-status?codprod=030297
 */
const SEL_PROD = `
  SELECT p.codprod, p.ref, p.descr, p.aplic_extendida, p.codmarca, p.qtest,
         p.local,
         COALESCE((SELECT m.descr FROM dbmarcas m
                    WHERE m.codmarca = p.codmarca LIMIT 1), '') AS marca_nome
    FROM dbprod p
   WHERE p.codprod = $1`;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const codprod =
    typeof req.query.codprod === 'string' ? req.query.codprod.trim() : '';
  if (!codprod) return res.status(400).json({ error: 'codprod é obrigatório' });

  const client = await getPgPool().connect();
  try {
    // dados canônicos do próprio produto (codmarca "cru", para comparações)
    const atualRes = await client.query(SEL_PROD, [codprod]);
    const atual = atualRes.rows[0] || null;

    // este produto foi substituído por outro?
    const orig = await client.query(
      `SELECT codprod_subs FROM dbprod_substituir WHERE codprod_orig = $1 LIMIT 1`,
      [codprod],
    );
    // este produto é substituto de outro?
    const subs = await client.query(
      `SELECT codprod_orig FROM dbprod_substituir WHERE codprod_subs = $1 LIMIT 1`,
      [codprod],
    );

    let substituido = null;
    let substituto = null;
    if (orig.rows.length > 0) {
      const r = await client.query(SEL_PROD, [orig.rows[0].codprod_subs]);
      substituido = r.rows[0] || null;
    }
    if (subs.rows.length > 0) {
      const r = await client.query(SEL_PROD, [subs.rows[0].codprod_orig]);
      substituto = r.rows[0] || null;
    }

    res.status(200).json({ atual, substituido, substituto });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
