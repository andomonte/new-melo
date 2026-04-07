import nodemailer from 'nodemailer';
import { getSmtpConfigWithFallback } from './smtpConfig';
import { getPgPool } from '@/lib/pg';
import fs from 'fs';
import path from 'path';

// Função para buscar dados da empresa
async function getDadosEmpresa(cnpj?: string, ie?: string) {
  try {
    const client = await getPgPool().connect();
    
    let query = `
      SELECT * FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoCrt" IS NOT NULL
        AND "certificadoKey" != ''
        AND "certificadoCrt" != ''
    `;
    
    const params: any[] = [];
    
    if (cnpj) {
      params.push(cnpj);
      query += ` AND cgc = $${params.length}`;
    }
    
    if (ie) {
      params.push(ie);
      query += ` AND inscricaoestadual = $${params.length}`;
    }
    
    query += ` ORDER BY cgc LIMIT 1`;
    
    const { rows } = await client.query(query, params);
    client.release();
    
    if (rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar dados da empresa:', error);
    return null;
  }
}

// Função para criar transporter dinâmico com configuração do banco
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

// Função para testar a configuração SMTP
export async function testarConfiguracaoSMTP() {
  try {
    console.log('🧪 Testando configuração SMTP...');
    
    const transporter = await createTransporter();
    const config = await getSmtpConfigWithFallback();
    
    console.log('📧 Configurações:', {
      host: config.host,
      port: config.port,
      user: config.user,
      pass_length: config.pass?.length || 0,
    });
    
    await transporter.verify();
    console.log('✅ Configuração SMTP válida!');
    return true;
  } catch (error) {
    console.error('❌ Erro na configuração SMTP:', error);
    return false;
  }
}

// Interface para anexos
interface EmailAttachment {
  filename: string;
  content?: Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
}

// Função para carregar logo como base64 para embed no email
function carregarLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logomelowhite.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return logoBuffer.toString('base64');
    }
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }
  return null;
}

// Template de email no estilo oficial Melo - AZUL ESCURO + BRANCO
function gerarTemplateEmail({
  nomeCliente,
  numeroNota,
  valorTotal,
  dataVencimento,
  dataEmissao,
  chaveAcesso,
  tipoDocumento,
  pdfBoleto,
  xmlDocumento,
  dadosEmpresa,
}: {
  nomeCliente: string;
  numeroNota: string;
  valorTotal: number;
  dataVencimento?: string;
  dataEmissao?: string;
  chaveAcesso?: string;
  tipoDocumento: 'nfe' | 'nfce';
  pdfBoleto?: Buffer;
  xmlDocumento?: string;
  dadosEmpresa?: any;
}): string {
  const isNFCe = tipoDocumento === 'nfce';
  const tipoDocumentoNome = isNFCe ? 'Cupom Fiscal Eletrônico' : 'Nota Fiscal Eletrônica';
  const tipoDocumentoSigla = isNFCe ? 'NFC-e' : 'NF-e';
  const consultaUrl = isNFCe 
    ? 'https://www.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp'
    : 'http://www.nfe.fazenda.gov.br/portal/';

  // Formatar valor - garantir que não seja zerado
  const valorNumerico = Number(valorTotal) || 0;
  const valorFormatado = valorNumerico.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  const dataEmissaoFormatada = dataEmissao 
    ? new Date(dataEmissao).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  // Dados da empresa com fallbacks
  const empNome = dadosEmpresa?.nomecontribuinte || dadosEmpresa?.xNome || 'MELO DISTRIBUIDORA DE PEÇAS LTDA';
  
  // Endereço construído com dados do banco (tabela dadosempresa usa 'logradouro', não 'endereco')
  const logradouro = dadosEmpresa?.logradouro || dadosEmpresa?.endereco;
  const empEndereco = logradouro
    ? `${logradouro}, ${dadosEmpresa.numero || ''} - ${dadosEmpresa.bairro || ''} - ${dadosEmpresa.municipio || 'Manaus'}/${dadosEmpresa.uf || 'AM'}`
    : 'Rua Marsilac - Antero 9 - Revisão 21 - 3º Dicanieure 2330';
    
  const empTelefone = dadosEmpresa?.telefone || '(92) 9857-9350';
  const empEmail = dadosEmpresa?.email || 'contato@melodistribuidora.com';
  // Campo 'site' não existe no banco, extrair do email ou usar padrão
  const empSite = empEmail.split('@')[1] || 'melodistribuidora.com';

  // Paleta de cores oficial Melo - AZUL ESCURO + BRANCO
  const cores = {
    azulEscuro: '#1a3a5c',     // Header e Footer
    azulMedio: '#234e7d',      // Botões e destaques
    azulClaro: '#3a6ea5',      // Hover e bordas
    branco: '#ffffff',
    cinzaClaro: '#f5f5f5',     // Background corpo
    cinzaBorda: '#e0e0e0',
    textoEscuro: '#1a3a5c',    // Texto principal
    textoMedio: '#4a5568',     // Texto secundário
    textoClaro: '#718096',     // Texto terciário
    verde: '#28a745',          // Sucesso/Valor
    amarelo: '#ffc107',        // Alertas
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tipoDocumentoSigla} - Melo Distribuidora</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #e8e8e8;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #e8e8e8;">
        <tr>
          <td align="center" style="padding: 30px 15px;">
            <!-- CONTAINER PRINCIPAL -->
            <table role="presentation" width="700" cellspacing="0" cellpadding="0" border="0" style="max-width: 700px; width: 100%; background-color: ${cores.branco}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              
              <!-- ========== HEADER AZUL ESCURO ========== -->
              <tr>
                <td style="background-color: ${cores.azulEscuro}; padding: 35px 40px; text-align: center;">
                  <!-- LOGO -->
                  <img src="cid:logo" alt="${empNome}" style="max-width: 280px; height: auto;" />
                </td>
              </tr>

              <!-- ========== CORPO BRANCO ========== -->
              <tr>
                <td style="background-color: ${cores.branco}; padding: 40px 50px;">
                  
                  <!-- TÍTULO -->
                  <h1 style="color: ${cores.textoEscuro}; margin: 0 0 10px; font-size: 26px; font-weight: bold; text-align: center;">
                    ${tipoDocumentoNome}
                  </h1>
                  <p style="color: ${cores.textoMedio}; margin: 0 0 30px; font-size: 14px; text-align: center;">
                    Documento fiscal emitido eletronicamente
                  </p>

                  <!-- LINHA DIVISÓRIA -->
                  <hr style="border: none; border-top: 2px solid ${cores.azulEscuro}; margin: 0 0 30px;" />
                  
                  <!-- SAUDAÇÃO -->
                  <p style="color: ${cores.textoEscuro}; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                    Olá, <strong>${nomeCliente}</strong>!
                  </p>
                  
                  <p style="color: ${cores.textoMedio}; margin: 0 0 30px; font-size: 15px; line-height: 1.7;">
                    Segue em anexo ${isNFCe ? 'o' : 'a'} <strong style="color: ${cores.textoEscuro};">${tipoDocumentoNome} nº ${numeroNota}</strong> 
                    referente à sua compra.
                  </p>

                  <!-- CARD DE VALOR -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="background-color: ${cores.cinzaClaro}; border: 2px solid ${cores.azulMedio}; border-radius: 10px; padding: 25px; text-align: center;">
                        <p style="color: ${cores.textoMedio}; margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                          Valor Total
                        </p>
                        <p style="color: ${cores.azulMedio}; margin: 0; font-size: 36px; font-weight: bold;">
                          ${valorFormatado}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- INFORMAÇÕES EM GRID -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                    <tr>
                      <td width="48%" style="vertical-align: top;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${cores.cinzaClaro}; border: 1px solid ${cores.cinzaBorda}; border-radius: 8px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: ${cores.textoClaro}; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">
                                Data de Emissão
                              </p>
                              <p style="color: ${cores.textoEscuro}; margin: 0; font-size: 18px; font-weight: bold;">
                                ${dataEmissaoFormatada}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="vertical-align: top;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${cores.cinzaClaro}; border: 1px solid ${cores.cinzaBorda}; border-radius: 8px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: ${cores.textoClaro}; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">
                                Número da Nota
                              </p>
                              <p style="color: ${cores.textoEscuro}; margin: 0; font-size: 18px; font-weight: bold;">
                                ${numeroNota}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${dataVencimento ? `
                  <!-- ALERTA DE VENCIMENTO -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="background-color: #fff8e1; border-left: 4px solid ${cores.amarelo}; border-radius: 0 8px 8px 0; padding: 20px;">
                        <p style="color: #856404; margin: 0 0 5px; font-size: 12px; text-transform: uppercase; font-weight: bold;">
                          Vencimento do Boleto
                        </p>
                        <p style="color: #856404; margin: 0; font-size: 20px; font-weight: bold;">
                          ${dataVencimento}
                        </p>
                        <p style="color: #856404; margin: 10px 0 0; font-size: 13px;">
                          O boleto bancário está anexado a este e-mail.
                        </p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  ${chaveAcesso ? `
                  <!-- CHAVE DE ACESSO -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="background-color: #e3f2fd; border-left: 4px solid ${cores.azulMedio}; border-radius: 0 8px 8px 0; padding: 20px;">
                        <p style="color: ${cores.azulMedio}; margin: 0 0 10px; font-size: 12px; text-transform: uppercase; font-weight: bold;">
                          Chave de Acesso
                        </p>
                        <p style="color: ${cores.textoEscuro}; margin: 0; font-size: 12px; font-family: 'Courier New', monospace; word-break: break-all; line-height: 1.6; background-color: ${cores.branco}; padding: 12px; border-radius: 5px; border: 1px solid ${cores.cinzaBorda};">
                          ${chaveAcesso}
                        </p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- DOCUMENTOS ANEXADOS -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="background-color: ${cores.cinzaClaro}; border: 1px solid ${cores.cinzaBorda}; border-radius: 8px; padding: 20px;">
                        <p style="color: ${cores.textoEscuro}; margin: 0 0 15px; font-size: 14px; font-weight: bold;">
                          Documentos Anexados:
                        </p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td style="padding: 5px 0;">
                              <span style="color: ${cores.azulMedio}; font-size: 14px;">
                                📄 ${tipoDocumentoSigla}-${numeroNota}.pdf
                              </span>
                            </td>
                          </tr>
                          ${xmlDocumento ? `
                          <tr>
                            <td style="padding: 5px 0;">
                              <span style="color: ${cores.azulMedio}; font-size: 14px;">
                                📋 ${tipoDocumentoSigla}-${numeroNota}.xml
                              </span>
                            </td>
                          </tr>
                          ` : ''}
                          ${pdfBoleto ? `
                          <tr>
                            <td style="padding: 5px 0;">
                              <span style="color: ${cores.azulMedio}; font-size: 14px;">
                                💰 Boleto-${numeroNota}.pdf
                              </span>
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- BOTÃO DE CONSULTA -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${consultaUrl}" target="_blank" style="display: inline-block; background-color: ${cores.azulMedio}; color: ${cores.branco}; text-decoration: none; padding: 14px 35px; border-radius: 5px; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                          VER MAIS
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top: 10px;">
                        <p style="color: ${cores.textoClaro}; margin: 0; font-size: 12px;">
                          Consultar autenticidade no ${isNFCe ? 'Portal SEFAZ Amazonas' : 'Portal Nacional da NF-e'}
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- ========== FOOTER AZUL ESCURO ========== -->
              <tr>
                <td style="background-color: ${cores.azulEscuro}; padding: 30px 40px; text-align: center;">
                  <p style="color: ${cores.branco}; margin: 0 0 8px; font-size: 14px; font-weight: bold;">
                    ${empNome}
                  </p>
                  <p style="color: rgba(255,255,255,0.7); margin: 0 0 5px; font-size: 12px;">
                    ${empEndereco}
                  </p>
                  <p style="color: rgba(255,255,255,0.7); margin: 0 0 5px; font-size: 12px;">
                    Tel.: ${empTelefone}
                  </p>
                  <p style="color: rgba(255,255,255,0.7); margin: 0 0 15px; font-size: 12px;">
                    e-mail: <a href="mailto:${empEmail}" style="color: rgba(255,255,255,0.9); text-decoration: underline;">${empSite}</a>
                  </p>
                  
                  <!-- REDES SOCIAIS -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                    <tr>
                      <td style="padding: 0 8px;">
                        <a href="#" style="color: ${cores.branco}; font-size: 18px; text-decoration: none;">●</a>
                      </td>
                      <td style="padding: 0 8px;">
                        <a href="#" style="color: ${cores.branco}; font-size: 18px; text-decoration: none;">●</a>
                      </td>
                      <td style="padding: 0 8px;">
                        <a href="#" style="color: ${cores.branco}; font-size: 18px; text-decoration: none;">●</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: rgba(255,255,255,0.5); margin: 20px 0 0; font-size: 11px;">
                    Este é um e-mail automático. Por favor, não responda.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Função unificada para enviar NF-e ou NFC-e por e-mail
export async function enviarDocumentoFiscal({
  destinatario,
  nomeCliente,
  numeroNota,
  valorTotal,
  dataVencimento,
  dataEmissao,
  pdfDocumento,
  pdfBoleto,
  xmlDocumento,
  chaveAcesso,
  tipoDocumento = 'nfe',
  cnpjEmpresa,
  ieEmpresa
}: {
  destinatario: string;
  nomeCliente: string;
  numeroNota: string;
  valorTotal: number;
  dataVencimento?: string;
  dataEmissao?: string;
  pdfDocumento: Buffer;
  pdfBoleto?: Buffer;
  xmlDocumento?: string;
  chaveAcesso?: string;
  tipoDocumento?: 'nfe' | 'nfce';
  cnpjEmpresa?: string;
  ieEmpresa?: string;
}) {
  const isNFCe = tipoDocumento === 'nfce';
  const tipoDocumentoSigla = isNFCe ? 'NFC-e' : 'NFe';
  
  // Log para debug do valor
  console.log('📊 Valor recebido para email:', { valorTotal, tipo: typeof valorTotal });

  // Buscar dados da empresa para o template (filtrando se fornecido)
  const dadosEmpresa = await getDadosEmpresa(cnpjEmpresa, ieEmpresa);
  console.log('🏢 Dados da empresa para email:', dadosEmpresa ? 'Encontrados' : 'Não encontrados (usando padrão)');
  
  const assunto = `${tipoDocumentoSigla} Nº ${numeroNota} - ${dadosEmpresa?.nomecontribuinte || 'Melo Distribuidora'}`;
  
  const corpoEmail = gerarTemplateEmail({
    nomeCliente,
    numeroNota,
    valorTotal: Number(valorTotal) || 0,
    dataVencimento,
    dataEmissao,
    chaveAcesso,
    tipoDocumento,
    pdfBoleto,
    xmlDocumento,
    dadosEmpresa,
  });

  const anexos: EmailAttachment[] = [
    {
      filename: `${tipoDocumentoSigla}-${numeroNota}.pdf`,
      content: pdfDocumento,
      contentType: 'application/pdf'
    }
  ];

  // Adicionar logo como anexo inline para embed no email
  const logoBase64 = carregarLogoBase64();
  if (logoBase64) {
    anexos.push({
      filename: 'logo.png',
      content: Buffer.from(logoBase64, 'base64'),
      contentType: 'image/png',
      cid: 'logo'
    });
  }

  // Adicionar XML do documento se fornecido
  if (xmlDocumento) {
    anexos.push({
      filename: `${tipoDocumentoSigla}-${numeroNota}.xml`,
      content: Buffer.from(xmlDocumento, 'utf8'),
      contentType: 'application/xml'
    });
  }

  if (pdfBoleto) {
    anexos.push({
      filename: `Boleto-${numeroNota}.pdf`,
      content: pdfBoleto,
      contentType: 'application/pdf'
    });
  }

  try {
    console.log(`📧 Enviando ${tipoDocumentoSigla} para:`, destinatario);
    
    const transporter = await createTransporter();
    const config = await getSmtpConfigWithFallback();
    
    const info = await transporter.sendMail({
      from: {
        name: config.fromName,
        address: config.fromEmail
      },
      to: destinatario,
      subject: assunto,
      html: corpoEmail,
      attachments: anexos,
    });

    console.log(`✅ Email ${tipoDocumentoSigla} enviado com sucesso:`, info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error(`❌ Erro ao enviar email ${tipoDocumentoSigla}:`, error);
    throw error;
  }
}

// Função específica para enviar NFe + Boleto + XML
export async function enviarNFeComBoleto(params: any) {
  return enviarDocumentoFiscal({ ...params, tipoDocumento: 'nfe' });
}

// Verificar se a configuração SMTP está funcionando
export async function verificarConexaoSMTP() {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    console.log('✅ Configuração SMTP verificada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro na configuração SMTP:', error);
    return false;
  }
}