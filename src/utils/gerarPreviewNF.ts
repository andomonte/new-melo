import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { gerarChaveDeAcessoPlaceholder } from './gerarcahveAcesso';

// Importação condicional do canvas para Node.js
let createCanvas: any;
if (typeof window === 'undefined') {
  // No servidor Node.js
  try {
    createCanvas = require('@napi-rs/canvas').createCanvas;
  } catch {
    // Fallback se não conseguir importar
    createCanvas = null;
  }
}

// Cache para a logo - será preenchida na primeira página e reutilizada nas demais
let logoBase64Cache: string | null = null;

// =================================================================================
// 0. FUNÇÃO AUXILIAR PARA CABEÇALHO COMPLETO
// =================================================================================

// Função para desenhar o cabeçalho completo da DANFE
function desenharCabecalhoCompleto(
  doc: jsPDF,
  dadosEmpresa: any,
  fatura: any,
  dadosNota: any,
  pageNumber: number = 1,
) {
  const pageWidth = doc.internal.pageSize.width;
  const marginLeft = 75; // 10 margem + 55 canhoto + 10 gap
  const marginRight = 10;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const margin = marginLeft;

  // Função auxiliar getValue
  const getValue = (value: any, defaultValue = '') => {
    return value !== null && value !== undefined && value !== ''
      ? String(value)
      : String(defaultValue);
  };

  // Bloco principal do cabeçalho - MESMO PADRÃO DA PRIMEIRA PÁGINA
  const mainBlockY = 20;
  const mainBlockHeight = 70;
  
  // Layout: Emitente (45% sem borda), DANFE (20% com borda), Controle (35% com borda)
  const emitterWidth = contentWidth * 0.45;
  const danfeWidth = contentWidth * 0.20;
  const controlWidth = contentWidth - emitterWidth - danfeWidth;
  const danfeX = margin + emitterWidth;
  const controlX = danfeX + danfeWidth;

  // Limpar a área do cabeçalho
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, mainBlockY, contentWidth, mainBlockHeight + 25, 'F');

  // Borda APENAS ao redor de DANFE e CONTROLE (não inclui emitente)
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(danfeX, mainBlockY, danfeWidth + controlWidth, mainBlockHeight);
  doc.setLineWidth(0.5);
  doc.line(controlX, mainBlockY, controlX, mainBlockY + mainBlockHeight);

  // -- COLUNA 1: EMITENTE COM LOGO GRANDE (SEM BORDA)
  // Logo grande - mesmo tamanho da primeira página
  const logoWidth = 200;
  const logoHeight = 120;
  const logoX = margin - 7;
  const logoY = mainBlockY - 20;

  // Carregar logo usando cache se disponível
  try {
    if (logoBase64Cache) {
      // Usar cache da logo
      doc.addImage(logoBase64Cache, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } else if (typeof window === 'undefined') {
      // No servidor - carregar do arquivo
      try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(process.cwd(), 'public', 'images', 'MeloLogo.png');
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
          logoBase64Cache = logoBase64; // Salvar no cache
          doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
        }
      } catch (e) {
        console.log('⚠️ Logo não carregada na página', pageNumber);
      }
    } else {
      // No cliente - logo será carregada pela primeira página, fallback para texto
      doc.setFontSize(14).setFont('helvetica', 'bold');
      doc.text('MELO', logoX + logoWidth / 2, logoY + logoHeight / 2, { align: 'center' });
    }
  } catch (error) {
    doc.setFontSize(14).setFont('helvetica', 'bold');
    doc.text('MELO', logoX + logoWidth / 2, logoY + logoHeight / 2, { align: 'center' });
  }

  // Título "Identificação do Emitente" ao lado do logo
  const emitterTextX = logoX + logoWidth - 2;
  let emitterTextY = mainBlockY + 22;
  
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text('Identificação do Emitente', emitterTextX, emitterTextY);
  
  // Dados da empresa
  emitterTextY += 14;
  doc.setFontSize(8).setFont('helvetica', 'normal');
  const endereco = getValue(dadosEmpresa.logradouro || dadosEmpresa.endereco);
  const numero = getValue(dadosEmpresa.numero);
  doc.text(`${endereco}, No.${numero} PC 14 JANEIRO`, emitterTextX, emitterTextY);

  emitterTextY += 10;
  const municipio = getValue(dadosEmpresa.municipio || dadosEmpresa.cidade);
  const uf = getValue(dadosEmpresa.uf);
  const cep = getValue(dadosEmpresa.cep);
  doc.text(`CEP: ${cep} ${municipio} (${uf})`, emitterTextX, emitterTextY);

  emitterTextY += 10;
  const tel = getValue(dadosEmpresa.contato || dadosEmpresa.telefone || dadosEmpresa.fone);
  if (tel) {
    doc.text(`FONE: (${tel.substring(0, 2)})${tel.substring(2)}`, emitterTextX, emitterTextY);
  }

  // -- COLUNA 2: DANFE (DENTRO DO QUADRADO) - Layout compacto
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text('DANFE', danfeX + danfeWidth / 2, mainBlockY + 12, { align: 'center' });
  
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('DOCUMENTO AUXILIAR DE', danfeX + danfeWidth / 2, mainBlockY + 19, { align: 'center' });
  doc.text('NOTA FISCAL ELETRÔNICA', danfeX + danfeWidth / 2, mainBlockY + 24, { align: 'center' });
  
  doc.setFontSize(6);
  doc.text('0 - ENTRADA', danfeX + 3, mainBlockY + 32);
  doc.text('1 - SAÍDA', danfeX + 3, mainBlockY + 39);
  
  // Checkbox
  const checkboxX = danfeX + danfeWidth - 18;
  const checkboxY = mainBlockY + 28;
  doc.rect(checkboxX, checkboxY, 14, 14);
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('1', checkboxX + 4, checkboxY + 10);
  
  // Nº, SÉRIE, FOLHA
  const nNota = getValue(dadosNota.numeroNFe || fatura?.nroform || '000');
  const sNota = getValue(dadosNota.serieNFe || fatura?.serie || '1');
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('Nº', danfeX + 3, mainBlockY + 48);
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(nNota.padStart(9, '0'), danfeX + 12, mainBlockY + 48);
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('SÉRIE', danfeX + 3, mainBlockY + 56);
  doc.text('FOLHA', danfeX + danfeWidth / 2, mainBlockY + 56);
  
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(sNota.padStart(3, '0'), danfeX + 3, mainBlockY + 63);
  doc.text(`${pageNumber}`, danfeX + danfeWidth / 2, mainBlockY + 63);

  // -- COLUNA 3: CONTROLE DO FISCO COM CÓDIGO DE BARRAS
  const chaveAcesso = getValue(dadosNota.chaveAcesso);
  
  // Código de barras no topo
  const barcodeStartY = mainBlockY + 5;
  const barcodeHeight = 22;
  
  if (chaveAcesso && chaveAcesso !== 'SEM VALIDADE') {
    try {
      let canvas: any;
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
      } else if (createCanvas) {
        canvas = createCanvas(200, 100);
      } else {
        throw new Error('Canvas não disponível');
      }

      JsBarcode(canvas, chaveAcesso, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 20,
        width: 1.2,
      });

      const barcodeImage = canvas.toDataURL('image/png');
      doc.addImage(barcodeImage, 'PNG', controlX + 3, barcodeStartY, controlWidth - 6, barcodeHeight);
    } catch (e) {
      // Fallback
      for (let i = 0; i < 30; i++) {
        const x = controlX + 5 + i * ((controlWidth - 10) / 30);
        doc.setLineWidth(0.6);
        doc.line(x, barcodeStartY + 2, x, barcodeStartY + barcodeHeight - 2);
      }
    }
  }

  // Linha após código de barras
  const barcodeLineY = barcodeStartY + barcodeHeight + 2;
  doc.setLineWidth(0.3);
  doc.line(controlX, barcodeLineY, controlX + controlWidth, barcodeLineY);

  // CHAVE DE ACESSO
  const chaveY = barcodeLineY;
  const chaveHeight = 18;
  doc.line(controlX, chaveY + chaveHeight, controlX + controlWidth, chaveY + chaveHeight);

  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('CHAVE DE ACESSO', controlX + 2, chaveY + 5);

  const chaveFormatada = chaveAcesso === 'SEM VALIDADE' 
    ? chaveAcesso 
    : chaveAcesso.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
  doc.setFontSize(5).setFont('helvetica', 'bold');
  doc.text(chaveFormatada, controlX + controlWidth / 2, chaveY + 12, { align: 'center' });

  // Consulta
  const consultaY = chaveY + chaveHeight;
  const consultaHeight = 12;
  doc.line(controlX, consultaY + consultaHeight, controlX + controlWidth, consultaY + consultaHeight);
  
  doc.setFontSize(4).setFont('helvetica', 'normal');
  doc.text('Consulta de autenticidade no portal nacional da NF-e', controlX + 2, consultaY + 4);
  doc.text('www.nfe.fazenda.gov.br/portal ou no Site da Sefaz Autorizadora', controlX + 2, consultaY + 8);

  // PROTOCOLO
  const protocoloY = consultaY + consultaHeight;
  const protocoloHeight = mainBlockHeight - (protocoloY - mainBlockY);
  
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('PROTOCOLO DE AUTORIZAÇÃO DE USO', controlX + 2, protocoloY + 5);
  
  const protocolo = getValue(dadosNota.protocolo);
  doc.setFontSize(6).setFont('helvetica', 'bold');
  doc.text(protocolo, controlX + controlWidth / 2, protocoloY + protocoloHeight / 2 + 2, { align: 'center' });

  // Segunda linha: Natureza da operação (APENAS NA PRIMEIRA PÁGINA)
  const secondBlockY = mainBlockY + mainBlockHeight + 5;
  const secondBlockHeight = 30;

  if (pageNumber === 1) {
    doc.setLineWidth(0.5);
    doc.rect(margin, secondBlockY, contentWidth, secondBlockHeight);
    doc.line(margin + contentWidth / 2, secondBlockY, margin + contentWidth / 2, secondBlockY + secondBlockHeight);
  }

  // Função auxiliar para desenhar campos
  function drawField(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left',
  ) {
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, width, 10, 'F');

    doc.setFontSize(6).setFont('helvetica', 'normal');
    doc.text(label, x + 2, y + 7);

    doc.setFontSize(8).setFont('helvetica', 'bold');
    const textY = y + height - 5;

    if (align === 'center') {
      doc.text(value, x + width / 2, textY, { align: 'center' });
    } else if (align === 'right') {
      doc.text(value, x + width - 2, textY, { align: 'right' });
    } else {
      doc.text(value, x + 2, textY);
    }
  }

  if (pageNumber === 1) {
    // Natureza da operação
    drawField(
      'NATUREZA DA OPERAÇÃO',
      getValue(fatura.natureza || 'Venda de mercadoria'),
      margin,
      secondBlockY,
      contentWidth / 2,
      secondBlockHeight,
    );

    // Dados do destinatário
    drawField(
      'DESTINATÁRIO/REMETENTE',
      getValue(fatura.nomefant || fatura.destinatario),
      margin + contentWidth / 2.6,
      secondBlockY,
      contentWidth / 2,
      secondBlockHeight,
    );

    return secondBlockY + secondBlockHeight + 10; // Retorna Y após bloco 2
  }

  return mainBlockY + mainBlockHeight + 10; // Retorna Y após bloco 1 (cabeçalho simplificado)
}

// =================================================================================
// 1. DEFINIÇÃO DE TIPOS E INTERFACES
// =================================================================================

// Tipos de nota fiscal
type TipoNota = 'preview' | 'valida';

interface DadosNFe {
  chaveAcesso?: string;
  protocolo?: string;
  numeroNFe?: string;
  serieNFe?: string;
  dataEmissao?: string;
  valorTotal?: number;
}

interface Fatura {
  nroform: string | number;
  serie?: string | number;
  natureza?: string;
  nomefant: string;
  cpfcgc: string;
  data: string;
  ender: string;
  numero?: string | number;
  bairro: string;
  cep: string;
  cidade: string;
  fone?: string;
  uf: string;
  iest?: string;
  baseicms?: number;
  valor_icms?: number;
  valor_icms_st?: number;
  baseicms_subst?: number;
  vlrfrete?: number;
  vlrseg?: number;
  vlrdesp?: number;
  vlrdesc?: number;
  desconto?: number;
  totalprod?: number;
  valor_pis?: number;
  valor_cofins?: number;
  valor_ipi?: number;
  aliquota_ibs?: number;
  valor_ibs?: number;
  aliquota_cbs?: number;
  valor_cbs?: number;
  ibs_estadual?: number;  // IBS Estadual
  ibs_municipal?: number; // IBS Municipal
  totalnf?: number;
  destfrete?: string;
  cfop2?: string;
  nomevendedor?: string;
}

interface Produto {
  codprod: string | number;
  descr: string;
  ncm?: string;

  unimed?: string;
  qtd?: string | number;
  prunit?: string | number;
  total_item?: string | number;
  dbprod?: {
    descr?: string;
    [key: string]: any;
  };
  cst?: string;
  origem?: string;
}

interface Venda {
  transp?: string;
  nrovenda?: string | number;
  obs?: string;
}

interface DadosEmpresa {
  nomefantasia?: string;
  logradouro: string;
  numero: string | number;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  contato?: string;
  inscricaoestadual: string;
  cgc: string;
  iest_subst?: string;
  inscricaomunicipal?: string;
  nomecontribuinte: string;
}

// =================================================================================
// 2. FUNÇÕES UTILITÁRIAS
// =================================================================================

const formatValue = (value: any): string => {
  const number = Number(value || 0);
  if (isNaN(number)) {
    return '0,00';
  }
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value: any): string => {
  const number = Number(value || 0);
  if (isNaN(number)) {
    return '0,00';
  }
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getValue = (value: any, defaultValue: string | number = ''): string => {
  if (value === null || value === undefined || value === '')
    return String(defaultValue);
  return String(value).trim();
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('pt-BR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (_e) {
    return '';
  }
};

// Função para obter dados baseados no tipo de nota
const obterDadosNota = (tipoNota: TipoNota, dadosNFe?: DadosNFe) => {
  if (tipoNota === 'valida' && dadosNFe) {
    return {
      chaveAcesso: dadosNFe.chaveAcesso || '',
      protocolo: dadosNFe.protocolo || '',
      textoMarcaDagua: '', // Sem marca d'água para nota válida
      opacidadeMarca: 0,
      corMarca: [0, 0, 0] as [number, number, number],
      exibirCodigoBarras: true,
    };
  } else {
    // Preview/Rascunho
    return {
      chaveAcesso: 'SEM VALIDADE',
      protocolo: 'SEM VALIDADE',
      textoMarcaDagua: 'SEM VALIDADE',
      opacidadeMarca: 0.2, // Transparência real - 20% opaco, 80% transparente
      corMarca: [80, 80, 80] as [number, number, number], // Cinza escuro para melhor contraste
      exibirCodigoBarras: false,
    };
  }
};

// =================================================================================
// 3. FUNÇÃO PRINCIPAL DE GERAÇÃO DO PDF
// =================================================================================

export const gerarPreviewNF = async (
  fatura: Fatura,
  produtos: Produto[],
  venda: Venda,
  dadosEmpresa: DadosEmpresa,
  tipoNota: TipoNota = 'preview',
  dadosNFe?: DadosNFe,
): Promise<jsPDF> => {
  // // TESTE URGENTE - Verificar se produtos chegam
  // console.log('� TESTE URGENTE - Status dos produtos:', {
  //   produtos_existe: !!produtos,
  //   produtos_length: produtos?.length,
  //   produtos_primeiro: produtos?.[0],
  //   produtos_estrutura_completa: JSON.stringify(produtos, null, 2)
  // });

  // ANÁLISE DETALHADA DO PRIMEIRO PRODUTO
  if (produtos && produtos.length > 0) {
    const primeiroProduto = produtos[0];
    // console.log('🔬 ANÁLISE DETALHADA DO PRIMEIRO PRODUTO:', {
    //   produto_completo: primeiroProduto,
    //   campos_disponíveis: Object.keys(primeiroProduto || {}),
    //   valores_principais: {
    //     codprod: primeiroProduto?.codprod,
    //     descr: primeiroProduto?.descr,
    //     qtd: primeiroProduto?.qtd,
    //     prunit: primeiroProduto?.prunit,
    //     dbprod: primeiroProduto?.dbprod
    //   },
    //   tipo_objeto: typeof primeiroProduto,
    //   eh_null: primeiroProduto === null,
    //   eh_undefined: primeiroProduto === undefined
    // });
  }

  // FORÇAR EXIBIÇÃO - Se não há produtos, vamos ver o que está acontecendo
  if (!produtos || produtos.length === 0) {
    console.error(
      '❌ PROBLEMA: Nenhum produto recebido na função gerarPreviewNF!',
    );
    console.error('❌ Fatura recebida:', fatura);
    console.error('❌ Venda recebida:', venda);
  }

  const doc = new jsPDF('landscape', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;


  // Obter dados baseados no tipo de nota
  const dadosNota = obterDadosNota(tipoNota, dadosNFe);

  // Helper para desenhar campos
  const drawField = (
    title: string,
    value: string,
    x: number,
    yPos: number,
    width: number,
    height: number,
    valueAlign: 'left' | 'center' | 'right' = 'left',
    valueSize = 7, // Reduzido de 9 para 7
  ) => {
    doc.setLineWidth(0.3); // Linha mais fina
    doc.rect(x, yPos, width, height);

    doc.setFontSize(5).setFont('helvetica', 'normal'); // Reduzido de 6 para 5
    doc.text(title.toUpperCase(), x + 2, yPos + 6);

    doc.setFontSize(valueSize).setFont('helvetica', 'bold');
    const textOptions: any = { align: valueAlign, baseline: 'middle' };
    let textX = x + 3;
    if (valueAlign === 'center') textX = x + width / 2;
    if (valueAlign === 'right') textX = x + width - 3;

    const valueLines = doc.splitTextToSize(value, width - 6);
    const vAlignOffset = height > 30 ? 12 : height / 2 + 4;
    doc.text(valueLines, textX, yPos + vAlignOffset, textOptions);
  };

  // DEFINIÇÃO DE MARGENS ASSIMÉTRICAS PARA CANHOTO VERTICAL
  const canhotoWidth = 55; 
  const marginLeft = 10 + canhotoWidth + 10;
  const marginRight = 10;
  const marginTop = 10;
  
  // Redefinir margin para afetar chamadas subsequentes
  const margin = marginLeft; 
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = marginTop;

  // 1. CANHOTO VERTICAL (Lateral Esquerda)
  const desenharCanhotoVertical = () => {
      const xCanhoto = 10;
      const wCanhoto = canhotoWidth; // 55
      const centroX = xCanhoto + wCanhoto / 2;
      const hTotal = pageHeight - 20; 
      const yStart = marginTop;
      
      doc.setLineWidth(0.5);
      
      const hAssinatura = hTotal * 0.32; 
      const hData = hTotal * 0.18;       
      const hRecebimento = hTotal * 0.35; 
      const hNFe = hTotal - hAssinatura - hData - hRecebimento; 
      
      let currentY = yStart;
      
      // === BLOCO 1: ASSINATURA ===
      doc.rect(xCanhoto, currentY, wCanhoto, hAssinatura);
      // Offset global para "descer" o texto (+20pt)
      const textYOffset = 20; 
      const centerY_Ass = currentY + hAssinatura / 1.2 + textYOffset;
        const recebass = currentY + hAssinatura / 3.2 + textYOffset;
      doc.setFontSize(6).setFont('helvetica', 'normal');
      doc.text("IDENTIFICAÇÃO E ASSINATURA", centroX + 27, centerY_Ass, { angle: 90, align: 'center' });
      doc.text("DO RECEBEDOR", centroX + 6, recebass, { angle: 90, align: 'center' });
      
      currentY += hAssinatura;
      
      // === BLOCO 2: DATA ===
      doc.rect(xCanhoto, currentY, wCanhoto, hData);
      const centerY_Data = currentY + hData / 2 + textYOffset;
      
      doc.text("DATA DE RECEBIMENTO", centroX + 16, centerY_Data + 10, { angle: 90, align: 'center' });
      
      currentY += hData;
      
      // === BLOCO 3: RECEBIMENTO ===
      doc.rect(xCanhoto, currentY, wCanhoto, hRecebimento);
      const centerY_Rec = currentY + hRecebimento / 1.2 + textYOffset; 
      
      const empNome = getValue(dadosEmpresa.nomecontribuinte, 'NOME DA EMPRESA').toUpperCase();
      const txt1 = `RECEBEMOS DE ${empNome}`;
      const txt2 = `OS PRODUTOS CONSTANTES NA NOTA INDICADA AO LADO`;
      
      doc.setFontSize(5).setFont('helvetica', 'normal');
      doc.text(txt1, centroX + 32, centerY_Rec, { angle: 90, align: 'center' });
      doc.text(txt2, centroX + 60, centerY_Rec, { angle: 90, align: 'center' });
      
      currentY += hRecebimento;
      
      // === BLOCO 4: NF-e e DADOS ===
      doc.rect(xCanhoto, currentY, wCanhoto, hNFe);
      // Ajuste fino do centro vertical do bloco
      const centerY_Nfe = currentY + hNFe / 1.4 + textYOffset;
      
      doc.setFontSize(10).setFont('helvetica', 'bold');
      const nNota = getValue(dadosNFe?.numeroNFe || fatura.numero || fatura.nroform || '000');
      const sNota = getValue(dadosNFe?.serieNFe || fatura.serie || '1');
      
      // LAYOUT SOLICITADO:
      // Linha 1 (Esq): "NF-e Nº [numero]"
      // Linha 2 (Dir): "Série [serie]"
      
      const linha1 = `NF-e Nº ${nNota}`;
      const linha2 = `Série ${sNota}`;
      
      // Ajustar tamanho da fonte baseado no comprimento do número
      // Números maiores (8+ dígitos) usam fonte menor para manter layout consistente
      const fontSizeNumero = nNota.length > 6 ? 8 : 10;
      doc.setFontSize(fontSizeNumero).setFont('helvetica', 'bold');
      doc.text(linha1, centroX + 10, centerY_Nfe, { angle: 90, align: 'center' });
      
      doc.setFontSize(8).setFont('helvetica', 'normal');
      doc.text(linha2, centroX + 6, centerY_Nfe, { angle: 90, align: 'center' });
      
      // Linha de Corte
      const corteX = marginLeft - 5;
      doc.setLineDashPattern([2, 2], 0);
      doc.line(corteX, 0, corteX, pageHeight);
      doc.setLineDashPattern([], 0); 
  };
  
  desenharCanhotoVertical();

  // 2. BLOCO PRINCIPAL - EMITENTE (fora do quadrado), DANFE e CONTROLE (dentro do quadrado)
  const mainBlockY = y;
  const mainBlockHeight = 70;
  
  // Layout conforme modelo do cliente:
  // Coluna 1: Emitente (logo grande + dados) - SEM BORDA ~45%
  // Coluna 2: DANFE - COM BORDA ~20%
  // Coluna 3: Código de barras + Chave + Protocolo - COM BORDA ~35%
  const emitterWidth = contentWidth * 0.45;
  const danfeWidth = contentWidth * 0.20;
  const controlWidth = contentWidth - emitterWidth - danfeWidth;
  const danfeX = margin + emitterWidth;
  const controlX = danfeX + danfeWidth;

  // Borda APENAS ao redor de DANFE e CONTROLE (não inclui emitente)
  doc.setLineWidth(1);
  doc.rect(danfeX, mainBlockY, danfeWidth + controlWidth, mainBlockHeight);
  doc.setLineWidth(0.5);
  doc.line(controlX, mainBlockY, controlX, mainBlockY + mainBlockHeight);

  // -- COLUNA 1: EMITENTE COM LOGO GRANDE (SEM BORDA)
  
  // Logo MUITO GRANDE - dobro do tamanho
  const logoWidth = 200;
  const logoHeight = 120;
  const logoX = margin - 7; // Movido um pouco para direita
  const logoY = mainBlockY - 20 ; // Mais centralizado verticalmente

  // Carregar logo e salvar no cache para reutilizar nas páginas extras
  const carregarLogo = new Promise<void>((resolve, _reject) => {
    if (typeof window === 'undefined') {
      Promise.all([import('fs'), import('path')])
        .then(([fs, path]) => {
          try {
            const logoPath = path.default.join(
              process.cwd(),
              'public',
              'images',
              'MeloLogo.png',
            );
            if (fs.default.existsSync(logoPath)) {
              const logoBuffer = fs.default.readFileSync(logoPath);
              const logoBase64Data = `data:image/png;base64,${logoBuffer.toString('base64')}`;
              logoBase64Cache = logoBase64Data; // Salvar no cache global
              doc.addImage(
                logoBase64Data,
                'PNG',
                logoX,
                logoY,
                logoWidth,
                logoHeight,
              );
              console.log('✅ Logo carregada no servidor e salva no cache');
            }
          } catch (error) {
            console.error('❌ Erro ao carregar logo no servidor:', error);
          }
          resolve();
        })
        .catch(() => resolve());
      return;
    }

    // No cliente - carregar imagem e converter para base64
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/images/MeloLogo.png';
    img.onload = () => {
      // Converter para base64 para cachear
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        logoBase64Cache = canvas.toDataURL('image/png'); // Salvar no cache global
      }
      doc.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
      resolve();
    };
    img.onerror = () => {
      doc.setFontSize(18).setFont('helvetica', 'bold');
      doc.text('MELO', logoX + logoWidth / 2, logoY + logoHeight / 2, { align: 'center' });
      resolve();
    };
  });

  await carregarLogo;

  // Título "Identificação do Emitente" - maior e mais centralizado
  const emitterTextX = logoX + logoWidth - 2; // Mais para direita
  let emitterTextY = mainBlockY + 22; // Mais centralizado verticalmente
  
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text('Identificação do Emitente', emitterTextX, emitterTextY);
  
  // Dados da empresa - fonte maior
  emitterTextY += 14;
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(`${getValue(dadosEmpresa.logradouro)}, No.${getValue(dadosEmpresa.numero)} PC 14 JANEIRO`, emitterTextX, emitterTextY);

  emitterTextY += 10;
  doc.text(`CEP: ${getValue(dadosEmpresa.cep)} ${getValue(dadosEmpresa.municipio)} (${getValue(dadosEmpresa.uf)})`, emitterTextX, emitterTextY);

  emitterTextY += 10;
  const tel = getValue(dadosEmpresa.contato);
  doc.text(`FONE: (${tel.substring(0, 2)})${tel.substring(2)}`, emitterTextX, emitterTextY);

  // -- COLUNA 2: DANFE (DENTRO DO QUADRADO) - Layout compacto
  
  // Título DANFE
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text('DANFE', danfeX + danfeWidth / 2, mainBlockY + 12, { align: 'center' });
  
  // Subtítulo mais compacto
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('DOCUMENTO AUXILIAR DE', danfeX + danfeWidth / 2, mainBlockY + 19, { align: 'center' });
  doc.text('NOTA FISCAL ELETRÔNICA', danfeX + danfeWidth / 2, mainBlockY + 24, { align: 'center' });
  
  // Entrada/Saída e Checkbox na mesma área
  doc.setFontSize(6);
  doc.text('0 - ENTRADA', danfeX + 3, mainBlockY + 32);
  doc.text('1 - SAÍDA', danfeX + 3, mainBlockY + 39);
  
  // Checkbox menor
  const danfeCheckboxX = danfeX + danfeWidth - 18;
  const danfeCheckboxY = mainBlockY + 28;
  doc.rect(danfeCheckboxX, danfeCheckboxY, 14, 14);
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('1', danfeCheckboxX + 4, danfeCheckboxY + 10);
  
  // Nº, SÉRIE, FOLHA - mais compactos
  const nNota = getValue(dadosNFe?.numeroNFe || fatura.nroform || '000');
  const sNota = getValue(dadosNFe?.serieNFe || fatura.serie || '1');
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('Nº', danfeX + 3, mainBlockY + 48);
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(nNota.padStart(9, '0'), danfeX + 12, mainBlockY + 48);
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('SÉRIE', danfeX + 3, mainBlockY + 56);
  doc.text('FOLHA', danfeX + danfeWidth / 2, mainBlockY + 56);
  
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(sNota.padStart(3, '0'), danfeX + 3, mainBlockY + 63);
  doc.text('1/1', danfeX + danfeWidth / 2, mainBlockY + 63);

  // -- COLUNA 3: CONTROLE DO FISCO com código de barras (Modelo cliente)

  // Código de barras
  const chaveDeAcesso =
    dadosNota.chaveAcesso === 'SEM VALIDADE'
      ? gerarChaveDeAcessoPlaceholder(fatura, dadosEmpresa.cgc)
      : dadosNota.chaveAcesso;

  console.log('📊 DEBUG Barcode - Dados:', {
    exibirCodigoBarras: dadosNota.exibirCodigoBarras,
    chaveDeAcesso: chaveDeAcesso,
    chaveLength: chaveDeAcesso?.length,
    windowDefined: typeof window !== 'undefined',
    documentDefined: typeof document !== 'undefined'
  });

  // Área do código de barras (topo da coluna 3)
  const barcodeStartY = mainBlockY + 5;
  const barcodeHeight = 22;
  
  if (dadosNota.exibirCodigoBarras) {
    try {
      let canvas: any;
      
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        console.log('✅ Ambiente browser detectado, criando canvas...');
        canvas = document.createElement('canvas');
      } else if (createCanvas) {
        console.log('✅ Ambiente servidor detectado, usando @napi-rs/canvas...');
        canvas = createCanvas(200, 100);
      } else {
        console.warn('⚠️ Canvas não disponível, usando fallback visual');
        throw new Error('Canvas não disponível');
      }
      
      JsBarcode(canvas, chaveDeAcesso, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 20,
        width: 1.2,
      });

      const barcodeImage = canvas.toDataURL('image/png');
      doc.addImage(
        barcodeImage,
        'PNG',
        controlX + 3,
        barcodeStartY,
        controlWidth - 6,
        barcodeHeight,
      );

      console.log('✅ Código de barras gerado com sucesso');
    } catch (e: any) {
      console.error('❌ Erro ao gerar código de barras:', e);
      // Fallback: simular código de barras
      for (let i = 0; i < 30; i++) {
        const x = controlX + 5 + i * ((controlWidth - 10) / 30);
        doc.setLineWidth(0.6);
        doc.line(x, barcodeStartY + 2, x, barcodeStartY + barcodeHeight - 2);
      }
    }
  }

  // Linha divisória após código de barras
  const barcodeLineY = barcodeStartY + barcodeHeight + 2;
  doc.setLineWidth(0.3);
  doc.line(controlX, barcodeLineY, controlX + controlWidth, barcodeLineY);

  // CHAVE DE ACESSO - formatada em uma única linha como no modelo do cliente
  // Formato: 1326 0104 6183 0280 0189 5580 1001 4160 2917 0376 2305
  const chaveY = barcodeLineY;
  const chaveHeight = 18;
  
  // Linha após chave
  doc.line(controlX, chaveY + chaveHeight, controlX + controlWidth, chaveY + chaveHeight);

  // Label CHAVE DE ACESSO pequeno
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('CHAVE DE ACESSO', controlX + 2, chaveY + 5);

  // Chave formatada com espaços a cada 4 dígitos
  const chaveFormatada = chaveDeAcesso === 'SEM VALIDADE' 
    ? chaveDeAcesso 
    : chaveDeAcesso.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
    
  doc.setFontSize(5).setFont('helvetica', 'bold');
  doc.text(chaveFormatada, controlX + controlWidth / 2, chaveY + 12, { align: 'center' });

  // Área de consulta e site (mensagem informativa)
  const consultaY = chaveY + chaveHeight;
  const consultaHeight = 12;
  doc.line(controlX, consultaY + consultaHeight, controlX + controlWidth, consultaY + consultaHeight);
  
  doc.setFontSize(4).setFont('helvetica', 'normal');
  doc.text('Consulta de autenticidade no portal nacional da NF-e', controlX + 2, consultaY + 4);
  doc.text('www.nfe.fazenda.gov.br/portal ou no Site da Sefaz Autorizadora', controlX + 2, consultaY + 8);

  // PROTOCOLO DE AUTORIZAÇÃO DE USO
  const protocoloY = consultaY + consultaHeight;
  const protocoloHeight = mainBlockHeight - (protocoloY - mainBlockY);
  
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('PROTOCOLO DE AUTORIZAÇÃO DE USO', controlX + 2, protocoloY + 5);
  
  // Protocolo com data/hora conforme modelo do cliente
  const protocoloTexto = getValue(dadosNota.protocolo);
  doc.setFontSize(6).setFont('helvetica', 'bold');
  doc.text(protocoloTexto, controlX + controlWidth / 2, protocoloY + protocoloHeight / 2 + 2, {
    align: 'center',
  });

  y = mainBlockY + mainBlockHeight + 10;
  //   drawField(
  //     'CHAVE DE ACESSO',
  //     chaveDeAcesso.replace(/(\d{4})/g, '$1 ').trim(),
  //     controlX,
  //     mainBlockY + 33,
  //     controlWidth,
  //     45,
  //     'center',
  //     8,
  //   );
  //   drawField(
  //     'PROTOCOLO DE AUTORIZAÇÃO DE USO',
  //     '113242972598445',
  //     controlX,
  //     mainBlockY + 78,
  //     controlWidth,
  //     20,
  //     'center',
  //     10,
  //   );
  //   y = mainBlockY + mainBlockHeight + 5;

  // 3. NATUREZA E INSCRIÇÕES
  const natBlockY = y;
  doc.setLineWidth(1.5).rect(margin, natBlockY, contentWidth, 50);
  doc.setLineWidth(0.5);
  doc.line(margin + 275, natBlockY, margin + 275, natBlockY + 50);
  doc.line(margin, natBlockY + 25, margin + contentWidth, natBlockY + 25);
  drawField(
    'NATUREZA DA OPERAÇÃO',
    getValue(fatura.natureza, 'Venda Dentro do Estado'),
    margin,
    natBlockY,
    275,
    25,
  );
  drawField(
    'INSCRIÇÃO ESTADUAL DO SUBST. TRIB.',
    getValue(dadosEmpresa.iest_subst),
    margin + 275,
    natBlockY,
    contentWidth - 275,
    25,
  );
  drawField(
    'INSCRIÇÃO ESTADUAL',
    getValue(dadosEmpresa.inscricaoestadual),
    margin,
    natBlockY + 25,
    275,
    25,
  );
  drawField(
    'CNPJ',
    getValue(dadosEmpresa.cgc),
    margin + 275,
    natBlockY + 25,
    contentWidth - 275,
    25,
  );
  y = natBlockY + 60;

  // 4. DESTINATÁRIO/REMETENTE (com título mais destacado)
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('DESTINATÁRIO/REMETENTE', margin, y);
  y += 8;

  // Primeira linha
  let currentX = margin;
  let fieldWidth = 320;
  drawField(
    'NOME/RAZÃO SOCIAL',
    getValue(fatura.nomefant),
    currentX,
    y,
    fieldWidth,
    15,
  );
  currentX += fieldWidth;
  fieldWidth = 140;
  drawField('CNPJ/CPF', getValue(fatura.cpfcgc), currentX, y, fieldWidth, 15);
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  // Formatar data de emissão (usar data da fatura ou data atual)
  const dataEmissao = fatura.data ? formatDate(fatura.data) : formatDate(new Date().toISOString());
  drawField(
    'DATA DE EMISSÃO',
    dataEmissao,
    currentX,
    y,
    fieldWidth,
    15,
    'center',
  );

  y += 17;

  // Segunda linha
  currentX = margin;
  fieldWidth = 320;
  drawField(
    'ENDEREÇO',
    `${getValue(fatura.ender)}, ${getValue(fatura.numero, 'S/N')}`,
    currentX,
    y,
    fieldWidth,
    15,
  );
  currentX += fieldWidth;
  fieldWidth = 140;
  drawField(
    'BAIRRO/DISTRITO',
    getValue(fatura.bairro),
    currentX,
    y,
    fieldWidth,
    15,
  );
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  drawField('CEP', getValue(fatura.cep), currentX, y, fieldWidth, 15, 'center');

  y += 17;

  // Terceira linha
  currentX = margin;
  fieldWidth = 180;
  drawField('MUNICÍPIO', getValue(fatura.cidade), currentX, y, fieldWidth, 15);
  currentX += fieldWidth;
  fieldWidth = 100;
  drawField('FONE/FAX', getValue((fatura as any).contato || fatura.fone), currentX, y, fieldWidth, 15);
  currentX += fieldWidth;
  fieldWidth = 35;
  drawField('UF', getValue(fatura.uf), currentX, y, fieldWidth, 15, 'center');
  currentX += fieldWidth;
  fieldWidth = 145;
  drawField(
    'INSCRIÇÃO ESTADUAL',
    getValue(fatura.iest),
    currentX,
    y,
    fieldWidth,
    15,
  );
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  // Formatar data/hora de saída (usar data da fatura ou data atual)
  const dataHoraSaida = (() => {
    const dataBase = fatura.data ? new Date(fatura.data) : new Date();
    const dia = String(dataBase.getDate()).padStart(2, '0');
    const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
    const ano = dataBase.getFullYear();
    const hora = String(dataBase.getHours()).padStart(2, '0');
    const minuto = String(dataBase.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  })();
  drawField('DATA DE ENTR./SAÍDA', dataHoraSaida, currentX, y, fieldWidth, 15);

  y += 25; // Aumentado para dar mais espaço

  // 5. CÁLCULO DO IMPOSTO (NOVA LEI - IBS/CBS + ICMS/IPI)
  doc.setFontSize(7.45).setFont('helvetica', 'bold');
  doc.text('CÁLCULO DO IMPOSTO', margin, y);
  y += 4;

  const impostoY = y;
  const impostoH = 18; // Reduzido de 25 para 18
  // Expandindo para 3 linhas conforme solicitado (restaurando IBS/CBS)
  // Linha 1: 6 colunas (ICMS, ST, IPI, Prod)
  // Linha 2: 6 colunas (Aliq IBS, Val IBS, Aliq CBS, Val CBS, IBS Est, IBS Mun)
  // Linha 3: 7 colunas (Frete, Seg, Desc, Desp, PIS, COFINS, Total)
  const impostoBlockH = impostoH * 3;

  doc.setLineWidth(0.5);
  doc.rect(margin, impostoY, contentWidth, impostoBlockH);

  // Linha 1 (6 colunas)
  const colW1 = contentWidth / 6;
  drawField('BASE DE CÁLC. DO ICMS', formatValue(fatura.baseicms || 0), margin, impostoY, colW1, impostoH, 'right');
  drawField('VALOR DO ICMS', formatValue(fatura.valor_icms || 0), margin + colW1, impostoY, colW1, impostoH, 'right');
  drawField('BASE CÁLC. ST', formatValue(fatura.baseicms_subst || 0), margin + colW1 * 2, impostoY, colW1, impostoH, 'right');
  drawField('VALOR ICMS ST', formatValue(fatura.valor_icms_st || 0), margin + colW1 * 3, impostoY, colW1, impostoH, 'right');
  drawField('VALOR IPI', formatValue(fatura.valor_ipi), margin + colW1 * 4, impostoY, colW1, impostoH, 'right');
  drawField('VLR. TOTAL PRODUTOS', formatValue(fatura.totalprod), margin + colW1 * 5, impostoY, colW1, impostoH, 'right');

  // Linha 2 (6 colunas - IBS/CBS)
  const linha2Y = impostoY + impostoH;
  // Assumindo que dadosNota ou fatura tenham esses campos. Se não tiverem, usar valores padrão ou placeholders.
  // Baseado na imagem anterior: Aliquota IBS, Valor IBS, Aliquota CBS, Valor CBS, IBS Estadual, IBS Municipal
  drawField('ALÍQUOTA IBS (%)', formatPercent((fatura as any).aliquota_ibs || 0), margin, linha2Y, colW1, impostoH, 'right');
  drawField('VALOR IBS', formatValue((fatura as any).valor_ibs || 0), margin + colW1, linha2Y, colW1, impostoH, 'right');
  drawField('ALÍQUOTA CBS (%)', formatPercent((fatura as any).aliquota_cbs || 0), margin + colW1 * 2, linha2Y, colW1, impostoH, 'right');
  drawField('VALOR CBS', formatValue((fatura as any).valor_cbs || 0), margin + colW1 * 3, linha2Y, colW1, impostoH, 'right');
  drawField('IBS ESTADUAL', formatValue((fatura as any).ibs_estadual || 0), margin + colW1 * 4, linha2Y, colW1, impostoH, 'right');
  drawField('IBS MUNICIPAL', formatValue((fatura as any).ibs_municipal || 0), margin + colW1 * 5, linha2Y, colW1, impostoH, 'right');

  // Linha 3 (7 colunas)
  const linha3Y = impostoY + impostoH * 2;
  const colW2 = contentWidth / 7;

  // Calcular valor total da nota
  const valorTotalCalculado =
    parseFloat(String(fatura.totalprod || 0)) +
    parseFloat(String(fatura.valor_icms || 0)) +
    parseFloat(String((fatura as any).valor_ipi || 0)) +
    parseFloat(String(fatura.vlrfrete || 0)) +
    parseFloat(String(fatura.vlrseg || 0)) +
    parseFloat(String(fatura.vlrdesp || 0)) -
    parseFloat(String(fatura.desconto || fatura.vlrdesc || 0));
  const valorTotalNota = valorTotalCalculado > 0 ? valorTotalCalculado : parseFloat(String(fatura.totalnf || 0));

  drawField('VALOR DO FRETE', formatValue(fatura.vlrfrete || 0), margin, linha3Y, colW2, impostoH, 'right');
  drawField('VALOR DO SEGURO', formatValue(fatura.vlrseg || 0), margin + colW2, linha3Y, colW2, impostoH, 'right');
  drawField('DESCONTO', formatValue(fatura.desconto || fatura.vlrdesc || 0), margin + colW2 * 2, linha3Y, colW2, impostoH, 'right');
  drawField('OUTRAS DESP. ACESS.', formatValue(fatura.vlrdesp), margin + colW2 * 3, linha3Y, colW2, impostoH, 'right');
  drawField('VALOR TOTAL PIS', formatValue(fatura.valor_pis || 0), margin + colW2 * 4, linha3Y, colW2, impostoH, 'right');
  drawField('VALOR TOTAL COFINS', formatValue(fatura.valor_cofins || 0), margin + colW2 * 5, linha3Y, colW2, impostoH, 'right');

  // Total da Nota destacado
  doc.setFillColor(230, 230, 230); 
  doc.rect(margin + colW2 * 6, linha3Y, colW2, impostoH, 'F');
  doc.rect(margin + colW2 * 6, linha3Y, colW2, impostoH); 
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('VALOR TOTAL DA NOTA', margin + colW2 * 6 + 3, linha3Y + 7);
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text(formatValue(valorTotalNota), margin + colW2 * 7 - 3, linha3Y + 16, { align: 'right' });
  
  // Atualizar Y para o próximo bloco (Transportador)
  y = impostoY + impostoBlockH + 10;

  // 6. TRANSPORTADOR/VOLUMES TRANSPORTADOS
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('TRANSPORTADOR/VOLUMES TRANSPORTADOS', margin, y);
  y += 12;

  const transpY = y;
  const transpRow1H = 24; // Reduzido de 32
  const transpRow2H = 16; // Reduzido de 22
  const transpRow3H = 16; // Reduzido de 22
  const transpBlockH = transpRow1H + transpRow2H + transpRow3H;

  doc.setLineWidth(0.5);
  doc.rect(margin, transpY, contentWidth, transpBlockH);

  // Primeira linha do transportador
  drawField(
    'RAZÃO SOCIAL',
    getValue(venda.transp),
    margin,
    transpY,
    240,
    transpRow1H,
  );

  // Campo Frete por Conta
  const freteX = margin + 240;
  const freteWidth = 100;
  doc.rect(freteX, transpY, freteWidth, transpRow1H);
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('FRETE POR CONTA', freteX + 3, transpY + 6);
  doc.setFontSize(6);
  doc.text('0-Emitente', freteX + 3, transpY + 14);
  doc.text('1-Destinatário', freteX + 3, transpY + 22);
  doc.text('2-Terceiros', freteX + 3, transpY + 30); // Fica bem no limite

  // Checkbox ligeiramente menor e reposicionado
  const checkboxX = freteX + 70;
  const checkboxY = transpY + 10;
  doc.setLineWidth(1);
  doc.rect(checkboxX, checkboxY, 14, 14);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(getValue(fatura.destfrete, '1'), checkboxX + 7, checkboxY + 10, {
    align: 'center',
  });

  currentX = freteX + freteWidth;
  drawField('CÓDIGO ANTT', '', currentX, transpY, 70, transpRow1H);
  currentX += 70;
  drawField('PLACA', '', currentX, transpY, 50, transpRow1H, 'center');
  currentX += 50;
  drawField('UF', '', currentX, transpY, 30, transpRow1H, 'center');
  currentX += 30;
  drawField(
    'CNPJ/CPF',
    '',
    currentX,
    transpY,
    contentWidth - currentX + margin,
    transpRow1H,
  );

  // Segunda linha do transportador
  const transpY2 = transpY + transpRow1H;
  drawField('ENDEREÇO', '', margin, transpY2, 300, transpRow2H);
  currentX = margin + 300;
  drawField('MUNICÍPIO', '', currentX, transpY2, 130, transpRow2H);
  currentX += 130;
  drawField('UF', '', currentX, transpY2, 30, transpRow2H, 'center');
  currentX += 30;
  drawField(
    'INSC. ESTADUAL',
    '',
    currentX,
    transpY2,
    contentWidth - currentX + margin,
    transpRow2H,
  );

  // Terceira linha do transportador
  const transpY3 = transpY2 + transpRow2H;
  const volFieldWidth = contentWidth / 6;
  drawField(
    'QUANTIDADE',
    '',
    margin,
    transpY3,
    volFieldWidth,
    transpRow3H,
    'right',
  );
  drawField(
    'ESPÉCIE',
    '',
    margin + volFieldWidth,
    transpY3,
    volFieldWidth,
    transpRow3H,
  );
  drawField(
    'MARCA',
    '',
    margin + 2 * volFieldWidth,
    transpY3,
    volFieldWidth,
    transpRow3H,
  );
  drawField(
    'NUMERAÇÃO',
    '',
    margin + 3 * volFieldWidth,
    transpY3,
    volFieldWidth,
    transpRow3H,
    'right',
  );
  drawField(
    'PESO BRUTO',
    '',
    margin + 4 * volFieldWidth,
    transpY3,
    volFieldWidth,
    transpRow3H,
    'right',
  );
  drawField(
    'PESO LÍQUIDO',
    '',
    margin + 5 * volFieldWidth,
    transpY3,
    volFieldWidth,
    transpRow3H,
    'right',
  );

  y = transpY3 + transpRow3H + 10; // Reduzido de 20 para 10 para subir seção de produtos

  // 7. DADOS DOS PRODUTOS

  if (y > pageHeight - 5) { // 0.5mm solicitado (aprox 1.5pt) - usando 5pt por segurança mínima
    doc.addPage();
    y = 140; 
  }

  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('DADOS DO PRODUTO/SERVIÇO', margin, y);
  y += 1;

  // VERIFICAÇÃO URGENTE - Garantir que sempre há produtos
  let produtosParaExibir;

  // console.log('🔍 Analisando produtos recebidos:', {
  //   produtos_original: produtos,
  //   eh_array: Array.isArray(produtos),
  //   length: produtos?.length,
  //   tipo: typeof produtos
  // });

  if (produtos && Array.isArray(produtos) && produtos.length > 0) {
    console.log('✅ PRODUTOS REAIS ENCONTRADOS:', produtos.length);
    
    // Verificar se há duplicatas baseado em codprod + nritem + qtd + prunit
    const produtosUnicos = new Map();
    produtos.forEach((p, index) => {
      const chaveUnica = `${p.codprod}-${(p as any).nritem || index}-${p.qtd}-${p.prunit}`;
      if (!produtosUnicos.has(chaveUnica)) {
        produtosUnicos.set(chaveUnica, p);
      } else {
        // console.log('⚠️ PRODUTO DUPLICADO DETECTADO E REMOVIDO:', {
        //   codprod: p.codprod,
        //   nritem: (p as any).nritem,
        //   qtd: p.qtd,
        //   prunit: p.prunit,
        //   chave: chaveUnica
        // });
      }
    });
    
    produtosParaExibir = Array.from(produtosUnicos.values());
    
    if (produtosParaExibir.length !== produtos.length) {
      console.log(`🔧 DEDUPLICAÇÃO: ${produtos.length} produtos → ${produtosParaExibir.length} produtos únicos`);
    }
  } else {
    console.log('⚠️ NENHUM PRODUTO REAL - Usando produto de exemplo');
    produtosParaExibir = [
      {
        codprod: 'EXEMPLO001',
        descr: 'PRODUTO DE EXEMPLO PARA PREVIEW',
        ncm: '12345678',
        cst: '0102',
        unimed: 'UN',
        qtd: 1,
        prunit: 100.0,
        total_item: 100.0,
        baseicms: 100.0,
        totalicms: 18.0,
        totalipi: 0.0,
        icms: 18.0,
        ipi: 0.0,
        dbprod: {
          codprod: 'EXEMPLO001',
          descr: 'PRODUTO DE EXEMPLO PARA PREVIEW',
          unimed: 'UN',
        },
      },
    ];
  }

  const startPage = doc.getNumberOfPages();

  autoTable(doc, {
    startY: y,
    margin: {
      left: margin,
      right: margin,
      top: 130, // Margem superior ajustada para Landscape
      bottom: 5, // Margem inferior mínima para aproveitar espaço
    },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 6, // Fonte menor
      cellPadding: 1, // Padding mínimo
      lineWidth: 0.3, // Linhas mais finas
      lineColor: 0,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 40 }, // CÓD - menor
      1: { halign: 'left' }, // DESCRIÇÃO - alinhado à esquerda
      2: { cellWidth: 30 }, // NCM
      3: { cellWidth: 18 }, // CST
      4: { cellWidth: 18 }, // CFOP
      5: { cellWidth: 15 }, // UN
      6: { cellWidth: 20 }, // QTD
      7: { cellWidth: 28 }, // V.UNIT
      8: { cellWidth: 28 }, // V.TOTAL
      9: { cellWidth: 18 }, // %IBS
      10: { cellWidth: 18 }, // %CBS
      11: { cellWidth: 22 }, // V.IBS
      12: { cellWidth: 22 }, // V.CBS
      13: { cellWidth: 26 }, // BC.ICMS
      14: { cellWidth: 22 }, // V.ICMS
      15: { cellWidth: 20 }, // %ICMS
      16: { cellWidth: 26 }, // BC.IPI
      17: { cellWidth: 22 }, // V.IPI
      18: { cellWidth: 18 }, // %IPI
    },
    headStyles: {
      halign: 'center',
      fillColor: [255, 255, 255],
      textColor: 0,
      fontSize: 5, // Fonte do cabeçalho menor
      fontStyle: 'bold',
      cellPadding: 1,
    },
    bodyStyles: {
      cellPadding: 1,
      minCellHeight: 6, // Altura mínima das células
    },
    showHead: 'everyPage', // Mostrar cabeçalho da tabela em todas as páginas
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    willDrawPage: (data) => {
      console.log('📋 AutoTable iniciando na página:', data.pageNumber);
    },
    body: produtosParaExibir.map((p, index) => {
      // Múltiplas fontes para descrição do produto
      const descricao =
        p.descr ||
        (p as any).dbprod?.descr ||
        (p as any).descricao ||
        (p as any).description ||
        `PRODUTO ${p.codprod}`;

      // Garantir que todos os valores estão definidos - NOVA LEI TRIBUTÁRIA
      const valorTotalItem = parseFloat(p.total_item || (p as any).totalproduto || 0);
      
      // Alíquotas em percentual
      const aliqIBS = parseFloat((p as any).aliquota_ibs || (p as any).aliq_ibs || 0.1);
      const aliqCBS = parseFloat((p as any).aliquota_cbs || (p as any).aliq_cbs || 0.9);
      
      // Calcular valores de IBS e CBS (alíquota × valor do produto / 100)
      const valorIBS = (aliqIBS / 100) * valorTotalItem;
      const valorCBS = (aliqCBS / 100) * valorTotalItem;
      
      const produtoFormatado = [
        // Formatar código do produto com zeros à esquerda (9 dígitos) se for numérico
        (() => {
          const rawCod = String(p.codprod || '');
          const isNumeric = /^\d+$/.test(rawCod);
          return isNumeric ? rawCod.padStart(9, '0') : (rawCod || 'SEM_CODIGO');
        })(),
        getValue(descricao),
        getValue(p.ncm || 'N/A'),
        // CST (Origem + CST)
        (() => {
          const origem = String(p.origem || (p as any).origemcom || '0');
          const cst = String(p.cst || (p as any).csticms || '00');
          return `${origem}${cst}`;
        })(),
        getValue(fatura?.cfop2 || '5405'),
        getValue(p.unimed || (p as any).dbprod?.unimed || 'UN'),
        formatValue(p.qtd || 0),
        formatValue(p.prunit || 0),
        formatValue(valorTotalItem),
        formatPercent(aliqIBS), // Alíquota IBS (%)
        formatPercent(aliqCBS), // Alíquota CBS (%)
        formatValue(valorIBS),  // Valor IBS calculado
        formatValue(valorCBS),  // Valor CBS calculado
        formatValue((p as any).baseicms || 0),
        formatValue((p as any).totalicms || 0),
        // Preferir aliquota direta se fornecida, senão calcular por base/valor pelo
        formatPercent(
          (p as any).aliquota_icms ?? (p as any).aliquotaICMS ?? (
            (p as any).baseicms && (p as any).baseicms > 0 
              ? ((p as any).totalicms || 0) / (p as any).baseicms * 100 
              : 0
          )
        ),
        formatValue((p as any).baseipi || 0),
        formatValue((p as any).totalipi || 0),
        // Preferir aliquota direta se fornecida, senão calcular por base/valor
        formatPercent(
          (p as any).aliquota_ipi ?? (p as any).aliquotaIPI ?? (
            (p as any).baseipi && (p as any).baseipi > 0 
              ? ((p as any).totalipi || 0) / (p as any).baseipi * 100 
              : 0
          )
        ),
      ];

      // if (index === 0) {
      //   console.log('📊 Produto formatado para tabela:', produtoFormatado);
      // }

      return produtoFormatado;
    }),
    head: [
      [
        'CÓD',
        'DESCRIÇÃO PRODUTO/SERVIÇO',
        'NCM',
        'CST',
        'CFOP',
        'UN',
        'QTD',
        'V.UNIT',
        'V.TOTAL',
        '%IBS',
        '%CBS',
        'V.IBS',
        'V.CBS',
        'BC.ICMS',
        'V.ICMS',
        '%ICMS',
        'BC.IPI',
        'V.IPI',
        '%IPI',
      ],
    ],
    didDrawPage: (data) => {
      // INCLUSÃO: Desenhar o Canhoto Vertical em todas as páginas
      desenharCanhotoVertical();

      // Para páginas subsequentes, desenhar o cabeçalho completo da DANFE
      if (data.pageNumber && data.pageNumber > 1) {
        // Desenhar o cabeçalho completo na página adicional
        const novaY = desenharCabecalhoCompleto(
          doc,
          dadosEmpresa,
          fatura,
          dadosNota,
          data.pageNumber,
        );

        // Adicionar título da seção de produtos com mais espaçamento APENAS se for uma continuação real
        // (ou seja, se a tabela começou numa página anterior)
        if (data.pageNumber > startPage) {
          doc.setFontSize(8).setFont('helvetica', 'bold');
          doc.text('DADOS DO PRODUTO/SERVIÇO (Continuação)', margin, Number(novaY || 135) + 15);
        }
      }

      // Atualizar posição Y para continuar renderização
      y = Number(data.cursor?.y || y);
    },
  });

  y += 10;

  // 8. CÁLCULO DO ISSQN - COMENTADO
  // // Verificar se cabe na página, senão pular (Evita corte)
  // if (y > pageHeight - 20) {
  //    doc.addPage();
  //    y = margin  -39; // Margem simples na nova página
  // }

  // doc.setFontSize(8).setFont('helvetica', 'bold');
  // doc.text('CÁLCULO DO ISSQN', margin, y);
  // y += 1;

  // const issqnY = y;
  // const issqnFieldWidth = contentWidth / 4;
  // doc.setLineWidth(0.5);
  // doc.rect(margin, issqnY, contentWidth, 25);

  // drawField(
  //   'INSCRIÇÃO MUNICIPAL',
  //   getValue(dadosEmpresa.inscricaomunicipal),
  //   margin,
  //   issqnY,
  //   issqnFieldWidth,
  //   25,
  // );
  // drawField(
  //   'VALOR TOTAL DOS SERVIÇOS',
  //   '0,00',
  //   margin + issqnFieldWidth,
  //   issqnY,
  //   issqnFieldWidth,
  //   25,
  //   'right',
  // );
  // drawField(
  //   'BASE DE CÁLCULO DO ISSQN',
  //   '0,00',
  //   margin + 2 * issqnFieldWidth,
  //   issqnY,
  //   issqnFieldWidth,
  //   25,
  //   'right',
  // );
  // drawField(
  //   'VALOR DO ISSQN',
  //   '0,00',
  //   margin + 3 * issqnFieldWidth,
  //   issqnY,
  //   issqnFieldWidth,
  //   25,
  //   'right',
  // );

  // y = issqnY + 30; // Gap reduzido de 40 para 30

  // 9. DADOS ADICIONAIS (altura compactada de 100 para 75)
  const dadosAdicionaisHeight = 75; 
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, dadosAdicionaisHeight);
  const infoComplWidth = contentWidth * 0.65;
  doc.line(margin + infoComplWidth, y, margin + infoComplWidth, y + dadosAdicionaisHeight);

  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text('DADOS ADICIONAIS', margin + 3, y + 10);
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('INFORMAÇÕES COMPLEMENTARES', margin + 3, y + 20);

  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text('RESERVA AO FISCO', margin + infoComplWidth + 3, y + 10);

  doc.setFontSize(5).setFont('helvetica', 'normal'); // Fonte reduzida para 5
  
  // 🆕 Observação obrigatória IBS/CBS (Lei Complementar nº 214/2025))
  const aliquotaIBS = formatPercent(fatura.aliquota_ibs || 0.1);
  const aliquotaCBS = formatPercent(fatura.aliquota_cbs || 0.9);
  const valorIBS = formatValue(fatura.valor_ibs || 0);
  const valorCBS = formatValue(fatura.valor_cbs || 0);
  
  const obsIBSCBS = `VALORES REFERENTES AO IBS (${aliquotaIBS}%) E CBS (${aliquotaCBS}%) CALCULADOS PARA FINS DE TRANSIÇÃO E APRENDIZADO, CONFORME LEI COMPLEMENTAR Nº 214/2025. ESTES VALORES NÃO COMPÕEM O TOTAL DA OPERAÇÃO NESTE PERÍODO. VALOR IBS: R$ ${valorIBS} | VALOR CBS: R$ ${valorCBS}`;
  
  const infoText = `Venda: ${getValue(venda.nrovenda)} | Vendedor: ${getValue(
    fatura.nomevendedor,
  )} | Obs: ${getValue(
    venda.obs,
  )}\nDOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.\nNÃO GERA DIREITO A CRÉDITO FISCAL DE ICMS, ISS E IPI.\n\n${obsIBSCBS}`;
  const infoLines = doc.splitTextToSize(infoText, infoComplWidth - 6);
  doc.text(infoLines, margin + 3, y + 30);
  
  // Texto de consulta abaixo do retângulo (mais próximo)
  doc.setFontSize(6).setFont('helvetica', 'bold');
  doc.text(
    'Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizada.',
    margin + 3,
    y + dadosAdicionaisHeight  - 2, // Gap reduzido para 8
  );

  // Texto diagonal "SEM VALIDADE" no meio do documento (apenas para preview)
  if (dadosNota.textoMarcaDagua) {
    const pageHeight = doc.internal.pageSize.getHeight();
    // Usar propriedade interna para obter número de páginas
    const totalPages = (doc as any).internal.getNumberOfPages();

    // Aplicar marca d'água em todas as páginas
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      doc.setPage(pageNum);

      // Configurar posição mais centralizada
      const centerX = pageWidth / 1.5;
      const centerY = pageHeight / 3;

      // Usar transparência com graphics state (versão compatível)
      const [r, g, b] = dadosNota.corMarca;

      console.log("🔍 Aplicando marca d'água:", {
        texto: dadosNota.textoMarcaDagua,
        opacidade: dadosNota.opacidadeMarca,
        cor: [r, g, b],
        pagina: pageNum,
      });

      // Implementar transparência real usando Graphics State do jsPDF
      const opacity = dadosNota.opacidadeMarca;

      try {
        // Salvar estado atual
        (doc as any).saveGraphicsState();

        // Definir transparência usando o método correto do jsPDF
        (doc as any).setGState(new (doc as any).GState({ opacity: opacity }));

        // Definir cor
        doc.setTextColor(r, g, b);

        console.log('✅ Transparência aplicada com sucesso:', {
          opacity: opacity,
          cor: [r, g, b],
        });
      } catch (e) {
        console.warn(
          '⚠️ Método GState não disponível, usando transparência alternativa:',
          e,
        );

        // Fallback: usar transparência via fillOpacity no contexto interno
        try {
          const ctx = (doc as any).internal;
          if (ctx && ctx.write) {
            // Adicionar estado gráfico com transparência diretamente
            ctx.write(`/GS1 gs`);
            ctx.write(`/GS1 << /Type /ExtGState /ca ${opacity} >> def`);
          }
          doc.setTextColor(r, g, b);
        } catch (e2) {
          console.warn('⚠️ Fallback falhou, usando opacidade simulada:', e2);
          // Último recurso: mistura de cores
          const opaqueR = Math.round(r * opacity + 255 * (1 - opacity));
          const opaqueG = Math.round(g * opacity + 255 * (1 - opacity));
          const opaqueB = Math.round(b * opacity + 255 * (1 - opacity));
          doc.setTextColor(opaqueR, opaqueG, opaqueB);
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(80);

      // Desenhar texto rotacionado usando a API pública do jsPDF
      doc.text(dadosNota.textoMarcaDagua, centerX, centerY, {
        align: 'center',
        angle: -45, // Rotação de -45 graus
      });

      // Restaurar estado gráfico (remove transparência)
      try {
        (doc as any).restoreGraphicsState();
        console.log('✅ Estado gráfico restaurado');
      } catch (e) {
        console.warn('⚠️ Erro ao restaurar estado gráfico:', e);
        // Reset manual da cor
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  // Verificar se doc tem o método output
  console.log('🔍 Verificando objeto doc antes de retornar:', {
    tipo: typeof doc,
    tem_output: typeof doc?.output === 'function',
    tem_save: typeof doc?.save === 'function',
    keys: Object.keys(doc || {}).slice(0, 10)
  });

  return doc;
};

// Função específica para gerar nota fiscal válida
export const gerarNotaFiscalValida = async (
  fatura: Fatura,
  produtos: Produto[],
  venda: Venda,
  dadosEmpresa: DadosEmpresa,
  dadosNFe: DadosNFe,
): Promise<jsPDF> => {
  return gerarPreviewNF(
    fatura,
    produtos,
    venda,
    dadosEmpresa,
    'valida',
    dadosNFe,
  );
};

// Função específica para gerar preview/rascunho (mantém compatibilidade)
export const gerarRascunhoNF = async (
  fatura: Fatura,
  produtos: Produto[],
  venda: Venda,
  dadosEmpresa: DadosEmpresa,
): Promise<jsPDF> => {
  return gerarPreviewNF(fatura, produtos, venda, dadosEmpresa, 'preview');
};
