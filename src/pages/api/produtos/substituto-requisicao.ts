import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Dado um produto bloqueado na requisição (inf D/S/N), devolve o PRODUTO
 * SUBSTITUTO para o front oferecer "deseja adicionar o substituto?".
 *
 * Como casam (validado no Delphi e no banco):
 *  - Delphi: acha o substituto por codgpe (grupo de equivalência) + codmarca.
 *  - Web: vínculo EXPLÍCITO em dbprod_substituir(codprod_orig -> codprod_subs),
 *    criado pela ação "Substituir Produto". É a fonte canônica no web.
 * Ver memória produto-status-ativo-inativo.
 *
 * O produto vem na MESMA forma do /api/compras/produtos (pronto p/ o carrinho).
 * Só retorna se o substituto for adicionável (inf não é D/S/N) — não encadeia.
 *
 * GET /api/produtos/substituto-requisicao?codprod=XXXXXX
 * -> { substituto: Produto | null }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const codprod = String(req.query.codprod ?? '').trim();
  if (!codprod) {
    return res.status(400).json({ error: 'codprod é obrigatório' });
  }

  const client = await getPgPool().connect();
  try {
    // Substituto adicionável na mesma forma do carrinho. O WHERE final garante
    // que o próprio substituto não esteja bloqueado (inf D/S/N).
    const query = `
      SELECT
        n.codprod,
        n.descr,
        COALESCE(m.descr, n.codmarca) AS marca,
        n.ref,
        n.inf,
        '' AS aplicacao,
        COALESCE(n.qtest, 0) AS estoque,
        ROUND(
          COALESCE(n.prcompra, 0) *
          CASE WHEN n.dolar = 'S' THEN COALESCE(n.txdolarcompra, 1) ELSE 1 END,
          2
        ) AS prcompra,
        COALESCE(n.prvenda, 0) AS prvenda,
        COALESCE(n.multiplo, 1) AS multiplo,
        COALESCE(n.multiplocompra, n.multiplo, 1) AS multiplocompra,
        n.codgpp AS grupoproduto,
        n.unimed
      FROM db_manaus.dbprod_substituir s
      JOIN db_manaus.dbprod n ON n.codprod = s.codprod_subs
      LEFT JOIN db_manaus.dbmarcas m ON n.codmarca = m.codmarca
      WHERE s.codprod_orig = $1
        AND UPPER(COALESCE(n.inf, '')) NOT IN ('D', 'S', 'N')
      LIMIT 1`;

    const r = await client.query(query, [codprod]);
    const substituto = r.rows[0] ? serializeBigInt(r.rows[0]) : null;
    return res.status(200).json({ substituto });
  } catch (error: any) {
    console.error('Erro ao buscar substituto:', error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
