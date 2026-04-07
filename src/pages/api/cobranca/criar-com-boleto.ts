// import type { NextApiRequest, NextApiResponse } from 'next';
// import { getAsaasClient } from '@/lib/asaas';
// import { Pool } from 'pg';
// import nodemailer from 'nodemailer';
// import axios from 'axios';

// // Pool global compartilhado
// declare global {
//   // eslint-disable-next-line no-var
//   var pgPool: Pool | undefined;
// }

// let pool: Pool | undefined = global.pgPool;
// if (!pool) {
//   pool = new Pool({ connectionString: process.env.DATABASE_URL });
//   global.pgPool = pool;
// }

// /**
//  * API para gerar boleto e enviar por email quando criar uma cobrança/fatura
//  * POST /api/cobranca/criar-com-boleto
//  */
// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse,
// ) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ erro: 'Método não permitido' });
//   }

//   try {
//     const { 
//       codfat, 
//       valor, 
//       vencimento,
//       enviarEmail = true, // Por padrão envia email
//       gerarBoleto = true, // Por padrão gera boleto
//     } = req.body;

//     console.log('💰 [Cobrança] Criando cobrança com boleto:', { codfat, valor, vencimento });

//     // 1. Buscar dados da fatura e cliente
//     const client = await pool!.connect();
//     let dadosFatura;
//     let dadosCliente;

//     try {
//       const result = await client.query(
//         `SELECT 
//           f.*,
//           c.codcli,
//           c.nome,
//           c.cpfcgc,
//           c.email,
//           c.telefone,
//           c.celular,
//           c.endereco,
//           c.numero,
//           c.complemento,
//           c.bairro,
//           c.cep,
//           c.cidade,
//           c.uf
//          FROM db_manaus.dbfatura f
//          INNER JOIN db_manaus.dbclien c ON c.codcli = f.codcli
//          WHERE f.codfat = $1`,
//         [codfat]
//       );

//       if (result.rows.length === 0) {
//         return res.status(404).json({ erro: 'Fatura não encontrada' });
//       }

//       dadosFatura = result.rows[0];
//       dadosCliente = {
//         nome: dadosFatura.nome,
//         cpfCnpj: dadosFatura.cpfcgc?.replace(/\D/g, ''),
//         email: dadosFatura.email,
//         telefone: dadosFatura.telefone,
//         celular: dadosFatura.celular,
//         endereco: dadosFatura.endereco,
//         numero: dadosFatura.numero,
//         complemento: dadosFatura.complemento,
//         bairro: dadosFatura.bairro,
//         cep: dadosFatura.cep,
//         cidade: dadosFatura.cidade,
//         uf: dadosFatura.uf,
//       };

//       console.log('✅ [Cobrança] Dados carregados - Cliente:', dadosCliente.nome);
//     } finally {
//       client.release();
//     }

//     let boleto = null;

//     // 2. Gerar boleto (se solicitado)
//     if (gerarBoleto) {
//       try {
//         console.log('🎫 [Cobrança] Gerando boleto no Asaas...');
        
//         const asaas = getAsaasClient();
//         const resultado = await asaas.gerarBoleto({
//           cliente: dadosCliente,
//           cobranca: {
//             valor: parseFloat(valor) || parseFloat(dadosFatura.totalfat || '0'),
//             vencimento: vencimento,
//             descricao: `Fatura #${codfat}`,
//             referencia: codfat,
//             multa: 2, // 2% multa
//             juros: 1, // 1% juros ao mês
//           },
//         });

//         boleto = resultado;
//         console.log('✅ [Cobrança] Boleto gerado:', resultado.cobrancaId);

//         // Salvar dados do boleto no banco
//         const clientUpdate = await pool!.connect();
//         try {
//           await clientUpdate.query(
//             `UPDATE db_manaus.dbfatura 
//              SET asaas_cobranca_id = $1,
//                  asaas_cliente_id = $2,
//                  linha_digitavel = $3,
//                  codigo_barras = $4,
//                  url_boleto = $5,
//                  status_boleto = $6
//              WHERE codfat = $7`,
//             [
//               resultado.cobrancaId,
//               resultado.clienteId,
//               resultado.linhaDigitavel,
//               resultado.codigoBarras,
//               resultado.urlBoleto,
//               resultado.status,
//               codfat,
//             ]
//           );
//           console.log('✅ [Cobrança] Dados salvos no banco');
//         } catch (e) {
//           console.warn('⚠️ [Cobrança] Erro ao salvar no banco (campos podem não existir)');
//         } finally {
//           clientUpdate.release();
//         }
//       } catch (erroBoleto: any) {
//         console.error('❌ [Cobrança] Erro ao gerar boleto:', erroBoleto.message);
//         // Continua mesmo se falhar (pode ser ambiente sem Asaas configurado)
//       }
//     }

//     // 3. Enviar email (se solicitado E se gerou boleto)
//     if (enviarEmail && boleto && dadosCliente.email) {
//       try {
//         console.log('📧 [Cobrança] Enviando email para:', dadosCliente.email);

//         // Baixar PDF do boleto
//         let pdfBuffer = null;
//         if (boleto.urlBoleto) {
//           try {
//             const pdfResponse = await axios.get(boleto.urlBoleto, {
//               responseType: 'arraybuffer',
//             });
//             pdfBuffer = Buffer.from(pdfResponse.data);
//             console.log('✅ [Cobrança] PDF do boleto baixado');
//           } catch (e) {
//             console.warn('⚠️ [Cobrança] Erro ao baixar PDF do boleto');
//           }
//         }

//         // Configurar transporte de email
//         const transporter = nodemailer.createTransport({
//           host: process.env.SMTP_HOST || 'smtp.gmail.com',
//           port: parseInt(process.env.SMTP_PORT || '587'),
//           secure: process.env.SMTP_SECURE === 'true',
//           auth: {
//             user: process.env.SMTP_USER,
//             pass: process.env.SMTP_PASS,
//           },
//         });

//         // HTML do email
//         const htmlEmail = `
//           <!DOCTYPE html>
//           <html>
//           <head>
//             <style>
//               body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//               .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//               .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
//               .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
//               .boleto-info { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff; }
//               .linha-digitavel { background: #fff3cd; padding: 15px; margin: 15px 0; border: 1px dashed #856404; font-family: monospace; font-size: 14px; word-break: break-all; }
//               .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
//               .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
//             </style>
//           </head>
//           <body>
//             <div class="container">
//               <div class="header">
//                 <h1>💰 Boleto de Cobrança</h1>
//               </div>
              
//               <div class="content">
//                 <p>Olá <strong>${dadosCliente.nome}</strong>,</p>
                
//                 <p>Enviamos o boleto referente à <strong>Fatura #${codfat}</strong>.</p>
                
//                 <div class="boleto-info">
//                   <h3>📋 Informações do Boleto:</h3>
//                   <p><strong>Valor:</strong> R$ ${boleto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
//                   <p><strong>Vencimento:</strong> ${new Date(boleto.vencimento).toLocaleDateString('pt-BR')}</p>
//                   <p><strong>Status:</strong> Aguardando Pagamento</p>
//                 </div>
                
//                 <h4>📱 Linha Digitável:</h4>
//                 <div class="linha-digitavel">
//                   ${boleto.linhaDigitavel || 'Não disponível'}
//                 </div>
                
//                 <p style="text-align: center;">
//                   <a href="${boleto.urlBoleto}" class="button">📄 Baixar Boleto PDF</a>
//                 </p>
                
//                 <p><strong>⚠️ Importante:</strong></p>
//                 <ul>
//                   <li>O boleto pode ser pago em qualquer banco ou lotérica</li>
//                   <li>Após o pagamento, a confirmação pode levar até 2 dias úteis</li>
//                   <li>Em caso de dúvidas, entre em contato conosco</li>
//                 </ul>
//               </div>
              
//               <div class="footer">
//                 <p>Este é um email automático, não responda.</p>
//                 <p>© ${new Date().getFullYear()} - Todos os direitos reservados</p>
//               </div>
//             </div>
//           </body>
//           </html>
//         `;

//         // Enviar email
//         const info = await transporter.sendMail({
//           from: process.env.SMTP_FROM || process.env.SMTP_USER,
//           to: dadosCliente.email,
//           subject: `💰 Boleto - Fatura #${codfat}`,
//           html: htmlEmail,
//           attachments: pdfBuffer ? [{
//             filename: `boleto-${codfat}.pdf`,
//             content: pdfBuffer,
//             contentType: 'application/pdf',
//           }] : [],
//         });

//         console.log('✅ [Cobrança] Email enviado:', info.messageId);
//       } catch (erroEmail: any) {
//         console.error('❌ [Cobrança] Erro ao enviar email:', erroEmail.message);
//         // Não bloqueia a resposta, apenas loga
//       }
//     }

//     // 4. Retornar resposta
//     return res.status(200).json({
//       sucesso: true,
//       codfat,
//       boleto: boleto ? {
//         cobrancaId: boleto.cobrancaId,
//         clienteId: boleto.clienteId,
//         linhaDigitavel: boleto.linhaDigitavel,
//         urlBoleto: boleto.urlBoleto,
//         vencimento: boleto.vencimento,
//         valor: boleto.valor,
//         status: boleto.status,
//       } : null,
//       emailEnviado: enviarEmail && boleto && dadosCliente.email ? true : false,
//     });
//   } catch (error: any) {
//     console.error('❌ [Cobrança] Erro:', error);
//     return res.status(500).json({
//       erro: 'Erro ao processar cobrança',
//       detalhes: error.message,
//     });
//   }
// }
