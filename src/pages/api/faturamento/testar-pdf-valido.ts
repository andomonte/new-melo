import type { NextApiRequest, NextApiResponse } from 'next';
import { gerarNotaFiscalValida } from '@/utils/gerarPreviewNF';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    // Dados fake para teste
    const faturaTeste = {
      nroform: '000000123',
      serie: '1',
      natureza: 'Venda de Mercadoria',
      nomefant: 'CLIENTE TESTE LTDA',
      cpfcgc: '12.345.678/0001-90',
      data: new Date().toISOString(),
      ender: 'Rua do Teste, 123',
      numero: '123',
      bairro: 'Centro',
      cep: '69000-000',
      cidade: 'Manaus',
      fone: '(92) 3333-4444',
      uf: 'AM',
      iest: '05.123.456-7',
      baseicms: 0, // Será calculado
      valor_icms: 25.50,
      baseicms_subst: 0,
      vlrfrete: 25.00,
      vlrseg: 15.00,
      vlrdesp: 10.50,
      totalprod: 0, // Será calculado baseado nos produtos
      valor_pis: 1.50,
      valor_cofins: 6.90,
      valor_ipi: 0,
      totalnf: 0, // Será calculado
      destfrete: '1',
      cfop2: '5102',
      nomevendedor: 'João Vendedor da Silva'
    };

    const produtosTeste = [
      {
        codprod: 'PROD001',
        descr: 'Smartphone Samsung Galaxy A54 128GB Preto',
        ncm: '85171211',
        cst: '0102',
        unimed: 'UN',
        qtd: 2,
        prunit: 899.90,
        total_item: 1799.80
      },
      {
        codprod: 'PROD002',
        descr: 'Notebook Dell Inspiron 15 3000 Intel Core i5 8GB 256GB SSD',
        ncm: '84713012',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 2499.00,
        total_item: 2499.00
      },
      {
        codprod: 'PROD003',
        descr: 'Smart TV LED 55" 4K UHD Samsung Crystal TU7000',
        ncm: '85287290',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 1899.99,
        total_item: 1899.99
      },
      {
        codprod: 'PROD004',
        descr: 'Fone de Ouvido Bluetooth JBL Tune 510BT Preto',
        ncm: '85183000',
        cst: '0102',
        unimed: 'UN',
        qtd: 3,
        prunit: 149.90,
        total_item: 449.70
      },
      {
        codprod: 'PROD005',
        descr: 'Mouse Gamer Logitech G203 RGB 8000 DPI',
        ncm: '84716090',
        cst: '0102',
        unimed: 'UN',
        qtd: 2,
        prunit: 89.99,
        total_item: 179.98
      },
      {
        codprod: 'PROD006',
        descr: 'Teclado Mecânico Gamer Redragon Kumara K552 RGB',
        ncm: '84716010',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 199.90,
        total_item: 199.90
      },
      {
        codprod: 'PROD007',
        descr: 'Monitor LED 24" Full HD Samsung F24T350FHL',
        ncm: '85285200',
        cst: '0102',
        unimed: 'UN',
        qtd: 2,
        prunit: 599.00,
        total_item: 1198.00
      },
      {
        codprod: 'PROD008',
        descr: 'Cadeira Gamer DT3 Sports Elise Preta e Rosa',
        ncm: '94013000',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 799.90,
        total_item: 799.90
      },
      {
        codprod: 'PROD009',
        descr: 'Impressora Multifuncional HP DeskJet Ink Advantage 2774',
        ncm: '84433210',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 349.00,
        total_item: 349.00
      },
      {
        codprod: 'PROD010',
        descr: 'Webcam Logitech C270 HD 720p USB',
        ncm: '85258100',
        cst: '0102',
        unimed: 'UN',
        qtd: 2,
        prunit: 129.90,
        total_item: 259.80
      }
    ];

    // Gerar mais produtos para testar paginação (total de 80 produtos)
    for (let i = 11; i <= 80; i++) {
      produtosTeste.push({
        codprod: `PROD${i.toString().padStart(3, '0')}`,
        descr: `Produto de Teste ${i} - Descrição detalhada do item número ${i} com especificações técnicas`,
        ncm: `${(12345678 + i).toString().slice(0, 8)}`,
        cst: i % 2 === 0 ? '0102' : '0400',
        unimed: ['UN', 'PC', 'KG', 'MT'][i % 4],
        qtd: Math.floor(Math.random() * 5) + 1,
        prunit: parseFloat((Math.random() * 500 + 50).toFixed(2)),
        total_item: 0 // Será calculado abaixo
      });
      
      // Calcular total do item
      const ultimoProduto = produtosTeste[produtosTeste.length - 1];
      ultimoProduto.total_item = parseFloat((ultimoProduto.qtd * ultimoProduto.prunit).toFixed(2));
    }

    // Calcular totais da fatura baseado nos produtos
    const totalProdutos = produtosTeste.reduce((sum, p) => sum + p.total_item, 0);
    faturaTeste.totalprod = parseFloat(totalProdutos.toFixed(2));
    faturaTeste.totalnf = parseFloat((totalProdutos + 25.50).toFixed(2)); // + impostos

    const vendaTeste = {
      transp: 'TRANSPORTADORA TESTE LTDA',
      nrovenda: '123456',
      obs: 'Observações de teste para a venda'
    };

    const dadosEmpresaTeste = {
      nomefantasia: 'LEAO DE JUDA TECNOLOGIA',
      logradouro: 'Rua Emitente',
      numero: '456',
      municipio: 'Manaus',
      uf: 'AM',
      cep: '69000-100',
      telefone: '92999887766',
      inscricaoestadual: '05.337.466-5',
      cgc: '18.053.139/0001-69',
      iest_subst: '',
      inscricaomunicipal: '123456789',
      nomecontribuinte: 'LEAO DE JUDA TECNOLOGIA LTDA'
    };

    const dadosNFeTeste = {
      chaveAcesso: '52240518053139000169550010000001231234567890',
      protocolo: '135240922769045',
      numeroNFe: '123',
      dataEmissao: new Date().toISOString(),
      valorTotal: faturaTeste.totalnf
    };

    console.log('🧪 Testando geração de PDF com dados válidos...', {
      totalProdutos: produtosTeste.length,
      valorTotal: faturaTeste.totalnf
    });

    const pdfDoc = await gerarNotaFiscalValida(
      faturaTeste,
      produtosTeste,
      vendaTeste,
      dadosEmpresaTeste,
      dadosNFeTeste
    );

    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    const pdfBase64 = pdfBuffer.toString('base64');

    console.log('✅ PDF gerado com sucesso!', {
      tamanho: `${Math.round(pdfBuffer.length / 1024)}KB`,
      totalProdutos: produtosTeste.length,
      valorTotal: faturaTeste.totalnf,
      chaveAcesso: dadosNFeTeste.chaveAcesso,
      protocolo: dadosNFeTeste.protocolo
    });

    // Configurar headers para download do PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="nota-fiscal-teste-multipaginas.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Retornar o PDF diretamente
    return res.status(200).send(pdfBuffer);

  } catch (error: any) {
    console.error('❌ Erro ao gerar PDF de teste:', error);
    
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro ao gerar PDF de teste',
      detalhe: error.message || error.toString()
    });
  }
}
