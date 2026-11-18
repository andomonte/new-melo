import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSmtpConfigWithFallback } from '@/lib/smtpConfig';

/**
 * POST /api/vendas/orcamento-pdf/enviar-email
 *   { pdf_id, destinatarios: string[], assunto?, mensagem?, nome_arquivo?, codvenda? }
 * Envia por email o PDF do orçamento já gerado (/api/vendas/orcamento-pdf/gerar),
 * em ANEXO — sem link do sistema no corpo. Mesmo padrão do envio de comprovante
 * (contas a receber).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mesma pasta usada por gerar.ts / [id].ts
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const PDF_TEMP_DIR = isVercel ? '/tmp' : path.join(os.tmpdir(), 'orcamentos');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const { pdf_id, destinatarios, assunto, mensagem, nome_arquivo, codvenda } = req.body || {};

  const pdfId = String(pdf_id || '').trim();
  if (!UUID_RE.test(pdfId)) return res.status(400).json({ erro: 'PDF do orçamento inválido.' });

  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((e: string) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    : [];
  if (lista.length === 0) return res.status(400).json({ erro: 'Informe ao menos um destinatário válido.' });
  const unicos = Array.from(new Set(lista));

  const arquivo = path.join(PDF_TEMP_DIR, `orcamento_${pdfId}.pdf`);
  if (!fs.existsSync(arquivo)) {
    return res.status(404).json({ erro: 'O PDF do orçamento expirou. Gere o PDF novamente.' });
  }

  try {
    const pdf = fs.readFileSync(arquivo);

    const smtp = await getSmtpConfigWithFallback();
    if (!smtp.user || !smtp.pass) return res.status(422).json({ erro: 'SMTP não configurado.' });
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      tls: { rejectUnauthorized: false },
    });

    const num = String(codvenda || '').trim();
    const nomeBase = String(nome_arquivo || '').replace(/[^a-zA-Z0-9_\-.]/g, '') || `Orcamento-${num || pdfId}`;
    const assuntoFinal = String(assunto || '').trim() || `Orçamento${num ? ` nº ${num}` : ''} — ${smtp.fromName}`;
    const corpo = String(mensagem || '').trim() || 'Segue em anexo o orçamento.';

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: unicos.join(', '),
      subject: assuntoFinal,
      html: corpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'),
      attachments: [{ filename: `${nomeBase}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });

    return res
      .status(200)
      .json({ sucesso: true, destinatarios: unicos, mensagem: `Orçamento enviado para ${unicos.length} destinatário(s).` });
  } catch (error: any) {
    console.error('Erro ao enviar orçamento por email:', error);
    return res.status(500).json({ erro: 'Erro ao enviar orçamento', detalhes: error.message });
  }
}
