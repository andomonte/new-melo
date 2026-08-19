import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/caixa/reverter-fatura   { codfat }
 *
 * Compensação do "faturar no caixa": desfaz TUDO que /api/faturamento/salvar gravou,
 * na ordem inversa e numa única transação. Usado quando a emissão da NF-e falha
 * (decisão do usuário: falhou → desfaz tudo).
 *
 * Desfaz: estoque (cad_armazem_produto + dbprod) → dbprazo_pagamento → dbreceb →
 * dbprodfat → dbfat_nfe (linhas rejeitadas) → fatura_venda → dbvenda status volta 'N'
 * → dbfatura.
 *
 * TRAVA: recusa se a fatura já tem NF-e AUTORIZADA (status '100') — nota fiscal
 * autorizada só sai por cancelamento na SEFAZ, nunca por delete.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const codfat = String(req.body?.codfat || '').trim();
  if (!codfat) return res.status(400).json({ erro: 'Informe codfat.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    // trava: não reverter fatura com NF autorizada
    const nfeAut = await client.query(
      `SELECT 1 FROM db_manaus.dbfat_nfe WHERE codfat = $1 AND status = '100' LIMIT 1`,
      [codfat],
    );
    if (nfeAut.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        erro: 'Fatura possui NF-e AUTORIZADA — não pode ser desfeita por reversão (exige cancelamento na SEFAZ).',
        code: 'NFE_AUTORIZADA',
      });
    }

    const vendasR = await client.query(
      `SELECT codvenda FROM db_manaus.fatura_venda WHERE codfat = $1`,
      [codfat],
    );
    const vendas: string[] = vendasR.rows.map((r) => r.codvenda);

    // 1) restaura estoque de cada item das vendas (inverso da baixa do salvar.ts)
    for (const codvenda of vendas) {
      const itens = await client.query(
        `SELECT codprod, qtd, arm_id FROM db_manaus.dbitvenda WHERE codvenda = $1`,
        [codvenda],
      );
      for (const it of itens.rows) {
        const qtd = parseFloat(it.qtd) || 0;
        if (qtd <= 0 || !it.codprod) continue;
        if (it.arm_id) {
          await client.query(
            `UPDATE db_manaus.cad_armazem_produto
                SET arp_qtest = COALESCE(arp_qtest,0) + $1,
                    arp_qtest_reservada = COALESCE(arp_qtest_reservada,0) + $1
              WHERE arp_codprod = $2 AND arp_arm_id = $3`,
            [qtd, it.codprod, it.arm_id],
          );
        }
        await client.query(
          `UPDATE db_manaus.dbprod SET qtest = COALESCE(qtest,0) + $1 WHERE codprod = $2`,
          [qtd, it.codprod],
        );
      }
    }

    // 2) cobrança: parcelas + títulos
    if (vendas.length > 0) {
      await client.query(`DELETE FROM db_manaus.dbprazo_pagamento WHERE codvenda = ANY($1)`, [vendas]);
    }
    const delReceb = await client.query(`DELETE FROM db_manaus.dbreceb WHERE cod_fat = $1`, [codfat]);

    // 3) itens da fatura
    await client.query(`DELETE FROM db_manaus.dbprodfat WHERE codfat = $1`, [codfat]);

    // 4) NF-e rejeitadas/pendentes gravadas
    await client.query(`DELETE FROM db_manaus.dbfat_nfe WHERE codfat = $1`, [codfat]);

    // 5) associação + volta a venda para pré-venda
    await client.query(`DELETE FROM db_manaus.fatura_venda WHERE codfat = $1`, [codfat]);
    if (vendas.length > 0) {
      await client.query(
        `UPDATE db_manaus.dbvenda SET status = 'N' WHERE codvenda = ANY($1)`,
        [vendas],
      );
    }

    // 6) a fatura
    await client.query(`DELETE FROM db_manaus.dbfatura WHERE codfat = $1`, [codfat]);

    await client.query('COMMIT');
    return res.status(200).json({
      sucesso: true,
      codfat,
      vendas,
      titulos_removidos: delReceb.rowCount,
      mensagem: 'Fatura desfeita (estoque, cobrança, itens e status da venda revertidos).',
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao reverter fatura:', error);
    return res.status(500).json({ erro: 'Erro ao reverter fatura', detalhes: error.message });
  } finally {
    client.release();
  }
}
