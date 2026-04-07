import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import axios from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fatura: any; // Recebemos a fatura para obter o 'codfat'
}

// Função auxiliar para evitar erros com valores nulos
const getValue = (value: any, defaultValue: string | number = '') =>
  value ?? defaultValue;

const ModalBoletos: React.FC<Props> = ({ isOpen, onClose, fatura }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sua função original 'drawField' para desenhar os campos do boleto
  const drawField = (
    doc: jsPDF,
    title: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: any = {},
  ) => {
    const {
      valueAlign = 'left',
      valueSize = 9,
      titleSize = 6,
      titleYOffset = 8,
      valueYOffset = 20,
    } = options;
    doc.setLineWidth(0.5);
    doc.rect(x, y, width, height);
    doc.setFontSize(titleSize).setFont('helvetica', 'normal');
    doc.text(title.toUpperCase(), x + 3, y + titleYOffset);
    let textX = valueAlign === 'right' ? x + width - 3 : x + 3;
    if (valueAlign === 'center') textX = x + width / 2;
    doc.setFontSize(valueSize).setFont('helvetica', 'bold');
    doc.text(value, textX, y + valueYOffset, { align: valueAlign as any });
  };

  // Função adaptada para gerar preview (sem dados sensíveis)
  const desenharLayoutFielDoBoleto = (
    doc: jsPDF,
    startY: number,
    boleto: any,
    cedente: any,
    sacado: any,
  ) => {
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - margin * 2;
    let y = startY;

    // --- Parte de Cima (Recibo do Cliente) ---
    doc.setFont('helvetica', 'bold').setFontSize(12);
    // ADAPTADO: Usando 'nomecontribuinte' da sua tabela
    doc.text(getValue(cedente?.nomecontribuinte), margin, y);
    doc.text(
      `${getValue(boleto.nome_banco)} | ${getValue(boleto.cod_banco)}`,
      pageWidth - margin,
      y,
      { align: 'right' },
    );
    y += 12;
    doc.setFontSize(8);
    doc.text('SEU DISTRIBUIDOR 100% ATACADO', margin, y);
    y += 15;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('RECIBO DO CLIENTE', margin, y);
    y += 12;

    const sacadoNome = `(${getValue(sacado?.codcli)}) ${getValue(
      sacado?.nomefant,
    )} CNPJ ${getValue(sacado?.cpfcgc)}`;
    const sacadoEndereco = `${getValue(sacado?.ender)} - ${getValue(
      sacado?.bairro,
    )} - ${getValue(sacado?.cidade)}/${getValue(sacado?.uf)} CEP:${getValue(
      sacado?.cep,
    )}`;
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Nome do Cliente', margin, y);
    y += 10;
    doc.text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 15;

    doc.text(`Número Docto.: ${getValue(boleto.numero_documento)}`, margin, y);
    doc.text(
      `Data do Vencto: ${new Date(boleto.vencimento).toLocaleDateString(
        'pt-BR',
      )}`,
      margin + 250,
      y,
    );
    doc.text(
      `Valor Documento: ${Number(boleto.valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}`,
      margin + 400,
      y,
    );
    y += 15;
    // PREVIEW: Oculta nosso número com asteriscos
    doc.text(`Nosso Número: ****`, margin, y);
    doc.text('Autenticação Mecânica (no verso)', pageWidth - margin, y, {
      align: 'right',
    });

    y += 15;
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 15;

    // --- Parte de Baixo (Ficha de Compensação) ---
    doc.setFont('helvetica', 'bold').setFontSize(14);
    doc.text(
      `${getValue(boleto.nome_banco)} | ${getValue(boleto.cod_banco)}`,
      margin,
      y + 18,
    );

    // PREVIEW: Não mostra linha digitável
    y += 28;

    const fieldY1 = y;
    const mainWidth = contentWidth - 160;
    drawField(
      doc,
      'Local de Pagamento',
      'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Banco Santander.',
      margin,
      fieldY1,
      mainWidth,
      35,
    );
    drawField(
      doc,
      'Vencimento',
      new Date(boleto.vencimento).toLocaleDateString('pt-BR'),
      margin + mainWidth,
      fieldY1,
      160,
      35,
      { valueAlign: 'right' },
    );

    const fieldY2 = fieldY1 + 35;
    // ADAPTADO: Usando 'nomecontribuinte' e 'cgc' da sua tabela
    drawField(
      doc,
      'Cedente',
      `${getValue(cedente?.nomecontribuinte)} - CNPJ: ${getValue(
        cedente?.cgc,
      )}`,
      margin,
      fieldY2,
      mainWidth,
      25,
    );
    drawField(
      doc,
      'Agência / Cód.Cedente',
      '1403/0009560',
      margin + mainWidth,
      fieldY2,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY3 = fieldY2 + 25;
    drawField(
      doc,
      'Data de Emissão',
      new Date(boleto.data_emissao_fatura).toLocaleDateString('pt-BR'),
      margin,
      fieldY3,
      90,
      25,
    );
    drawField(
      doc,
      'Número Docto',
      getValue(boleto.numero_documento),
      margin + 90,
      fieldY3,
      110,
      25,
    );
    drawField(
      doc,
      'Espécie Docto',
      getValue(boleto.tipofat, 'DM'),
      margin + 200,
      fieldY3,
      80,
      25,
    );
    drawField(doc, 'Aceite', 'N', margin + 280, fieldY3, 40, 25);
    drawField(
      doc,
      'Data Processamento',
      new Date().toLocaleDateString('pt-BR'),
      margin + 320,
      fieldY3,
      mainWidth - 320,
      25,
    );
    drawField(
      doc,
      'Nosso Número',
      '****', // PREVIEW: Oculta nosso número
      margin + mainWidth,
      fieldY3,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY4 = fieldY3 + 25;
    drawField(doc, 'Uso do Banco', '', margin, fieldY4, 90, 25);
    drawField(doc, 'CIP', '', margin + 90, fieldY4, 60, 25);
    drawField(
      doc,
      'Carteira',
      'COBRANCA SIMPLES - RCR',
      margin + 150,
      fieldY4,
      170,
      25,
    );
    drawField(doc, 'Moeda', 'R$', margin + 320, fieldY4, 45, 25);
    drawField(
      doc,
      'Quantidade',
      '',
      margin + 365,
      fieldY4,
      mainWidth - 365,
      25,
    );
    drawField(
      doc,
      '(=) Valor do Docto',
      Number(boleto.valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      margin + mainWidth,
      fieldY4,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY5 = fieldY4 + 25;
    const instrucoes = `:: Senhor(a) caixa, não receber em CHEQUES.\n:: Após o vencimento cobrar mora de R$ 3.74 por dia de atraso.\n:: Título sujeito a protesto à partir de 11 dias após vencimento.`;
    drawField(
      doc,
      'Instruções (Todas informações deste bloqueto são de exclusiva responsabilidade do cedente)',
      instrucoes,
      margin,
      fieldY5,
      mainWidth,
      60,
      { valueSize: 7, valueYOffset: 15 },
    );
    drawField(
      doc,
      '(-) Desconto/Abatimento',
      '',
      margin + mainWidth,
      fieldY5,
      160,
      20,
      { valueAlign: 'right' },
    );
    drawField(
      doc,
      '(+) Mora/Multa',
      '',
      margin + mainWidth,
      fieldY5 + 20,
      160,
      20,
      { valueAlign: 'right' },
    );
    drawField(
      doc,
      '(=) Valor Cobrado',
      '',
      margin + mainWidth,
      fieldY5 + 40,
      160,
      20,
      { valueAlign: 'right' },
    );

    y = fieldY5 + 65;
    doc.setFont('helvetica', 'normal').setFontSize(6).text('SACADO', margin, y);
    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(9).text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(6);
    doc.text('SACADOR/AVALISTA', margin + mainWidth, y);

    y += 10;
    // PREVIEW: Não gera código de barras
    y += 45;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(
      'Autenticação Mecânica / Ficha de Compensação',
      pageWidth - margin,
      y,
      { align: 'right' },
    );

    return y + 10;
  };

  useEffect(() => {
    const gerarPdf = async () => {
      if (!isOpen || !fatura?.codfat) return;

      setIsLoading(true);
      setPdfUrl(null);
      const toastId = toast.loading('Buscando dados e gerando PDF...');

      try {
        const { data } = await axios.get(
          '/api/faturamento/buscar_boletos_fatura',
          {
            params: { codfat: fatura.codfat },
          },
        );

        const { cedente, sacado, boletos } = data;

        if (!boletos || boletos.length === 0) {
          toast.warning('Nenhum boleto encontrado para esta fatura.', {
            id: toastId,
          });
          onClose();
          return;
        }

        const doc = new jsPDF('p', 'pt', 'a4');
        const _pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        let y = margin;
        const _TICKET_BLOCK_HEIGHT = 400;
        const separatorHeight = 20; // Height for separator line

        for (let i = 0; i < boletos.length; i += 2) {
          // Check if we need a new page (for the pair of boletos)
          if (i > 0) {
            doc.addPage();
            y = margin;
          }

          // Add first boleto
          const firstBoletoY = y;
          const firstBoletoEndY = desenharLayoutFielDoBoleto(
            doc,
            firstBoletoY,
            boletos[i],
            cedente,
            sacado,
          );

          // Check if we have a second boleto
          if (i + 1 < boletos.length) {
            // Add separator line
            const separatorY = firstBoletoEndY + 10;
            doc.setLineWidth(1);
            doc.line(
              margin,
              separatorY,
              doc.internal.pageSize.width - margin,
              separatorY,
            );

            // Add second boleto
            const secondBoletoY = separatorY + separatorHeight;
            desenharLayoutFielDoBoleto(
              doc,
              secondBoletoY,
              boletos[i + 1],
              cedente,
              sacado,
            );
          }
        }

        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        toast.success('PDF gerado com sucesso!', { id: toastId });
      } catch (error: any) {
        console.error('ERRO DETALHADO AO GERAR PDF:', error);
        toast.error(error?.response?.data?.error || 'Falha ao gerar o PDF.', {
          id: toastId,
        });
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    gerarPdf();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, fatura]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle>
            Preview de Boletos - Fatura {fatura?.codfat}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p>Gerando boletos...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              width="100%"
              height="100%"
              title="Preview dos Boletos"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p>Não foi possível gerar a visualização.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalBoletos;
