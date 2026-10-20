import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getPgPool } from '@/lib/pg';
import { gerarComprovantePdf } from '@/lib/financeiro/comprovantePdf';

/**
 * GET /api/faturamento/pdf-comprovante?aut_id=X
 * Devolve o PDF do COMPROVANTE de pagamento (mesmo layout da impressão/e-mail).
 * Consumido pelo Robô de Impressão (análogo a /api/faturamento/pdf-nota da DANFE).
 * Sem cookie de filial → usa o pool central (db_manaus), onde ficam fin_autenticacao.
 *
 * Por padrão responde binário application/pdf; com ?formato=json responde { pdfBase64 }.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  const autId = String(req.query.aut_id || '').trim();
  const formato = String(req.query.formato || '').trim();
  if (!autId) return res.status(400).json({ error: 'Informe aut_id.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const cab = await client.query(
      `SELECT a.aut_id, a.aut_data, a.aut_codconta, a.aut_autenticacao, COALESCE(a.aut_cancel,0) aut_cancel,
              cli.codcli, cli.nome AS nome_cliente
         FROM fin_autenticacao a
         LEFT JOIN LATERAL (
           SELECT r.codcli, c.nome FROM fin_item_autenticacao it
             JOIN dbreceb r ON r.cod_receb = it.ita_cod_receb
             LEFT JOIN dbclien c ON c.codcli = r.codcli
            WHERE it.ita_id = a.aut_id LIMIT 1
         ) cli ON true
        WHERE a.aut_id = $1::numeric LIMIT 1`,
      [autId],
    );
    if (cab.rows.length === 0) return res.status(404).json({ error: 'Comprovante não encontrado.' });

    const itens = await client.query(
      `SELECT it.ita_cod_receb, it.ita_nro_doc, it.ita_valor, it.ita_valo_areceber,
              it.ita_valor_juros, it.ita_valor_total, r.valor_pgto AS valor_original,
              COALESCE((SELECT SUM(fr.valor*COALESCE(fr.tx_cartao,0)/100) FROM dbfreceb fr
                         WHERE fr.id_autenticacao=$1::bigint AND fr.cod_receb=it.ita_cod_receb AND fr.tx_cartao IS NOT NULL),0) AS taxa_admin
         FROM fin_item_autenticacao it LEFT JOIN dbreceb r ON r.cod_receb = it.ita_cod_receb
        WHERE it.ita_id = $1::numeric ORDER BY it.ita_cod_receb`,
      [autId],
    );

    let formas = (
      await client.query(
        `SELECT COALESCE(fp.descricao,'FORMA '||fr.tipo) AS nome, SUM(fr.valor) AS valor
           FROM dbfreceb fr LEFT JOIN dbforma_pagto fp ON fp.codfpgt = fr.tipo
          WHERE fr.id_autenticacao = $1::bigint GROUP BY COALESCE(fp.descricao,'FORMA '||fr.tipo) ORDER BY 1`,
        [autId],
      )
    ).rows;
    if (formas.length === 0) {
      const cods = itens.rows.map((r: any) => String(r.ita_cod_receb));
      if (cods.length) {
        formas = (
          await client.query(
            `SELECT COALESCE(fp.descricao,'FORMA '||fr.tipo) AS nome, SUM(fr.valor) AS valor
               FROM dbfreceb fr LEFT JOIN dbforma_pagto fp ON fp.codfpgt = fr.tipo
              WHERE fr.cod_receb = ANY($1) AND (fr.tipo IS DISTINCT FROM 'E') AND COALESCE(fr.valor,0)>0
              GROUP BY COALESCE(fp.descricao,'FORMA '||fr.tipo) ORDER BY 1`,
            [cods],
          )
        ).rows;
      }
    }

    let logoDataUri = '';
    try {
      const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'logoPdf.png'));
      logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;
    } catch {
      /* sem logo, segue */
    }

    const c = cab.rows[0];
    const pdf = gerarComprovantePdf(
      {
        aut_id: String(c.aut_id),
        aut_data: c.aut_data,
        aut_autenticacao: c.aut_autenticacao,
        aut_cancel: c.aut_cancel,
        codcli: c.codcli,
        nome_cliente: c.nome_cliente,
        itens: itens.rows,
        formas,
      },
      logoDataUri || undefined,
    );

    if (formato === 'json') {
      return res.status(200).json({ pdfBase64: Buffer.from(pdf).toString('base64') });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comprovante-${autId}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar PDF do comprovante:', error);
    return res.status(500).json({ error: 'Erro ao gerar PDF do comprovante', detalhes: error.message });
  } finally {
    client.release();
  }
}
