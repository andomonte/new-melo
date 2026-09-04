import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { getPgPool } from '@/lib/pg';
import { getSmtpConfigWithFallback } from '@/lib/smtpConfig';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';
import { gerarComprovanteHtml } from '@/lib/financeiro/comprovanteHtml';

/**
 * POST /api/contas-receber/comprovantes/enviar-email
 *   { aut_id, destinatarios: string[], assunto?, mensagem? }
 * Gera o PDF do comprovante (mesmo layout da impressão) e envia por email em anexo.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const { aut_id, destinatarios, assunto, mensagem } = req.body || {};
  const autId = String(aut_id || '').trim();
  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((e: string) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    : [];
  if (!autId) return res.status(400).json({ erro: 'Informe aut_id.' });
  if (lista.length === 0) return res.status(400).json({ erro: 'Informe ao menos um destinatário válido.' });
  const unicos = Array.from(new Set(lista));

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Cabeçalho + cliente
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
    if (cab.rows.length === 0) return res.status(404).json({ erro: 'Comprovante não encontrado.' });

    // Itens (com valor original de dbreceb e taxa admin das parcelas de cartão)
    const itens = await client.query(
      `SELECT it.ita_cod_receb, it.ita_nro_doc, it.ita_valor, it.ita_valo_areceber,
              it.ita_valor_juros, it.ita_valor_total, r.valor_pgto AS valor_original,
              COALESCE((SELECT SUM(fr.valor*COALESCE(fr.tx_cartao,0)/100) FROM dbfreceb fr
                         WHERE fr.id_autenticacao=$1::bigint AND fr.cod_receb=it.ita_cod_receb AND fr.tx_cartao IS NOT NULL),0) AS taxa_admin
         FROM fin_item_autenticacao it LEFT JOIN dbreceb r ON r.cod_receb = it.ita_cod_receb
        WHERE it.ita_id = $1::numeric ORDER BY it.ita_cod_receb`,
      [autId],
    );

    // Formas de pagamento (nome via tipo → dbforma_pagto; fallback por cod_receb)
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

    // Logo embutido (data URI) — evita dependência de rede no puppeteer.
    let logoDataUri = '';
    try {
      const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'logoPdf.png'));
      logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;
    } catch {
      /* sem logo, segue */
    }

    const c = cab.rows[0];
    const html = gerarComprovanteHtml(
      {
        aut_id: String(c.aut_id),
        aut_data: c.aut_data,
        aut_autenticacao: c.aut_autenticacao,
        aut_cancel: c.aut_cancel,
        aut_codconta: c.aut_codconta,
        codcli: c.codcli,
        nome_cliente: c.nome_cliente,
        itens: itens.rows,
        formas,
      },
      logoDataUri,
    );

    const pdf = await renderHtmlToPdf(html, { landscape: false });

    const smtp = await getSmtpConfigWithFallback();
    if (!smtp.user || !smtp.pass) return res.status(422).json({ erro: 'SMTP não configurado.' });
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      tls: { rejectUnauthorized: false },
    });

    const assuntoFinal = String(assunto || '').trim() || `Comprovante de Pagamento ${autId} — ${smtp.fromName}`;
    const corpo = String(mensagem || '').trim() || 'Segue em anexo o comprovante de pagamento.';

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: unicos.join(', '),
      subject: assuntoFinal,
      html: corpo.replace(/\n/g, '<br>'),
      attachments: [{ filename: `Comprovante-${autId}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });

    return res.status(200).json({ sucesso: true, destinatarios: unicos, mensagem: `Comprovante enviado para ${unicos.length} destinatário(s).` });
  } catch (error: any) {
    console.error('Erro ao enviar comprovante por email:', error);
    return res.status(500).json({ erro: 'Erro ao enviar comprovante', detalhes: error.message });
  } finally {
    client.release();
  }
}
