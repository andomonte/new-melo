import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { getPgPool } from '@/lib/pg';
import { getSmtpConfigWithFallback } from '@/lib/smtpConfig';

/**
 * POST /api/faturamento/enviar-danfe-email
 *   { codfat, destinatarios: string[], assunto?, mensagem? }
 * Anexa o PDF da DANFE (guardado em dbfat_nfe.imagem) e envia para todos os
 * destinatários informados na tela de compor email. Usa a config SMTP do banco.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const { codfat, destinatarios, assunto, mensagem } = req.body || {};

  const codFat = String(codfat || '').trim();
  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((e: string) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    : [];
  if (!codFat) return res.status(400).json({ erro: 'Informe codfat.' });
  if (lista.length === 0) return res.status(400).json({ erro: 'Informe ao menos um destinatário válido.' });
  const unicos = Array.from(new Set(lista));

  const client = await getPgPool().connect();
  try {
    // PDF da DANFE + XMLs (guardados na emissão)
    const nfe = await client.query(
      `SELECT nrodoc_fiscal, chave, imagem, modelo, xmlremessa, xmlretorno FROM db_manaus.dbfat_nfe
        WHERE codfat=$1 AND status='100' ORDER BY (status='100') DESC LIMIT 1`,
      [codFat],
    );
    if (nfe.rows.length === 0 || !nfe.rows[0].imagem) {
      return res.status(404).json({ erro: 'DANFE (PDF) não encontrada para esta fatura.' });
    }
    const nota = nfe.rows[0];
    const pdf = Buffer.isBuffer(nota.imagem) ? nota.imagem : Buffer.from(nota.imagem, 'base64');
    const tipoDoc = nota.modelo === '65' ? 'NFC-e' : 'NF-e';

    // Monta o XML autorizado (nfeProc = NFe assinada + protNFe do retorno da SEFAZ).
    const xmlNfe = String(nota.xmlremessa || '')
      .replace(/<\?xml[^>]*\?>/i, '')
      .trim();
    const protNFe = String(nota.xmlretorno || '').match(/<protNFe[\s\S]*?<\/protNFe>/i)?.[0] || '';
    const xmlProc =
      xmlNfe && protNFe
        ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${xmlNfe}${protNFe}</nfeProc>`
        : xmlNfe || null; // fallback: NFe assinada (sem proc) se não achar o protocolo

    // SMTP
    const smtp = await getSmtpConfigWithFallback();
    if (!smtp.user || !smtp.pass) {
      return res.status(422).json({ erro: 'SMTP não configurado (usuário/senha ausentes).' });
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      tls: { rejectUnauthorized: false },
    });

    const assuntoFinal = String(assunto || '').trim() || `${tipoDoc} nº ${nota.nrodoc_fiscal} — ${smtp.fromName}`;
    const corpo = String(mensagem || '').trim();
    const html = (corpo || `Segue em anexo a ${tipoDoc} nº ${nota.nrodoc_fiscal}.`)
      .replace(/\n/g, '<br>');

    const anexos: any[] = [
      { filename: `DANFE-${nota.nrodoc_fiscal}.pdf`, content: pdf, contentType: 'application/pdf' },
    ];
    if (xmlProc) {
      anexos.push({
        filename: `${nota.chave || 'NFe-' + nota.nrodoc_fiscal}.xml`,
        content: Buffer.from(xmlProc, 'utf8'),
        contentType: 'application/xml',
      });
    }

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: unicos.join(', '),
      subject: assuntoFinal,
      html: `${html}<br><br><small>Chave de acesso: ${nota.chave}</small>`,
      attachments: anexos,
    });

    // marca como enviado
    await client
      .query(`UPDATE db_manaus.dbfat_nfe SET emailenviado='S' WHERE codfat=$1`, [codFat])
      .catch(() => {});

    return res.status(200).json({
      sucesso: true,
      destinatarios: unicos,
      mensagem: `DANFE nº ${nota.nrodoc_fiscal} enviada para ${unicos.length} destinatário(s).`,
    });
  } catch (error: any) {
    console.error('Erro ao enviar DANFE por email:', error);
    return res.status(500).json({ erro: 'Erro ao enviar email', detalhes: error.message });
  } finally {
    client.release();
  }
}
