import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Localiza um produto pela Referência para a tela "Substituir Produto"
 * (equivale ao Consulta_Produto('R') do Delphi). Prioriza correspondência
 * exata; se não houver, tenta o primeiro que começa com o termo.
 *
 * GET /api/produtos/substituir-buscar-ref?ref=F000WA8028
 */
const SEL = `
  SELECT p.codprod, p.ref, p.descr, p.aplic_extendida, p.codmarca, p.qtest,
         p.local,
         COALESCE((SELECT m.descr FROM db_manaus.dbmarcas m
                    WHERE m.codmarca = p.codmarca LIMIT 1), '') AS marca_nome
    FROM db_manaus.dbprod p`;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
  if (!ref) return res.status(400).json({ error: 'Referência inválida' });

  const client = await getPgPool().connect();
  try {
    // 1) exata
    let r = await client.query(
      `${SEL} WHERE UPPER(p.ref) = UPPER($1) LIMIT 1`,
      [ref],
    );
    // 2) começa com
    if (r.rows.length === 0) {
      r = await client.query(
        `${SEL} WHERE p.ref ILIKE $1 ORDER BY p.ref LIMIT 1`,
        [`${ref}%`],
      );
    }
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'NÃO ENCONTRADO' });
    }
    res.status(200).json({ produto: r.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
