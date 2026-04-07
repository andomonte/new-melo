import { NextApiRequest, NextApiResponse } from 'next';
import { gerarPreviewCupomFiscal } from '@/utils/gerarPDFCupomFiscal';

/**
 * API TEMPORÁRIA para gerar PDF Mock do Cupom Fiscal
 * Endpoint: GET /api/faturamento/gerar-cupom-mock
 * 
 * Para usar:
 * 1. npm run dev
 * 2. Acesse: http://localhost:3000/api/faturamento/gerar-cupom-mock
 * 3. O PDF será baixado automaticamente
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    console.log('🎫 Gerando PDF Mock do Cupom Fiscal (NFC-e)...\n');

    // Dados mock completos
    const fatura = {
      codfat: 'MOCK001',
      nroform: '001701801',
      serie: '3',
      natureza: 'Venda de mercadoria',
      nomefant: 'João da Silva',
      cpfcgc: '12345678901', // CPF
      data: '2025-05-10T16:03:39',
      ender: 'Rua Exemplo, 123',
      numero: '123',
      bairro: 'Centro',
      cep: '69000000',
      cidade: 'Manaus',
      fone: '92999998888',
      uf: 'AM',
      iest: '',
      totalnf: 16.20,
      totalprod: 16.20,
      nomevendedor: 'Maria Vendedora',
      cfop2: '5102'
    };

    const produtos = [
      {
        codprod: '000002515A',
        descr: 'Aloha psd',
        ncm: '12345678',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 4.60,
        total_item: 4.60,
        dbprod: {
          descr: 'Aloha psd'
        }
      },
      {
        codprod: '00000058B72',
        descr: 'Holo 06 psds',
        ncm: '87654321',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 6.00,
        total_item: 6.00,
        dbprod: {
          descr: 'Holo 06 psds'
        }
      },
      {
        codprod: '00000026981',
        descr: 'Pastel Gang psd',
        ncm: '11223344',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 5.60,
        total_item: 5.60,
        dbprod: {
          descr: 'Pastel Gang psd'
        }
      }
    ];

    const venda = {
      nrovenda: 'VND12345',
      obs: 'Pagamento à vista',
      transp: ''
    };

    const dadosEmpresa = {
      nomecontribuinte: 'GMFIOART',
      nomefantasia: 'GMFIOART',
      cgc: '03646880000192',
      logradouro: 'Rua Exemplo',
      numero: '123',
      municipio: 'Manaus',
      uf: 'AM',
      cep: '69000-000',
      telefone: '9232221111',
      inscricaoestadual: '44.215.710'
    };

    const dadosNFe = {
      chaveAcesso: '13250504618800019265001000170180112643814270737376',
      protocolo: '135210000123456',
      numeroNFe: '001701801',
      serieNFe: '3',
      dataEmissao: '2025-05-10T16:03:39',
      valorTotal: 16.20
    };

    console.log('📝 Gerando PDF do cupom...');

    // Gerar PDF
    const pdfDoc = await gerarPreviewCupomFiscal(
      fatura,
      produtos,
      venda,
      dadosEmpresa,
      'valida', // Tipo válida para mostrar QR Code
      dadosNFe
    );

    // Converter para buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    console.log('✅ PDF gerado com sucesso!');
    console.log('📊 Tamanho:', pdfBuffer.length, 'bytes');

    // Retornar PDF como download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cupom-fiscal-mock.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);

  } catch (error: any) {
    console.error('❌ Erro ao gerar PDF mock:', error);
    console.error('Stack:', error.stack);

    return res.status(500).json({
      erro: 'Erro ao gerar PDF mock do cupom fiscal',
      detalhes: error.message,
      stack: error.stack
    });
  }
}
