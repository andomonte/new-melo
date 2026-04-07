import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface VendaDetalhesSimples {
  codvenda: string;
  cliente: string;
  vendedor: string;
  horario: string;
  operacao: string;
  total: string;
  itens: any[];
}

export const gerarPDFSimples = async (
  vendaDetalhes: VendaDetalhesSimples,
): Promise<void> => {
  try {
    console.log('🔄 Iniciando geração de PDF simples');

    // Teste 1: Criar documento PDF
    console.log('📄 Criando documento jsPDF...');
    const doc = new jsPDF();

    // Teste 2: Gerar QR Code
    console.log('🔄 Gerando QR Code...');
    const qrCodeDataURL = await QRCode.toDataURL(vendaDetalhes.codvenda, {
      width: 100,
      margin: 2,
    });
    console.log('✅ QR Code gerado com sucesso');

    // Teste 3: Adicionar conteúdo básico
    console.log('📝 Adicionando conteúdo...');
    doc.setFontSize(16);
    doc.text('TESTE DE PDF - PEDIDO SEPARAÇÃO', 20, 30);

    doc.setFontSize(12);
    doc.text(`Código da Venda: ${vendaDetalhes.codvenda}`, 20, 50);
    doc.text(`Cliente: ${vendaDetalhes.cliente}`, 20, 60);
    doc.text(`Total: R$ ${vendaDetalhes.total}`, 20, 70);

    // Adicionar QR Code
    doc.addImage(qrCodeDataURL, 'PNG', 150, 20, 30, 30);

    // Adicionar itens básicos
    doc.text('ITENS:', 20, 90);
    vendaDetalhes.itens.forEach((item, index) => {
      const y = 100 + index * 10;
      doc.text(
        `${item.codprod} - ${item.descricao} - Qtd: ${item.quantidade}`,
        20,
        y,
      );
    });

    // Teste 4: Salvar PDF
    console.log('💾 Salvando PDF...');
    const nomeArquivo = `teste_pedido_${
      vendaDetalhes.codvenda
    }_${Date.now()}.pdf`;
    doc.save(nomeArquivo);
    console.log('✅ PDF salvo com sucesso:', nomeArquivo);

    return Promise.resolve();
  } catch (error) {
    console.error('❌ Erro ao gerar PDF simples:', error);
    throw error;
  }
};
