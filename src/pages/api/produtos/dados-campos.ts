import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Retorna os valores atuais dos campos usados pela tela "Alterar Campos Lista"
 * (grade tipo Excel), para os produtos selecionados. Espelha o carregamento do
 * frmAlteraCampoProduto do Delphi, que lê os campos direto do produto navegado.
 *
 * POST /api/produtos/dados-campos
 * Body: { codprods: string[] }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const codprods: unknown = req.body?.codprods;
  if (!Array.isArray(codprods) || codprods.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto selecionado' });
  }

  const ids = codprods.map((c) => String(c));

  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `SELECT codprod, ref, descr,
              prcompra, prfabr, prcustoatual, qtestmin, qtembal,
              margem, margempromo,
              clasfiscal, pis, cofins, percsubst, cest,
              strib, isentoipi, naotemst, hanan
         FROM dbprod
        WHERE codprod = ANY($1::text[])
        ORDER BY descr`,
      [ids],
    );
    res.status(200).json({ data: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
