import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { inserirCobranca } from '@/lib/faturamento/inserirCobranca';

// Endpoint standalone para gravar/atualizar a cobrança de uma fatura JÁ existente
// (edição de cobrança na Consulta de Faturas). O fluxo de emissão normal NÃO usa
// mais este endpoint — lá a cobrança vai junto com a fatura em salvar.ts (transação
// única). Aqui abrimos a própria transação para manter atomicidade (dbreceb+dbprazo).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat, codcli, banco, tipofat, parcelas, codvenda, alterar } = req.body;

  if (!codfat || !codcli) {
    return res.status(400).json({ error: 'codfat e codcli são obrigatórios.' });
  }

  let client;
  try {
    client = await getPgPool().connect();

    // ALTERAR COBRANÇA (fiel ao Delphi: limpa os títulos atuais e gera os novos).
    // Salvaguarda (além do Delphi): NÃO altera se houver parcela PAGA, e NÃO altera
    // fatura agrupada (membro de GP) — como o spVerifica_Gp do Delphi.
    if (alterar) {
      const pagas = await client.query(
        `SELECT COUNT(*)::int AS n FROM db_manaus.dbreceb
          WHERE cod_fat = $1 AND (cancel IS NULL OR cancel <> 'S')
            AND (nro_doc IS NULL OR substr(nro_doc, 1, 2) <> 'GP')
            AND (rec = 'S' OR dt_pgto IS NOT NULL)`,
        [codfat],
      );
      if ((pagas.rows[0]?.n ?? 0) > 0) {
        return res.status(409).json({
          error: 'Cobrança com parcela(s) paga(s) não pode ser alterada.',
        });
      }
      const gp = await client.query(
        `SELECT codgp, agp FROM db_manaus.dbfatura WHERE codfat = $1`,
        [codfat],
      );
      if (gp.rows[0]?.codgp || gp.rows[0]?.agp === 'S') {
        return res.status(409).json({
          error:
            'Fatura agrupada — desagrupe o grupo de pagamento antes de alterar a cobrança.',
        });
      }
    }

    await client.query('BEGIN');

    // Ao ALTERAR, cancela os títulos atuais (não pagos, exceto GP) antes de gerar.
    if (alterar) {
      await client.query(
        `UPDATE db_manaus.dbreceb SET cancel = 'S'
          WHERE cod_fat = $1 AND (nro_doc IS NULL OR substr(nro_doc, 1, 2) <> 'GP')`,
        [codfat],
      );
    }

    await inserirCobranca(client, {
      codfat,
      codcli,
      banco,
      tipofat,
      codvenda,
      parcelas: Array.isArray(parcelas) ? parcelas : [],
    });

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Cobrança salva com sucesso.' });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Erro ao salvar cobrança:', error);
    return res.status(500).json({
      error: `Erro ao salvar cobrança: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    if (client) client.release();
  }
}
