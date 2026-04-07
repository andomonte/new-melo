import nodemailer from 'nodemailer';
import { getSmtpConfigWithFallback } from './smtpConfig';

// Função auxiliar para criar transporter dinâmico
async function createTransporter() {
  const config = await getSmtpConfigWithFallback();
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Função para enviar e-mail
export async function enviarEmailComAnexos(
  destinatario: string,
  assunto: string,
  corpo: string,
  anexos: { filename: string; path: string }[]
) {
  try {
    const transporter = await createTransporter();
    const config = await getSmtpConfigWithFallback();

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`, 
      to: destinatario,
      subject: assunto,
      text: corpo,
      attachments: anexos,
    });

    console.log('E-mail enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw error;
  }
}
