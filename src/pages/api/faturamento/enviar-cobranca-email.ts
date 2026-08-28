import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { getPgPool } from '@/lib/pg';
import { getSmtpConfigWithFallback } from '@/lib/smtpConfig';

/**
 * POST /api/faturamento/enviar-cobranca-email
 *   { codfat, destinatarios: string[], assunto?, mensagem?, boletoBase64 }
 * Envia o BOLETO (gerado antes via /api/faturamento/gerar-boleto) por email.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  // resumoGpBase64 (opcional): "Resumo GP" anexado quando a cobrança é de um grupo (GP).
  const { codfat, destinatarios, assunto, mensagem, boletoBase64, resumoGpBase64, codgp } = req.body || {};

  const codFat = String(codfat || '').trim();
  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((e: string) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    : [];
  if (!codFat) return res.status(400).json({ erro: 'Informe codfat.' });
  if (lista.length === 0) return res.status(400).json({ erro: 'Informe ao menos um destinatário válido.' });
  if (!boletoBase64) return res.status(400).json({ erro: 'Boleto (PDF) ausente.' });
  const unicos = Array.from(new Set(lista));

  try {
    const pdf = Buffer.from(String(boletoBase64), 'base64');

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

    const assuntoFinal = String(assunto || '').trim() || `Cobrança — Fatura ${codFat} — ${smtp.fromName}`;
    const corpo = String(mensagem || '').trim() || 'Segue em anexo o boleto para pagamento.';
    const html = corpo.replace(/\n/g, '<br>');

    const attachments: any[] = [
      { filename: `Boleto-${codFat}.pdf`, content: pdf, contentType: 'application/pdf' },
    ];
    // Cobrança de grupo (GP): anexa também o Resumo GP.
    if (resumoGpBase64) {
      attachments.push({
        filename: `Resumo-GP-${String(codgp || codFat)}.pdf`,
        content: Buffer.from(String(resumoGpBase64), 'base64'),
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: unicos.join(', '),
      subject: assuntoFinal,
      html,
      attachments,
    });

    return res.status(200).json({
      sucesso: true,
      destinatarios: unicos,
      mensagem: `Boleto enviado para ${unicos.length} destinatário(s).`,
    });
  } catch (error: any) {
    console.error('Erro ao enviar boleto por email:', error);
    return res.status(500).json({ erro: 'Erro ao enviar boleto', detalhes: error.message });
  }
}
