import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { enviarDocumentoFiscal } from '@/lib/nfeEmailService';
//validar

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat, emailCliente, nomeCliente, xmlAssinado } = req.body;

  if (!codfat || !emailCliente) {
    return res.status(400).json({
      error: 'Código da fatura e email do cliente são obrigatórios',
    });
  }

  try {
    const client = await getPgPool().connect();

    // Buscar dados da fatura e NFC-e
    const queryFatura = `
      SELECT
        f.*,
        nfe.chave,
        nfe.numprotocolo,
        nfe.dthrprotocolo,
        CAST(nfe.nrodoc_fiscal AS TEXT) as numero_nfce,
        nfe.imagem as pdf_nfce,
        -- Dados da empresa na venda
        v.cnpj_empresa,
        v.ie_empresa
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      LEFT JOIN db_manaus.fatura_venda fv ON f.codfat = fv.codfat
      LEFT JOIN db_manaus.dbvenda v ON fv.codvenda = v.codvenda
      WHERE f.codfat = $1
    `;

    const faturaResult = await client.query(queryFatura, [codfat]);

    if (faturaResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const fatura = faturaResult.rows[0];

    // Verificar se NFC-e foi emitida
    if (!fatura.chave || !fatura.numprotocolo) {
      client.release();
      return res.status(400).json({
        error: 'NFC-e não foi emitida para esta fatura',
      });
    }

    // Verificar se já foi enviado
    if (fatura.emailenviado === 'S') {
      client.release();
      return res.status(400).json({
        error: 'Email da NFC-e já foi enviado anteriormente',
      });
    }

    console.log('📧 Preparando envio de NFC-e por email...');
    console.log('📧 Destinatário:', emailCliente);
    console.log('📧 Cliente:', nomeCliente);
    console.log('📧 Número NFC-e:', fatura.numero_nfce);

    // Preparar dados para envio
    const pdfNFCe = fatura.pdf_nfce; // Já está como Buffer no banco

    if (!pdfNFCe) {
      client.release();
      return res.status(400).json({
        error: 'PDF da NFC-e não encontrado',
      });
    }

    // DEBUG: Log dos campos de valor disponíveis na fatura
    console.log('📊 DEBUG - Campos de valor da fatura:', {
      codfat: fatura.codfat,
      totalnf: fatura.totalnf,
      totalnota: fatura.totalnota,
      total_nf: fatura.total_nf,
      valor_total: fatura.valor_total,
      total: fatura.total,
    });

    // Obter valor total - tentar múltiplos campos
    const valorFatura = parseFloat(
      fatura.totalnf || 
      fatura.totalnota || 
      fatura.total_nf || 
      fatura.valor_total || 
      fatura.total || 
      '0'
    );

    console.log('💰 Valor extraído para email:', valorFatura);

    // Enviar email
    const resultadoEmail = await enviarDocumentoFiscal({
      destinatario: emailCliente,
      nomeCliente: nomeCliente,
      numeroNota: fatura.numero_nfce,
      valorTotal: valorFatura,
      dataEmissao: fatura.data,
      pdfDocumento: pdfNFCe,
      xmlDocumento: xmlAssinado,
      chaveAcesso: fatura.chave,
      tipoDocumento: 'nfce',
      cnpjEmpresa: fatura.cnpj_empresa,
      ieEmpresa: fatura.ie_empresa
    });

    // Marcar como enviado no banco
    await client.query(
      'UPDATE db_manaus.dbfat_nfe SET emailenviado = $1 WHERE codfat = $2',
      ['S', codfat],
    );

    client.release();

    console.log('✅ Email NFC-e enviado com sucesso!');

    res.status(200).json({
      sucesso: true,
      mensagem: 'Email da NFC-e enviado com sucesso',
      destinatario: emailCliente,
      messageId: resultadoEmail.messageId,
    });

  } catch (error: any) {
    console.error('❌ Erro ao enviar email da NFC-e:', error);

    res.status(500).json({
      error: 'Erro ao enviar email da NFC-e',
      detalhes: error.message,
    });
  }
}