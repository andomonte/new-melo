import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Lista de produtos para o "Localizar Produto..." da tela Substituir (espelha o
 * picker do Delphi que mostra Referência, Marca, Est. e Descrição). Busca por
 * referência, descrição ou código; retorna vários resultados para o usuário
 * escolher. Considera apenas produtos ativos (excluido = 0).
 *
 * GET /api/produtos/substituir-buscar?termo=TES
 */
const LIMITE = 100;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const termo = typeof req.query.termo === 'string' ? req.query.termo.trim() : '';
  if (!termo) return res.status(400).json({ error: 'Informe a referência.' });

  const client = await getPgPool().connect();
  try {
    const like = `%${termo}%`;
    const r = await client.query(
      `SELECT p.codprod, p.ref, p.descr, p.aplic_extendida, p.codmarca, p.qtest,
              p.local,
              COALESCE((SELECT m.descr FROM db_manaus.dbmarcas m
                         WHERE m.codmarca = p.codmarca LIMIT 1), '') AS marca_nome
         FROM db_manaus.dbprod p
        WHERE p.excluido = 0
          AND (p.ref ILIKE $1 OR p.descr ILIKE $1 OR p.codprod ILIKE $1)
        ORDER BY p.ref
        LIMIT ${LIMITE}`,
      [like],
    );
    res.status(200).json({ produtos: r.rows, limite: LIMITE });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
