import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { gerarChaveDeAcessoPlaceholder } from './gerarcahveAcesso';

// =================================================================================
// 0. FUNÇÃO AUXILIAR PARA CABEÇALHO COMPLETO
// =================================================================================

// Função para desenhar o cabeçalho completo do CUPOM FISCAL (NFC-e)
function desenharCabecalhoCompletoCupom(
  doc: jsPDF,
  dadosEmpresa: any,
  fatura: any,
  dadosNota: any,
  pageNumber: number = 1,
  qrCodeDataUrl?: string, // QR Code pré-gerado
  logoImage?: HTMLImageElement | string | null, // Logo pré-carregada
) {
  const pageWidth = doc.internal.pageSize.width;

  // Margens ajustadas para Canhoto Vertical (55 largura + 10 gap + 10 margem original = 75)
  const marginLeft = 75; 
  const marginRight = 10;
  // contentWidth agora considera o espaço do canhoto
  const contentWidth = pageWidth - marginLeft - marginRight;
  const margin = marginLeft; 

  // Função auxiliar getValue
  const getValue = (value: any, defaultValue = '') => {
    return value !== null && value !== undefined && value !== ''
      ? String(value)
      : String(defaultValue);
  };

  // REMOVIDO: Blocos de recebimento horizontal (agora será vertical na lateral)
  let currentY = 20; // Margem superior fixa

  // Bloco principal do cabeçalho - MESMO PADRÃO DO DANFE
  const mainBlockY = currentY;
  const mainBlockHeight = 70;
  
  // Layout: Emitente (45% sem borda), NFC-e (20% com borda), Controle (35% com borda)
  const emitterWidth = contentWidth * 0.45;
  const danfeWidth = contentWidth * 0.20;
  const controlWidth = contentWidth - emitterWidth - danfeWidth;
  const danfeX = margin + emitterWidth;
  const controlX = danfeX + danfeWidth;

  // Limpar a área do cabeçalho
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, mainBlockY, contentWidth, mainBlockHeight + 25, 'F');

  // Borda APENAS ao redor de NFC-e e CONTROLE (não inclui emitente)
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(danfeX, mainBlockY, danfeWidth + controlWidth, mainBlockHeight);
  doc.setLineWidth(0.5);
  doc.line(controlX, mainBlockY, controlX, mainBlockY + mainBlockHeight);

  // -- COLUNA 1: EMITENTE COM LOGO GRANDE (SEM BORDA)
  // Logo grande - mesmo tamanho do DANFE
  const logoWidth = 200;
  const logoHeight = 120;
  const logoX = margin - 7;
  const logoY = mainBlockY - 20;

  if (logoImage) {
    try {
      if (typeof logoImage === 'string') {
        doc.addImage(logoImage, 'PNG', logoX, logoY, logoWidth, logoHeight);
        console.log('✅ Logo adicionada ao cabeçalho da página', pageNumber, '(base64)');
      } else {
        doc.addImage(logoImage, 'PNG', logoX, logoY, logoWidth, logoHeight);
        console.log('✅ Logo adicionada ao cabeçalho da página', pageNumber, '(Image)');
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar logo pré-carregada:', error);
      doc.setFontSize(14).setFont('helvetica', 'bold');
      doc.text('MELO', logoX + logoWidth / 2, logoY + logoHeight / 2, { align: 'center' });
    }
  } else {
    console.log('⚠️ Logo não disponível para página', pageNumber);
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

  // -- COLUNA 2: NFC-e (DENTRO DO QUADRADO) - Layout compacto igual DANFE
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text('NFC-e', danfeX + danfeWidth / 2, mainBlockY + 12, { align: 'center' });
  
  doc.setFontSize(5).setFont('helvetica', 'normal');
  doc.text('DOCUMENTO AUXILIAR DA', danfeX + danfeWidth / 2, mainBlockY + 19, { align: 'center' });
  doc.text('NOTA FISCAL DE CONSUMIDOR', danfeX + danfeWidth / 2, mainBlockY + 24, { align: 'center' });
  doc.text('ELETRÔNICA', danfeX + danfeWidth / 2, mainBlockY + 29, { align: 'center' });
  
  doc.setFontSize(6);
  doc.text('0 - ENTRADA', danfeX + 3, mainBlockY + 38);
  doc.text('1 - SAÍDA', danfeX + 3, mainBlockY + 45);
  
  // Checkbox
  const checkboxX = danfeX + danfeWidth - 18;
  const checkboxY = mainBlockY + 34;
  doc.rect(checkboxX, checkboxY, 14, 14);
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('1', checkboxX + 4, checkboxY + 10);
  
  // Nº, SÉRIE, FOLHA
  const nNota = getValue(dadosNota.numeroNFe || fatura?.nroform || '000');
  const sNota = getValue(dadosNota.serieNFe || fatura?.serie || '1');
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('Nº', danfeX + 3, mainBlockY + 54);
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(nNota.padStart(9, '0'), danfeX + 12, mainBlockY + 54);
  
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('SÉRIE', danfeX + 3, mainBlockY + 62);
  doc.text('FOLHA', danfeX + danfeWidth / 2, mainBlockY + 62);
  
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(sNota.padStart(3, '0'), danfeX + 3, mainBlockY + 68);
  doc.text(`${pageNumber}`, danfeX + danfeWidth / 2, mainBlockY + 68);

  // -- COLUNA 3: QR CODE CENTRALIZADO (NFC-e não tem código de barras/chave/protocolo no cabeçalho)
  const chaveAcesso = getValue(dadosNota.chaveAcesso);
  
  // QR Code centralizado na coluna inteira
  const qrCodeSize = 60; // Maior já que é o único elemento
  const qrCodeX = controlX + (controlWidth - qrCodeSize) / 2;
  const qrCodeY = mainBlockY + (mainBlockHeight - qrCodeSize) / 2;
  
  if (qrCodeDataUrl && chaveAcesso && chaveAcesso !== 'SEM VALIDADE') {
    try {
      doc.addImage(qrCodeDataUrl, 'PNG', qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
      console.log('✅ QR Code adicionado ao cabeçalho da página', pageNumber);
    } catch (e) {
      console.error('❌ Erro ao adicionar QR Code:', e);
      doc.setFontSize(10).setFont('helvetica', 'normal');
      doc.text('QR CODE', controlX + controlWidth / 2, mainBlockY + mainBlockHeight / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(10).setFont('helvetica', 'normal');
    doc.text('(SEM QR CODE)', controlX + controlWidth / 2, mainBlockY + mainBlockHeight / 2, { align: 'center' });
  }
  // Segunda linha: Natureza da operação e dados do destinatário
  const secondBlockY = mainBlockY + mainBlockHeight + 5;
  const secondBlockHeight = 30;

  doc.setLineWidth(0.5);
  doc.rect(margin, secondBlockY, contentWidth, secondBlockHeight);
  doc.line(
    margin + contentWidth / 2,
    secondBlockY,
    margin + contentWidth / 2,
    secondBlockY + secondBlockHeight,
  );

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

  // Natureza da operação -> DESTINATÁRIO/REMETENTE
  drawField(
    'DESTINATÁRIO/REMETENTE',
    getValue(fatura.nomefant || fatura.destinatario || ''),
    margin,
    secondBlockY,
    contentWidth / 2,
    secondBlockHeight
  );

  // Dados do protocolo - Protocolo + Data e Hora
  const protocoloTexto = dadosNota.protocolo 
    ? `${dadosNota.protocolo}` 
    : 'AGUARDANDO AUTORIZAÇÃO';
  
  // Formatar data e hora se disponível
  const dataHoraTexto = fatura.dataEmissao || dadosNota.dataEmissao
    ? new Date(fatura.dataEmissao || dadosNota.dataEmissao).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '';
  
  const protocoloCompleto = dataHoraTexto 
    ? `${protocoloTexto} - ${dataHoraTexto}`
    : protocoloTexto;

  drawField(
    'PROTOCOLO DE AUTORIZAÇÃO',
    protocoloCompleto,
    margin + contentWidth / 2,
    secondBlockY,
    contentWidth / 2,
    secondBlockHeight
  );

  return secondBlockY + secondBlockHeight + 10; // Retorna a posição Y onde o conteúdo pode continuar
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
  baseicms_subst?: number;
  vlrfrete?: number;
  vlrseg?: number;
  vlrdesp?: number;
  totalprod?: number;
  valor_pis?: number;
  valor_cofins?: number;
  valor_ipi?: number;
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
      numeroNFe: dadosNFe.numeroNFe || '',
      serieNFe: dadosNFe.serieNFe || '',
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
      numeroNFe: 'SEM NÚMERO',
      serieNFe: 'SEM SÉRIE',
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

export const gerarPreviewCupomFiscal = async (
  fatura: Fatura,
  produtos: Produto[],
  venda: Venda,
  dadosEmpresa: DadosEmpresa,
  tipoNota: TipoNota = 'preview',
  dadosNFe?: DadosNFe,
): Promise<jsPDF> => {
  // Pré-gerar QR Code para NFC-e
  let qrCodeDataUrl: string | undefined;
  
  console.log('🔍 DEBUG QR Code - Iniciando verificações:', {
    temDadosNFe: !!dadosNFe,
    temChaveAcesso: !!dadosNFe?.chaveAcesso,
    chaveAcesso: dadosNFe?.chaveAcesso,
    tipoNota: tipoNota
  });
  
  if (dadosNFe?.chaveAcesso && dadosNFe.chaveAcesso !== 'SEM VALIDADE') {
    try {
      console.log('🎯 Tentando gerar QR Code...');
      const QRCode = await import('qrcode');
      const urlConsulta = `https://www.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe=${dadosNFe.chaveAcesso}`;
      console.log('📱 URL para QR Code:', urlConsulta);
      
      qrCodeDataUrl = await QRCode.default.toDataURL(urlConsulta, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300
      });
      
      console.log('✅ QR Code pré-gerado com sucesso!');
      console.log('📊 Tamanho do dataURL:', qrCodeDataUrl?.length, 'caracteres');
    } catch (e) {
      console.error('❌ Erro ao pré-gerar QR Code:', e);
    }
  } else {
    console.log('⚠️ QR Code NÃO será gerado - condições não atendidas');
  }
  
  // // TESTE URGENTE - Verificar se produtos chegam
  // console.log('🔥 TESTE URGENTE - Status dos produtos:', {
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
    console.error('❌ PROBLEMA: Nenhum produto recebido na função gerarPreviewCupomFiscal!');
    console.error('❌ Fatura recebida:', fatura);
    console.error('❌ Venda recebida:', venda);
  }

  const doc = new jsPDF('landscape', 'pt', 'a4');
  
  // DEFINIÇÃO DE MARGENS ASSIMÉTRICAS PARA CANHOTO VERTICAL (NFC-e)
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  const canhotoWidth = 55; 
  const marginLeft = 10 + canhotoWidth + 10;
  const marginRight = 10;
  const marginTop = 10;
  
  // Margem global ajustada
  const margin = marginLeft; 
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = marginTop;

  // Obter dados baseados no tipo de nota
  const dadosNota = obterDadosNota(tipoNota, dadosNFe);

  // Função auxiliar interna para garantir acesso a variáveis do escopo
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
      
      // Texto agora em duas linhas centralizadas na laterall
      doc.text(txt1, centroX + 32, centerY_Rec, { angle: 90, align: 'center' });
      doc.text(txt2, centroX + 60, centerY_Rec, { angle: 90, align: 'center' });
      
      currentY += hRecebimento;
      
      // === BLOCO 4: NF-e e DADOS ===
      doc.rect(xCanhoto, currentY, wCanhoto, hNFe);
      // Ajuste fino do centro vertical do bloco
      const centerY_Nfe = currentY + hNFe / 1.4 + textYOffset;
      
      doc.setFontSize(10).setFont('helvetica', 'bold');
      // Usar dadosNota ou fallback
      const nNota = getValue(dadosNota.numeroNFe || fatura.numero || fatura.nroform || '000');
      const sNota = getValue(dadosNota.serieNFe || fatura.serie || '1');
      
      const linha1 = `NFC-e Nº ${nNota}`;
      // Evitar "Série SEM SÉRIE" -> Se for "SEM SÉRIE", exibe apenas isso. Se for número, prefixa com "Série"""
      const linha2 = sNota.includes('SEM') ? sNota : `Série ${sNota}`;
      
      doc.setFontSize(6).setFont('helvetica', 'bold');
      // Ajustando espaçamento: Linha 1 (NFC-e Nº) à esquerda, Linha 2 (Série) à direita
      // Ambas precisam estar dentro do bloco (centroX é o ponto médio do canhoto)
      doc.text(linha1, centroX + 15, centerY_Nfe, { angle: 90, align: 'center' });
      
      doc.setFontSize(8).setFont('helvetica', 'normal');
      doc.text(linha2, centroX + 13, centerY_Nfe, { angle: 90, align: 'center' });
      
      // Linha de Corte
      const corteX = marginLeft - 5;
      doc.setLineDashPattern([2, 2], 0);
      doc.line(corteX, 0, corteX, pageHeight);
      doc.setLineDashPattern([], 0); 
  };
  
  // Desenhar canhoto na primeira página
  desenharCanhotoVertical();

  // Pré-carregar logo de forma assíncrona para garantir que aparece no PDF
  let logoImage: HTMLImageElement | string | null = null;
  
  const carregarLogo = new Promise<void>((resolve) => {
    // No servidor (Node.js)
    if (typeof window === 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(process.cwd(), 'public', 'images', 'MeloLogo.png');
        
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          const logoBase64 = logoBuffer.toString('base64');
          logoImage = `data:image/png;base64,${logoBase64}`;
          console.log('✅ Logo pré-carregada no servidor');
        }
      } catch (e) {
        console.log('⚠️ Logo não pôde ser carregada no servidor');
      }
      resolve();
    } else {
      // No cliente (browser) - usar Promise para aguardar
      const img = new Image();
      img.src = '/images/MeloLogo.png';
      
      img.onload = () => {
        logoImage = img;
        console.log('✅ Logo pré-carregada no cliente');
        resolve();
      };
      
      img.onerror = () => {
        console.error('❌ Erro ao carregar logo no cliente');
        resolve();
      };
    }
  });

  // Aguardar carregamento da logo
  await carregarLogo;

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
    let textX = x + 2;
    if (valueAlign === 'center') textX = x + width / 2;
    if (valueAlign === 'right') textX = x + width - 2;

    const valueLines = doc.splitTextToSize(value, width - 4);
    const vAlignOffset = height > 30 ? 10 : height / 2 + 3;
    doc.text(valueLines, textX, yPos + vAlignOffset, textOptions);
  };

  // CORREÇÃO: Priorizar dadosNFe quando é nota válida (emitida)
  const numeroNotaRaw2 = getValue(dadosNFe?.numeroNFe) || 
                     getValue((fatura as any).nrodoc_fiscal) || 
                     getValue(fatura.nroform) || 
                     getValue((fatura as any).nrodoc) || 
                     getValue((fatura as any).numero) || 
                     '0';
  // Formatar número com 9 dígitos (zeros à esquerda) - igual NF-e
  const numeroNota = String(parseInt(numeroNotaRaw2, 10) || 0).padStart(9, '0');
  
  console.log('🔍 Debug número e série da nota:', {
    numeroNotaRaw2,
    numeroNota,
    dadosNFe_numeroNFe: dadosNFe?.numeroNFe,
    dadosNFe_serieNFe: dadosNFe?.serieNFe,
    fatura_nrodoc_fiscal: (fatura as any).nrodoc_fiscal,
    fatura_nroform: fatura.nroform,
    fatura_serie: fatura.serie,
    tipoNota,
    dadosNFe_completo: dadosNFe
  });
  
  // 1. DESENHAR CABEÇALHO COMPLETO (com QR Code para NFC-e)
  console.log('🎨 Desenhando cabeçalho da primeira página com QR Code...');
  y = desenharCabecalhoCompletoCupom(doc, dadosEmpresa, fatura, dadosNota, 1, qrCodeDataUrl, logoImage);
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
  y += 12;

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
  // Formatar data de emissão
  const dataEmissaoFormatada = fatura.data ? formatDate(fatura.data) : formatDate(new Date().toISOString());
  drawField(
    'DATA DE EMISSÃO',
    dataEmissaoFormatada,
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

  y += 20;

  // Quarta linha - Valor Total da Nota (calculado)
  currentX = margin;
  fieldWidth = contentWidth;
  
  // Calcular valor total da nota: produtos + impostos + frete + seguro + despesas - desconto
  
  // Pré-calcular IBS e CBS percorrendo os produtos
  let totalIBSCalculado = 0;
  let totalCBSCalculado = 0;
  if (produtos && Array.isArray(produtos)) {
    produtos.forEach((p) => {
      const valorTotalItem = parseFloat(String(p.total_item || (p as any).totalproduto || 0));
      const aliqIbs = parseFloat(String((p as any).aliquota_ibs || (p as any).aliq_ibs || 0));
      const aliqCbs = parseFloat(String((p as any).aliquota_cbs || (p as any).aliq_cbs || 0));
      
      totalIBSCalculado += (valorTotalItem * aliqIbs) / 100;
      totalCBSCalculado += (valorTotalItem * aliqCbs) / 100;
    });
  }

  const valorTotalCalculado = 
    parseFloat(String((fatura as any).totalprod || 0)) +
    parseFloat(String((fatura as any).valor_icms || 0)) +
    // IPI removido do cálculo para NFC-e (Cupom Fiscal) pois não é permitido/cobrado neste modelo
    // parseFloat(String((fatura as any).valor_ipi || 0)) +
    parseFloat(String((fatura as any).vlrfrete || 0)) +
    parseFloat(String((fatura as any).vlrseg || 0)) +
    parseFloat(String((fatura as any).vlrdesp || 0)) +
    totalIBSCalculado +
    totalCBSCalculado -
    parseFloat(String((fatura as any).desconto || (fatura as any).vlrdesc || 0));
  
  // Usar valor calculado ou fallback para totalnf
  const valorTotalNota = valorTotalCalculado > 0 ? valorTotalCalculado : parseFloat(String(fatura.totalnf || 0));
  
  drawField(
    'VALOR TOTAL DA NOTA',
    formatValue(valorTotalNota),
    currentX,
    y,
    fieldWidth,
    25,
    'right',
    12,
  );

  y += 40;

  // 7. DADOS DOS PRODUTOS
  if (y > 650) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('DADOS DO PRODUTO/SERVIÇO', margin, y);
  y += 5;

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
    produtosParaExibir = produtos;
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
        prunit: 100.00,
        total_item: 100.00,
        baseicms: 100.00,
        totalicms: 18.00,
        totalipi: 0.00,
        icms: 18.00,
        ipi: 0.00,
        dbprod: {
          codprod: 'EXEMPLO001',
          descr: 'PRODUTO DE EXEMPLO PARA PREVIEW',
          unimed: 'UN'
        },
        origem: '0'
      }
    ];
  }

  // console.log('🔍 Produtos finais para exibir na tabela:', {
  //   tipo: produtos && produtos.length > 0 ? 'REAIS' : 'EXEMPLO',
  //   quantidade: produtosParaExibir.length,
  //   produtos_detalhados: produtosParaExibir.map((p, i) => ({
  //     index: i,
  //     codprod: p.codprod,
  //     descr: p.descr || (p as any).dbprod?.descr,
  //     nritem: (p as any).nritem,
  //     qtd: p.qtd,
  //     prunit: p.prunit,
  //     chave_unica: `${p.codprod}-${(p as any).nritem || i}-${p.qtd}-${p.prunit}`
  //   })),
  //   primeiro_produto: {
  //     codprod: produtosParaExibir[0]?.codprod,
  //     descr: produtosParaExibir[0]?.descr || (produtosParaExibir[0] as any)?.dbprod?.descr,
  //     qtd: produtosParaExibir[0]?.qtd,
  //     prunit: produtosParaExibir[0]?.prunit
  //   }
  // });

  autoTable(doc, {
    startY: y,
    margin: { 
      left: marginLeft, 
      right: marginRight,
      top: 130 // Ajustado para layout mais compacto
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
      0: { cellWidth: 40 }, // CÓD
      1: { halign: 'left' }, // DESCRIÇÃO
      2: { cellWidth: 30 }, // NCM
      3: { cellWidth: 18 }, // CST
      4: { cellWidth: 18 }, // CFOP
      5: { cellWidth: 15 }, // UN
      6: { cellWidth: 20 }, // QTD
      7: { cellWidth: 28 }, // V.UNIT
      8: { cellWidth: 28 }, // V.TOTAL
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
      minCellHeight: 6,
    },
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    willDrawPage: (data) => {
      console.log('📋 AutoTable iniciando na página:', data.pageNumber);
    },
    // didParseCell: (data) => {
    //   if (data.row.index === 0) {
    //     console.log('📊 Primeira linha da tabela sendo processada:', {
    //       coluna: data.column.index,
    //       valor: data.cell.text,
    //       secao: data.section
    //     });
    //   }
    // },
    body: produtosParaExibir.map((p, index) => {
      // Múltiplas fontes para descrição do produto
      const descricao = p.descr || 
                       (p as any).dbprod?.descr || 
                       (p as any).descricao || 
                       (p as any).description || 
                       `PRODUTO ${p.codprod}`;
      
      // if (index === 0) {
      //   console.log('🔍 Primeiro produto - debug completo:', {
      //     produto_tipo: produtos && produtos.length > 0 ? 'REAL' : 'EXEMPLO',
      //     descr_original: p.descr,
      //     dbprod_descr: (p as any).dbprod?.descr,
      //     descricao_campo: (p as any).descricao,
      //     description_campo: (p as any).description,
      //     descricao_final: descricao,
      //     valores_basicos: {
      //       codprod: p.codprod,
      //       qtd: p.qtd,
      //       prunit: p.prunit,
      //       total_item: p.total_item || (p as any).totalproduto,
      //       unimed: p.unimed || (p as any).dbprod?.unimed,
      //       ncm: p.ncm,
      //       cst: p.cst
      //     },
      //     impostos_disponiveis: {
      //       baseicms: (p as any).baseicms,
      //       totalicms: (p as any).totalicms,
      //       totalipi: (p as any).totalipi,
      //       icms: (p as any).icms,
      //       ipi: (p as any).ipi
      //     },
      //     dbprod_completo: (p as any).dbprod,
      //     todos_campos: Object.keys(p)
      //   });
      // }
      
      // Calcular valores de impostos
      const valorTotalItem = parseFloat(String(p.total_item || (p as any).totalproduto || 0));
      
      // IBS
      const aliqIbs = parseFloat(String((p as any).aliquota_ibs || (p as any).aliq_ibs || 0));
      const valorIbs = (valorTotalItem * aliqIbs) / 100;
      
      // CBS
      const aliqCbs = parseFloat(String((p as any).aliquota_cbs || (p as any).aliq_cbs || 0));
      const valorCbs = (valorTotalItem * aliqCbs) / 100;
      
      // ICMS (Usar valor já existente se houver, ou calcular pela alíquota)
      const aliqIcms = parseFloat(String((p as any).aliquota_icms || (p as any).aliq_icms || 0)); // Assumindo alíquota zero se não vier nada
      const valorIcms = (p as any).valor_icms && parseFloat((p as any).valor_icms) > 0
        ? parseFloat((p as any).valor_icms) 
        : (valorTotalItem * aliqIcms) / 100;

      // Garantir que todos os valores estão definidos - NOVA LEI TRIBUTÁRIA (igual NF-e)
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
        
        // IBS
        formatPercent(aliqIbs),
        formatValue(valorIbs),
        
        // CBS
        formatPercent(aliqCbs),
        formatValue(valorCbs),
        
        // ICMS
        formatPercent(aliqIcms),
        formatValue(valorIcms),
      ];
      
      // if (index === 0) {
      //   console.log('📊 Produto formatado para tabela:', produtoFormatado);
      // }
      
      return produtoFormatado;
    }),
    head: [
      [
        'CÓD',
        'DESC.',
        'NCM', // Encurtei
        'CST',
        'CFOP',
        'UN',
        'QTD',
        'V.UN', // Encurtei
        'V.TOT', // Encurtei
        '%IBS',
        'V.IBS',
        '%CBS',
        'V.CBS',
        '%ICM',
        'V.ICM',
      ],
    ],
    // Nota: styles e columnStyles já definidos acima, removidas duplicatas
    didDrawPage: (data) => {
      // Desenhar canhoto em todas as páginas
      desenharCanhotoVertical();

      // Para páginas subsequentes, desenhar o cabeçalho completo do Cupom Fiscal
      if (data.pageNumber && data.pageNumber > 1) {
        // Desenhar o cabeçalho completo na página adicional
        const novaY = desenharCabecalhoCompletoCupom(doc, dadosEmpresa, fatura, dadosNota, data.pageNumber, qrCodeDataUrl, logoImage);

        // Adicionar título da seção de produtos com mais espaçamento
        doc.setFontSize(8).setFont('helvetica', 'bold');
        doc.text('DADOS DO PRODUTO/SERVIÇO (Continuação)', margin, novaY + 15);
      }

      // Atualizar posição Y para continuar renderização
      y = Number(data.cursor?.y || y);
    },
  });

  y += 20;

  // 8. CÁLCULO DO ISSQN
  if (y > 700) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('CÁLCULO DO ISSQN', margin, y);
  y += 12;

  const issqnY = y;
  const issqnFieldWidth = contentWidth / 4;
  doc.setLineWidth(0.5);
  doc.rect(margin, issqnY, contentWidth, 25);

  drawField(
    'INSCRIÇÃO MUNICIPAL',
    getValue(dadosEmpresa.inscricaomunicipal),
    margin,
    issqnY,
    issqnFieldWidth,
    25,
  );
  drawField(
    'VALOR TOTAL DOS SERVIÇOS',
    '0,00',
    margin + issqnFieldWidth,
    issqnY,
    issqnFieldWidth,
    25,
    'right',
  );
  drawField(
    'BASE DE CÁLCULO DO ISSQN',
    '0,00',
    margin + 2 * issqnFieldWidth,
    issqnY,
    issqnFieldWidth,
    25,
    'right',
  );
  drawField(
    'VALOR DO ISSQN',
    '0,00',
    margin + 3 * issqnFieldWidth,
    issqnY,
    issqnFieldWidth,
    25,
    'right',
  );

  y = issqnY + 40;

  // 9. ÁREA DE MENSAGEM FISCAL (substituindo DADOS ADICIONAIS para NFC-e)
  // Verificar se há espaço suficiente para o bloco de mensagem fiscal (110pt)
  // const pageHeight = doc.internal.pageSize.getHeight(); // Já declarado no início
  const espacoNecessario = 120; // Altura do bloco + margem
  
  if (y + espacoNecessario > pageHeight - 20) {
    doc.addPage();
    y = margin + 10;
  }
  
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, 110); // Aumentado altura para caber observação
  
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('ÁREA DE MENSAGEM FISCAL', margin + contentWidth / 2, y + 12, { align: 'center' });

  // Calcular totais de IBS e CBS para a observação
  let totalValorIBS = 0;
  let totalValorCBS = 0;
  let aliquotaIBSExibicao = '0,00';
  let aliquotaCBSExibicao = '0,00';

  if (produtos && Array.isArray(produtos)) {
    produtos.forEach((p) => {
      const valorTotalItem = parseFloat(String(p.total_item || (p as any).totalproduto || 0));
      const aliqIbs = parseFloat(String((p as any).aliquota_ibs || (p as any).aliq_ibs || 0));
      const aliqCbs = parseFloat(String((p as any).aliquota_cbs || (p as any).aliq_cbs || 0));
      
      totalValorIBS += (valorTotalItem * aliqIbs) / 100;
      totalValorCBS += (valorTotalItem * aliqCbs) / 100;

      // Pegar a primeira alíquota encontrada para exibir (simplificação, ideal seria média ponderada ou faixa)
      if (aliqIbs > 0 && aliquotaIBSExibicao === '0,00') aliquotaIBSExibicao = formatPercent(aliqIbs);
      if (aliqCbs > 0 && aliquotaCBSExibicao === '0,00') aliquotaCBSExibicao = formatPercent(aliqCbs);
    });
  }

  // Texto da observação IBS/CBS
  const obsIBSCBS = `VALORES REFERENTES AO IBS (${aliquotaIBSExibicao}%) E CBS (${aliquotaCBSExibicao}%) CALCULADOS PARA FINS DE TRANSIÇÃO E APRENDIZADO, CONFORME LEI COMPLEMENTAR Nº 214/2025. ESTES VALORES NÃO COMPÕEM O TOTAL DA OPERAÇÃO NESTE PERÍODO. VALOR IBS: R$ ${formatValue(totalValorIBS)} | VALOR CBS: R$ ${formatValue(totalValorCBS)}`;
  

  
  // Informações da mensagem fiscal baseadas na imagem fornecida
  const chaveAcessoFormatada = getValue(dadosNota.chaveAcesso).match(/.{1,4}/g)?.join(' ') || getValue(dadosNota.chaveAcesso);
  const numeroNFCe = getValue(dadosNFe?.numeroNFe) || getValue((fatura as any).nrodoc_fiscal) || getValue(fatura.nroform);
  const serieNFCe = getValue(dadosNFe?.serieNFe) || getValue(fatura.serie, '1');
  const dataEmissao = formatDate(getValue(dadosNFe?.dataEmissao) || getValue(fatura.data) || new Date().toISOString());
  const horaEmissao = fatura.data ? new Date(fatura.data).toLocaleTimeString('pt-BR') : '';
  
  doc.setFontSize(7).setFont('helvetica', 'normal');
  
  // Linha 1: Número e Série
  const linha1 = `Número ${numeroNFCe} Série ${serieNFCe} Emissão ${dataEmissao} ${horaEmissao} - Via do Consumidor`;
  doc.text(linha1, margin + contentWidth / 2, y + 25, { align: 'center' });
  
  // Linha 2: Consulte pela Chave de Acesso
  doc.text('Consulte pela Chave de Acesso em http://sistemas.sefaz.am.gov.br/nfceweb/formConsulta.do', 
    margin + contentWidth / 2, y + 35, { align: 'center' });
  
  // Linha 3: CHAVE DE ACESSO (em negrito)
  doc.setFont('helvetica', 'bold');
  doc.text('CHAVE DE ACESSO', margin + contentWidth / 2, y + 45, { align: 'center' });
  
  // Linha 4: Chave formatada
  doc.setFontSize(8);
  doc.text(chaveAcessoFormatada, margin + contentWidth / 2, y + 57, { align: 'center' });
  
  // Linha 5: Informação complementar (se houver)
  doc.setFontSize(6).setFont('helvetica', 'normal');
  const infoComplementar = `Venda: ${getValue((venda as any).nrovenda)} | Vendedor: ${getValue(fatura.nomevendedor)}`;
  doc.text(infoComplementar, margin + contentWidth / 2, y + 68, { align: 'center' });

  // Linha 6: Observação IBS/CBS (Mover para o final do bloco)
  doc.setFontSize(6).setFont('helvetica', 'normal');
  const splitObs = doc.splitTextToSize(obsIBSCBS, contentWidth - 10);
  doc.text(splitObs, margin + 5, y + 78); // Posicionado abaixo das outras informações

  y += 90;

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
      
      console.log('🔍 Aplicando marca d\'água:', {
        texto: dadosNota.textoMarcaDagua,
        opacidade: dadosNota.opacidadeMarca,
        cor: [r, g, b],
        pagina: pageNum
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
          cor: [r, g, b]
        });
        
      } catch (e) {
        console.warn('⚠️ Método GState não disponível, usando transparência alternativa:', e);
        
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
        angle: -45 // Rotação de -45 graus
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

  return doc;
};

// Função específica para gerar nota fiscal válida
export const gerarNotaFiscalValidaCupom = async (
  fatura: Fatura,
  produtos: Produto[],
  venda: Venda,
  dadosEmpresa: DadosEmpresa,
  dadosNFe: DadosNFe,
): Promise<jsPDF> => {
  return gerarPreviewCupomFiscal(
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
  return gerarPreviewCupomFiscal(fatura, produtos, venda, dadosEmpresa, 'preview');
};
