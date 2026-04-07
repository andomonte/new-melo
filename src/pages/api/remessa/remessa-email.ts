import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { getPgPool } from '@/lib/pg';
import { formatTexto, formatDateDDMMYYYY, notChar } from '@/utils/formatTexto';
import { getSmtpConfigWithFallback } from '@/lib/smtpConfig';

const pool = getPgPool();

// Função de validação dos dados da remessa
function validarDadosRemessa(rows: any[]): string[] {
  const erros: string[] = [];

  if (rows.length === 0) {
    erros.push('Nenhum registro encontrado para o período');
    return erros;
  }

  rows.forEach((row, index) => {
    const linha = index + 1;

    // Validar campos obrigatórios
    if (!row.cpfcgc || row.cpfcgc.trim() === '') {
      erros.push(`Linha ${linha}: CPF/CGC está vazio`);
    }

    if (!row.nome || row.nome.trim() === '') {
      erros.push(`Linha ${linha}: Nome está vazio`);
    }

    if (!row.endereco || row.endereco.trim() === '') {
      erros.push(`Linha ${linha}: Endereço está vazio`);
    }

    if (!row.cidade || row.cidade.trim() === '') {
      erros.push(`Linha ${linha}: Cidade está vazia`);
    }

    if (!row.uf || row.uf.trim() === '') {
      erros.push(`Linha ${linha}: UF está vazia`);
    }

    if (!row.cep || row.cep.trim() === '') {
      erros.push(`Linha ${linha}: CEP está vazio`);
    }

    // Validar formato do CPF/CGC (deve ter pelo menos 11 dígitos para CPF ou 14 para CNPJ)
    if (row.cpfcgc && row.cpfcgc.replace(/\D/g, '').length < 11) {
      erros.push(`Linha ${linha}: CPF/CGC inválido (menos de 11 dígitos)`);
    }

    // Validar UF (deve ter exatamente 2 caracteres)
    if (row.uf && row.uf.length !== 2) {
      erros.push(`Linha ${linha}: UF deve ter exatamente 2 caracteres`);
    }

    // Validar CEP (deve ter exatamente 8 dígitos após formatação)
    if (row.cep && notChar(row.cep).length !== 8) {
      erros.push(`Linha ${linha}: CEP deve ter exatamente 8 dígitos`);
    }

    // Validar valor do pagamento (deve ser maior que zero)
    if (!row.valor_pgto || parseFloat(row.valor_pgto) <= 0) {
      erros.push(`Linha ${linha}: Valor do pagamento deve ser maior que zero`);
    }

    // Validar datas
    if (!row.dt_emissao) {
      erros.push(`Linha ${linha}: Data de emissão está vazia`);
    }

    if (!row.dt_venc) {
      erros.push(`Linha ${linha}: Data de vencimento está vazia`);
    }

    if (!row.dt_pgto) {
      erros.push(`Linha ${linha}: Data de pagamento está vazia`);
    }
  });

  return erros;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let dataIni: Date = new Date();
  let dataFim: Date = new Date();
  let emailDestino: string = '';

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    const { dtini, dtfim, emailDestino: email } = req.body;

    if (!dtini || !dtfim) {
      return res.status(400).json({
        erro: 'Datas inicial e final são obrigatórias'
      });
    }

    if (!email) {
      return res.status(400).json({
        erro: 'Email de destino é obrigatório'
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        erro: 'Email de destino inválido'
      });
    }

    dataIni = new Date(dtini);
    dataFim = new Date(dtfim);
    emailDestino = email;

    if (dataIni > dataFim) {
      return res.status(400).json({
        erro: 'Data inicial não pode ser maior que data final'
      });
    }

    console.log('📧 Gerando remessa Equifax para envio por email:', {
      dtini: dataIni.toISOString(),
      dtfim: dataFim.toISOString(),
      emailDestino
    });

    // Query para obter dados de remessa
    const query = `
      SELECT
        '1' as tipo,
        COALESCE(c.cpfcgc, '') as cpfcgc,
        COALESCE(c.nome, '') as nome,
        COALESCE(c.nomefant, '') as nomefant,
        'R' as naturezaend,
        COALESCE(c.ender, '') as endereco,
        COALESCE(c.cidade, '') as cidade,
        COALESCE(c.uf, '') as uf,
        COALESCE(c.cep, '') as cep,
        TO_CHAR(c.datacad, 'DDMMYY') as datacad,
        COALESCE(r.nro_doc, '') as nro_doc,
        '1' as tipotrans,
        'REA' as moeda,
        LPAD(FLOOR(r.valor_pgto)::text, 11, '0') as intpagto,
        LPAD(((r.valor_pgto - FLOOR(r.valor_pgto)) * 100)::int::text, 2, '0') as centpagto,
        LPAD(FLOOR(r.valor_pgto)::text, 11, '0') as intreceb,
        LPAD(((r.valor_pgto - FLOOR(r.valor_pgto)) * 100)::int::text, 2, '0') as centreceb,
        r.dt_emissao as dt_emissao,
        r.dt_venc as dt_venc,
        r.dt_pgto as dt_pgto,
        r.valor_pgto as valor_pgto
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      WHERE r.dt_pgto BETWEEN $1 AND $2
        AND r.cancel = 'N'
        AND r.rec = 'S'
        AND r.valor_pgto > 0
        AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
      ORDER BY r.dt_pgto, r.nro_doc
    `;

    const result = await pool.query(query, [dataIni, dataFim]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Nenhum dado encontrado para o período informado'
      });
    }

    console.log(`📊 ${result.rows.length} registros encontrados`);

    // Validar dados antes de gerar arquivo
    const errosValidacao = validarDadosRemessa(result.rows);
    if (errosValidacao.length > 0) {
      return res.status(400).json({
        erro: 'Dados inválidos encontrados na remessa',
        detalhes: errosValidacao
      });
    }

    // Gerar arquivo TXT
    const linhas: string[] = [];

    for (const row of result.rows) {
      const linha =
        row.tipo +
        (row.cpfcgc || '') +
        formatTexto(row.nome.substring(0, 55), 55, 'A') +
        formatTexto(row.nomefant.substring(0, 55), 55, 'A') +
        row.naturezaend +
        formatTexto(row.endereco.substring(0, 70), 70, 'A') +
        formatTexto(row.cidade.substring(0, 30), 30, 'A') +
        formatTexto(row.uf, 2, 'A') +
        formatTexto(notChar(row.cep), 8, 'N') +
        formatTexto('', 4, 'A') +
        formatTexto('', 10, 'A') +
        formatTexto('', 4, 'A') +
        formatTexto('', 10, 'A') +
        formatTexto('', 50, 'A') +
        formatTexto(row.datacad, 6, 'A') +
        formatTexto(row.nro_doc, 12, 'A') +
        formatTexto(row.tipotrans, 1, 'A') +
        formatTexto(row.moeda, 4, 'A') +
        formatTexto(row.intpagto, 11, 'A') +
        formatTexto(row.centpagto, 2, 'A') +
        formatTexto(row.intreceb, 11, 'A') +
        formatTexto(row.centreceb, 2, 'A') +
        formatTexto(formatDateDDMMYYYY(new Date(row.dt_emissao)), 8, 'A') +
        formatTexto(formatDateDDMMYYYY(new Date(row.dt_venc)), 8, 'A') +
        formatTexto(row.dt_pgto ? formatDateDDMMYYYY(new Date(row.dt_pgto)) : '', 8, 'D');

      linhas.push(linha);
    }

    // Juntar todas as linhas
    const conteudoArquivo = linhas.join('\r\n');

    // Configurar transporte de email usando configuração do banco
    const smtpConfig = await getSmtpConfigWithFallback();
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Nome do arquivo
    const nomeArquivo = `RemessaEquifax${formatDateDDMMYYYY(new Date())}.txt`;

    // Registrar no histórico antes do envio
    try {
      const valorTotal = result.rows.reduce((total, row) => total + parseFloat(row.valor_pgto), 0);
      await pool.query(`
        INSERT INTO db_manaus.historico_remessa_equifax
        (periodo_inicio, periodo_fim, tipo_envio, email_destino, registros_enviados, valor_total, nome_arquivo, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [dataIni, dataFim, 'email', emailDestino, result.rows.length, valorTotal, nomeArquivo, 'pendente']);
    } catch (error) {
      console.warn('⚠️ Erro ao registrar histórico:', error);
      // Não falha a operação por causa do histórico
    }

    // Enviar email
    const mailOptions = {
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to: emailDestino,
      subject: `Remessa Equifax - ${formatDateDDMMYYYY(new Date())}`,
      text: `Prezado responsável,

Segue em anexo a remessa Equifax gerada para o período de ${formatDateDDMMYYYY(dataIni)} a ${formatDateDDMMYYYY(dataFim)}.

Dados da remessa:
- Período: ${formatDateDDMMYYYY(dataIni)} a ${formatDateDDMMYYYY(dataFim)}
- Registros: ${result.rows.length}
- Valor total: R$ ${result.rows.reduce((total, row) => total + parseFloat(row.valor_pgto), 0).toFixed(2)}

Atenciosamente,
Sistema Melo`,
      attachments: [
        {
          filename: nomeArquivo,
          content: conteudoArquivo,
          contentType: 'text/plain'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    // Atualizar status do histórico para sucesso
    try {
      await pool.query(`
        UPDATE db_manaus.historico_remessa_equifax
        SET status = 'sucesso'
        WHERE periodo_inicio = $1 AND periodo_fim = $2 AND tipo_envio = 'email'
        AND email_destino = $3 AND status = 'pendente'
        ORDER BY data_envio DESC LIMIT 1
      `, [dataIni, dataFim, emailDestino]);
    } catch (error) {
      console.warn('⚠️ Erro ao atualizar status do histórico:', error);
    }

    console.log('✅ Remessa Equifax enviada por email com sucesso');

    res.status(200).json({
      sucesso: true,
      mensagem: 'Remessa Equifax enviada por email com sucesso',
      dados: {
        registros: result.rows.length,
        periodo: `${formatDateDDMMYYYY(dataIni)} a ${formatDateDDMMYYYY(dataFim)}`,
        emailDestino,
        nomeArquivo
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao enviar remessa Equifax por email:', error);

    // Atualizar status do histórico para erro
    try {
      await pool.query(`
        UPDATE db_manaus.historico_remessa_equifax
        SET status = 'erro', erro_descricao = $1
        WHERE periodo_inicio = $2 AND periodo_fim = $3 AND tipo_envio = 'email'
        AND email_destino = $4 AND status = 'pendente'
        ORDER BY data_envio DESC LIMIT 1
      `, [error.message, dataIni, dataFim, emailDestino]);
    } catch (histError) {
      console.warn('⚠️ Erro ao atualizar status de erro no histórico:', histError);
    }

    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}