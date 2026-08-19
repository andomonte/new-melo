// API para testar configuração SMTP
import { NextApiRequest, NextApiResponse } from 'next';
import { testarConfiguracaoSMTP, enviarNFeComBoleto } from '@/lib/nfeEmailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('🧪 Iniciando teste de configuração SMTP...');

    // 1) Testa a CONEXÃO (verify). Mostra o erro REAL — não a mensagem genérica de env vars.
    const resultado = await testarConfiguracaoSMTP();
    if (!resultado.ok) {
      return res.status(422).json({
        error: 'Falha na conexão SMTP',
        details: resultado.error, // ex.: "Invalid login: 535-5.7.8 Username and Password not accepted"
        config: resultado.config, // host/porta/usuário testados (ajuda a conferir)
      });
    }

    // 2) Conexão OK. Só envia email de teste se um destino for informado.
    const emailDestino = req.body?.emailTeste;
    if (!emailDestino) {
      return res.status(200).json({
        sucesso: true,
        conexao: true,
        message: `Conexão SMTP OK (${resultado.config?.host}:${resultado.config?.port} · ${resultado.config?.user}).`,
        config: resultado.config,
      });
    }

    // Envio de teste (isolado: se falhar, NÃO derruba a validação da conexão).
    try {
      console.log('📧 Enviando email de teste para:', emailDestino);
      await enviarNFeComBoleto({
        destinatario: emailDestino,
        nomeCliente: 'TESTE CONFIGURAÇÃO SMTP',
        numeroNota: 'TESTE-001',
        valorTotal: 100.0,
        dataVencimento: '2025-01-30',
        pdfNFe: Buffer.from('PDF NFe teste'),
        pdfBoleto: Buffer.from('PDF Boleto teste'),
      });
      return res.status(200).json({
        sucesso: true,
        conexao: true,
        emailEnviado: true,
        emailDestino,
        message: 'Conexão SMTP OK e email de teste enviado com sucesso.',
      });
    } catch (envioErr: any) {
      console.error('❌ Erro ao enviar email de teste (conexão está OK):', envioErr);
      return res.status(200).json({
        sucesso: true,
        conexao: true,
        emailEnviado: false,
        message: `Conexão SMTP OK, mas falhou ao enviar o email de teste: ${envioErr.message}`,
        config: resultado.config,
      });
    }
  } catch (error: any) {
    console.error('❌ Erro no teste SMTP:', error);
    return res.status(500).json({
      error: 'Erro no teste SMTP',
      details: error.message,
      code: error.code,
    });
  }
}
