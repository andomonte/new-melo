import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/verifica-avista?codfat=X
 *
 * Espelha FATURAMENTOS.VERIFICA_VENDAAVISTA + o check de claspgto do Delphi (tela Alterar
 * Fatura): a fatura é "à vista" se a venda dela tem obsfat começando com 'A VISTA', OU se
 * o cliente é classe de pagamento à vista (dbclien.claspgto='V').
 *
 * Retorna { avista: boolean }.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const codfat = String(req.query.codfat || '').trim();
  if (!codfat) return res.status(400).json({ erro: 'Informe o codfat.' });

  const client = await getPgPool().connect();
  try {
    // Venda(s) da fatura: no web o vínculo é fatura_venda (codfat → codvenda).
    const v = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM dbvenda ven
        WHERE ven.codvenda IN (SELECT codvenda FROM fatura_venda WHERE codfat = $1)
          AND UPPER(SUBSTR(COALESCE(ven.obsfat,''),1,7)) = 'A VISTA'`,
      [codfat],
    );
    const obsAvista = (v.rows[0]?.n ?? 0) > 0;

    // Classe de pagamento do cliente (dbclien.claspgto='V').
    const c = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM dbfatura f JOIN dbclien c ON c.codcli = f.codcli
        WHERE f.codfat = $1 AND UPPER(COALESCE(c.claspgto,'')) = 'V'`,
      [codfat],
    );
    const cliAvista = (c.rows[0]?.n ?? 0) > 0;

    return res.status(200).json({ codfat, avista: obsAvista || cliAvista });
  } catch (error: any) {
    return res
      .status(500)
      .json({ erro: 'Erro ao verificar venda à vista.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
