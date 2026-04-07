// API para testar configuração SMTP
import { NextApiRequest, NextApiResponse } from 'next';
import { testarConfiguracaoSMTP, enviarNFeComBoleto } from '@/lib/nfeEmailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('🧪 Iniciando teste de configuração SMTP...');
    
    // Testar configuração SMTP
    const configValida = await testarConfiguracaoSMTP();
    
    if (!configValida) {
      return res.status(500).json({ 
        error: 'Configuração SMTP inválida',
        details: 'Verifique as variáveis de ambiente SMTP_*'
      });
    }

    // Testar envio de email simples
    const { emailTeste } = req.body;
    const emailDestino = emailTeste || 'lucasgabriel201100@gmail.com';

    console.log('📧 Enviando email de teste para:', emailDestino);

    await enviarNFeComBoleto({
      destinatario: emailDestino,
      nomeCliente: 'TESTE CONFIGURAÇÃO SMTP',
      numeroNota: 'TESTE-001',
      valorTotal: 100.00,
      dataVencimento: '2025-01-30',
      pdfNFe: Buffer.from('PDF NFe teste'),
      pdfBoleto: Buffer.from('PDF Boleto teste'),
    });

    console.log('✅ Email de teste enviado com sucesso!');

    return res.status(200).json({
      sucesso: true,
      message: 'Configuração SMTP válida e email enviado com sucesso',
      emailDestino,
    });

  } catch (error: any) {
    console.error('❌ Erro no teste SMTP:', error);
    
    return res.status(500).json({
      error: 'Erro no teste SMTP',
      details: error.message,
      code: error.code,
    });
  }
}