import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { gerarChaveDeAcessoPlaceholder } from './gerarcahveAcesso';

// =================================================================================
// 0. FUNÇÃO AUXILIAR PARA CABEÇALHO COMPLETO
// =================================================================================

// Função para desenhar o cabeçalho completo da DANFE
function desenharCabecalhoCompleto(doc: jsPDF, dadosEmpresa: any, fatura: any, dadosNota: any, pageNumber: number = 1) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  // Função auxiliar getValue
  const getValue = (value: any, defaultValue = '') => {
    return value !== null && value !== undefined && value !== '' ? String(value) : String(defaultValue);
  };
  
  // Bloco principal do cabeçalho
  const mainBlockY = margin;
  const mainBlockHeight = 90;
  const danfeWidth = 120;
  const controlWidth = 120;
  const danfeX = pageWidth - margin - controlWidth - danfeWidth;
  const controlX = pageWidth - margin - controlWidth;

  // Bordas principais
  doc.setLineWidth(1);
  doc.rect(margin, mainBlockY, contentWidth, mainBlockHeight);
  doc.setLineWidth(0.5);
  doc.line(danfeX, mainBlockY, danfeX, mainBlockY + mainBlockHeight);
  doc.line(controlX, mainBlockY, controlX, mainBlockY + mainBlockHeight);

  // COLUNA 1: EMITENTE (simplificado para páginas adicionais)
  const logoAreaWidth = 60;
  if (pageNumber === 1) {
    doc.rect(margin + 3, mainBlockY + 3, logoAreaWidth, 50);
  }

  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text(getValue(dadosEmpresa.nomecontribuinte), margin + logoAreaWidth + 5, mainBlockY + 15);
  
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(`${getValue(dadosEmpresa.endereco)}, ${getValue(dadosEmpresa.numero)}`, margin + logoAreaWidth + 5, mainBlockY + 25);
  doc.text(`${getValue(dadosEmpresa.bairro)} - ${getValue(dadosEmpresa.cep)}`, margin + logoAreaWidth + 5, mainBlockY + 35);
  doc.text(`${getValue(dadosEmpresa.cidade)} - ${getValue(dadosEmpresa.uf)} - Fone: ${getValue(dadosEmpresa.fone)}`, margin + logoAreaWidth + 5, mainBlockY + 45);
  doc.text(`Inscrição Estadual: ${getValue(dadosEmpresa.insestadual)}`, margin + logoAreaWidth + 5, mainBlockY + 55);

  // COLUNA 2: DANFE
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text('DANFE', danfeX + danfeWidth / 2, mainBlockY + 20, { align: 'center' });
  
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(
    'DOCUMENTO AUXILIAR\nDA NOTA FISCAL\nELETRÔNICA',
    danfeX + danfeWidth / 2,
    mainBlockY + 35,
    { align: 'center' }
  );

  // Tipo de entrada/saída
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text(`${dadosNota.entradaSaida}-ENTRADA`, danfeX + 10, mainBlockY + 65);
  doc.text(`${dadosNota.numeroSerie}-SAÍDA`, danfeX + 70, mainBlockY + 65);
  
  // Número da página
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(`PÁGINA ${pageNumber} DE X`, danfeX + danfeWidth / 2, mainBlockY + 80, { align: 'center' });

  // COLUNA 3: CONTROLE DO FISCO
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('CONTROLE DO FISCO', controlX + controlWidth / 2, mainBlockY + 15, { align: 'center' });
  
  doc.setFontSize(7).setFont('helvetica', 'normal');
  doc.text('CHAVE DE ACESSO', controlX + 5, mainBlockY + 30);
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text(dadosNota.chaveAcesso, controlX + controlWidth / 2, mainBlockY + 40, { align: 'center' });
  
  doc.setFontSize(7).setFont('helvetica', 'normal');
  doc.text('PROTOCOLO DE AUTORIZAÇÃO DE USO', controlX + 5, mainBlockY + 55);
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text(dadosNota.protocolo, controlX + controlWidth / 2, mainBlockY + 65, { align: 'center' });

  // Segunda linha: Natureza da operação e dados do destinatário
  const secondBlockY = mainBlockY + mainBlockHeight + 5;
  const secondBlockHeight = 35;

  doc.setLineWidth(0.5);
  doc.rect(margin, secondBlockY, contentWidth, secondBlockHeight);
  doc.line(margin + contentWidth / 2, secondBlockY, margin + contentWidth / 2, secondBlockY + secondBlockHeight);

  // Função auxiliar para desenhar campos
  function drawField(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left'
  ) {
    doc.setFontSize(6).setFont('helvetica', 'normal');
    doc.text(label, x + 2, y + 8);
    doc.setFontSize(8).setFont('helvetica', 'bold');
    const textY = y + height - 8;
    
    if (align === 'center') {
      doc.text(value, x + width / 2, textY, { align: 'center' });
    } else if (align === 'right') {
      doc.text(value, x + width - 2, textY, { align: 'right' });
    } else {
      doc.text(value, x + 2, textY);
    }
  }

  // Natureza da operação
  drawField(
    'NATUREZA DA OPERAÇÃO',
    getValue(fatura.natureza, 'Venda de Mercadoria'),
    margin,
    secondBlockY,
    contentWidth / 2,
    secondBlockHeight / 2
  );

  // Inscrição estadual do substituto tributário
  drawField(
    'INSCRIÇÃO ESTADUAL DO SUBST. TRIB.',
    '',
    margin + contentWidth / 2,
    secondBlockY,
    contentWidth / 2,
    secondBlockHeight / 2
  );

  // Inscrição estadual
  drawField(
    'INSCRIÇÃO ESTADUAL',
    getValue(dadosEmpresa.insestadual),
    margin,
    secondBlockY + secondBlockHeight / 2,
    contentWidth / 2,
    secondBlockHeight / 2
  );

  // CNPJ
  drawField(
    'CNPJ',
    getValue(dadosEmpresa.cgc),
    margin + contentWidth / 2,
    secondBlockY + secondBlockHeight / 2,
    contentWidth / 2,
    secondBlockHeight / 2
  );

  return secondBlockY + secondBlockHeight + 15; // Retorna a posição Y onde o conteúdo pode continuar
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
  cst?: string;
  unimed?: string;
  qtd?: string | number;
  prunit?: string | number;
  total_item?: string | number;
  dbprod?: {
    descr?: string;
    [key: string]: any;
  };
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
  } catch (e) {
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
      opacidadeMarca: 0.15,
      corMarca: [180, 180, 180] as [number, number, number],
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
  // Log de debugging para verificar os dados recebidos
  console.log('🔍 gerarPreviewNF - Dados recebidos:', {
    fatura_nome: fatura?.nomefant || 'SEM NOME',
    produtos_count: produtos?.length || 0,
    empresa_nome: dadosEmpresa?.nomecontribuinte || 'SEM EMPRESA',
    empresa_cnpj: dadosEmpresa?.cgc || 'SEM CNPJ',
    empresa_completa: dadosEmpresa ? Object.keys(dadosEmpresa) : 'EMPRESA NULA',
    tipo: tipoNota,
    primeiro_produto: produtos?.[0] ? {
      codprod: produtos[0].codprod,
      descr: produtos[0].descr,
      qtd: produtos[0].qtd,
      prunit: produtos[0].prunit,
    } : 'NENHUM'
  });

  const doc = new jsPDF('p', 'pt', 'a4');
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

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
    valueSize = 9,
  ) => {
    doc.setLineWidth(0.5);
    doc.rect(x, yPos, width, height);

    doc.setFontSize(6).setFont('helvetica', 'normal');
    doc.text(title.toUpperCase(), x + 3, yPos + 7);

    doc.setFontSize(valueSize).setFont('helvetica', 'bold');
    const textOptions: any = { align: valueAlign, baseline: 'middle' };
    let textX = x + 3;
    if (valueAlign === 'center') textX = x + width / 2;
    if (valueAlign === 'right') textX = x + width - 3;

    const valueLines = doc.splitTextToSize(value, width - 6);
    const vAlignOffset = height > 30 ? 12 : height / 2 + 4;
    doc.text(valueLines, textX, yPos + vAlignOffset, textOptions);
  };

  // 1. CABEÇALHO SUPERIOR - RECEBIMENTO E NF-e
  doc.setFontSize(7).setFont('helvetica', 'normal');
  doc.text(
    `RECEBEMOS DE ${getValue(
      dadosEmpresa.nomecontribuinte,
      'NOME DA EMPRESA',
    ).toUpperCase()} OS PRODUTOS E SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO`,
    margin,
    y,
  );
  y += 12;

  const recebimentoBlockWidth = contentWidth - 110;
  const nfeBlockWidth = 105;
  const nfeBlockX = margin + recebimentoBlockWidth;

  doc.rect(margin, y, recebimentoBlockWidth, 35);
  doc.line(
    margin + recebimentoBlockWidth / 2,
    y,
    margin + recebimentoBlockWidth / 2,
    y + 35,
  );
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('DATA DE RECEBIMENTO', margin + 3, y + 12);
  doc.text(
    'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR',
    margin + recebimentoBlockWidth / 2 + 3,
    y + 12,
  );

  doc.rect(nfeBlockX, y, nfeBlockWidth, 35);
  doc.setFontSize(14).setFont('helvetica', 'bold');
  doc.text('NF-e', nfeBlockX + 6, y + 16);
  doc.setFontSize(9).setFont('helvetica', 'normal');
  
  // Debug para verificar campos disponíveis para número da nota
  const numeroNota = getValue(fatura.nroform) || 
                     getValue((fatura as any).nrodoc_fiscal) || 
                     getValue((fatura as any).nrodoc) || 
                     getValue((fatura as any).numero) || 
                     getValue((dadosNFe as any)?.nNF) || 
                     'SEM NÚMERO';
  
  console.log('🔍 Debug número da nota:', {
    nroform: fatura.nroform,
    nrodoc_fiscal: (fatura as any).nrodoc_fiscal,
    nrodoc: (fatura as any).nrodoc,
    numero: (fatura as any).numero,
    dadosNFe_nNF: (dadosNFe as any)?.nNF,
    numeroFinal: numeroNota,
    campos_fatura: Object.keys(fatura)
  });
  
  doc.text(`Nº ${numeroNota}`, nfeBlockX + 40, y + 12);
  doc.text(`Série ${getValue(fatura.serie, '1')}`, nfeBlockX + 40, y + 22);
  y += 40;

  // 2. BLOCO PRINCIPAL - EMITENTE, DANFE, CONTROLE
  const mainBlockY = y;
  const mainBlockHeight = 98;
  const emitterWidth = 240;
  const danfeWidth = 125;
  const controlWidth = contentWidth - emitterWidth - danfeWidth;
  const danfeX = margin + emitterWidth;
  const controlX = danfeX + danfeWidth;

  doc.setLineWidth(1.5).rect(margin, mainBlockY, contentWidth, mainBlockHeight);
  doc.setLineWidth(0.5);
  doc.line(danfeX, mainBlockY, danfeX, mainBlockY + mainBlockHeight);
  doc.line(controlX, mainBlockY, controlX, mainBlockY + mainBlockHeight);

  // -- COLUNA 1: EMITENTE (com espaço para logo)
  const logoAreaWidth = 60;
  doc.rect(margin + 3, mainBlockY + 3, logoAreaWidth, 50); // Caixa para o logo

  // Carregar logo (funciona tanto no cliente quanto no servidor)
  const carregarLogo = new Promise<void>((resolve, reject) => {
    const logoX = margin + 6;
    const logoY = mainBlockY + 6;
    const logoWidth = logoAreaWidth - 6;
    const logoHeight = 44;

    // No servidor (Node.js)
    if (typeof window === 'undefined') {
      // Usar importação dinâmica para módulos do Node.js
      Promise.all([
        import('fs'),
        import('path')
      ]).then(([fs, path]) => {
        try {
          const logoPath = path.default.join(process.cwd(), 'public', 'images', 'logomelo2.png');
          if (fs.default.existsSync(logoPath)) {
            const logoBuffer = fs.default.readFileSync(logoPath);
            const logoBase64 = logoBuffer.toString('base64');
            doc.addImage(
              `data:image/png;base64,${logoBase64}`,
              'PNG',
              logoX,
              logoY,
              logoWidth,
              logoHeight
            );
            console.log('✅ Logo carregada no servidor');
          } else {
            console.log('⚠️ Arquivo de logo não encontrado:', logoPath);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar logo no servidor:', error);
        }
        resolve();
      }).catch(error => {
        console.error('❌ Erro ao importar módulos fs/path:', error);
        resolve();
      });
      return;
    }
    
    // No cliente (browser)
    const img = new Image();
    img.src = '/images/logomelo2.png';

    img.onload = () => {
      doc.addImage(
        img,
        'PNG',
        logoX,
        logoY,
        logoWidth,
        logoHeight
      );
      console.log('✅ Logo carregada no cliente');
      resolve();
    };

    img.onerror = (err) => {
      console.error('❌ Erro ao carregar a logo no cliente:', err);
      doc.setFontSize(8).setFont('helvetica', 'normal');
      doc.text('LOGO', margin + 30, mainBlockY + 28, { align: 'center' });
      resolve();
    };
  });

// Aguardamos a Promise do carregamento da imagem ser resolvida
await carregarLogo;

  let emitterTextX = margin + logoAreaWidth + 8;
  let emitterTextY = mainBlockY + 15;
  const emitterTextWidth = emitterWidth - logoAreaWidth - 12;

  doc.setFontSize(10).setFont('helvetica', 'bold');
  const nomeFantasia = getValue(
    dadosEmpresa.nomefantasia,
    getValue(dadosEmpresa.nomecontribuinte),
  ).toUpperCase();
  const nomeLines = doc.splitTextToSize(nomeFantasia, emitterTextWidth);
  doc.text(nomeLines, emitterTextX, emitterTextY);

  // Ajusta a posição do endereço com base na altura do nome
  const nomeHeight = doc.getTextDimensions(nomeLines).h;
  emitterTextY += nomeHeight + 2;

  doc.setFontSize(8).setFont('helvetica', 'normal');
  const emitterAddr = `${getValue(dadosEmpresa.logradouro)}, ${getValue(
    dadosEmpresa.numero,
  )}\nCENTRO - ${getValue(dadosEmpresa.cep)}\nMANAUS - AM - Fone: (${getValue(
    dadosEmpresa.telefone,
  )})\nInscrição Estadual: ${getValue(dadosEmpresa.inscricaoestadual)}`;
  doc.text(
    doc.splitTextToSize(emitterAddr, emitterTextWidth),
    emitterTextX,
    emitterTextY,
  );

  // -- COLUNA 2: DANFE
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.text('DANFE', danfeX + danfeWidth / 2, mainBlockY + 20, {
    align: 'center',
  });
  doc.setFontSize(7).setFont('helvetica', 'normal');
  doc.text(
    'DOCUMENTO AUXILIAR\nDA NOTA FISCAL\nELETRÔNICA',
    danfeX + danfeWidth / 2,
    mainBlockY + 32,
    { align: 'center' },
  );
  doc.text('0-ENTRADA', danfeX + 15, mainBlockY + 70);
  doc.text('1-SAÍDA', danfeX + 65, mainBlockY + 70);
  doc.rect(danfeX + 95, mainBlockY + 63, 15, 12);
  doc.setFont('helvetica', 'bold').setFontSize(10);
  doc.text('1', danfeX + 99, mainBlockY + 72);
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('PÁGINA 1 DE 1', danfeX + danfeWidth / 2, mainBlockY + 90, {
    align: 'center',
  });

  // -- COLUNA 3: CONTROLE (sem código de barras)

  // CONTROLE DO FISCO - Layout ajustado
  doc
    .setFontSize(6)
    .setFont('helvetica', 'normal')
    .text('CONTROLE DO FISCO', controlX, mainBlockY + 8);

  // Código de barras
  const chaveDeAcesso = dadosNota.chaveAcesso === 'SEM VALIDADE' 
    ? gerarChaveDeAcessoPlaceholder(fatura, dadosEmpresa.cgc)
    : dadosNota.chaveAcesso;
    
  if (dadosNota.exibirCodigoBarras) {
    try {
      let canvas: HTMLCanvasElement;
      
      // No servidor (Node.js), usar canvas do pacote canvas
      if (typeof window === 'undefined') {
        // Importar canvas dinamicamente apenas no servidor
        const { createCanvas } = await import('canvas');
        canvas = createCanvas(400, 100) as any;
        console.log('🔧 Gerando código de barras no servidor');
      } else {
        // No cliente (browser)
        canvas = document.createElement('canvas');
        console.log('🔧 Gerando código de barras no cliente');
      }

      JsBarcode(canvas, chaveDeAcesso, {
        displayValue: false,
        margin: 0,
        height: 25,
        width: 1.6,
      });

      const barcodeImage = canvas.toDataURL('image/png');
      doc.addImage(
        barcodeImage,
        'PNG',
        controlX + 3,
        mainBlockY + 12,
        controlWidth - 6,
        25,
      );
      
      console.log('✅ Código de barras gerado com sucesso');
    } catch (e) {
      console.error('❌ Erro ao gerar código de barras:', e);
    }
  }

  // CHAVE DE ACESSO logo abaixo do código de barras
  drawField(
    'CHAVE DE ACESSO',
    dadosNota.chaveAcesso,
    controlX,
    mainBlockY + 42, // ajustado para dar mais espaço ao código de barras
    controlWidth,
    32, // aumentado de 22 para 28 para acomodar melhor o texto
    'center',
    7, // fonte menor para evitar sobreposição
  );

  // Protocolo com mais espaço
  drawField(
    'PROTOCOLO DE AUTORIZAÇÃO DE USO',
    dadosNota.protocolo,
    controlX,
    mainBlockY + 75, // aumentado de 68 para 75 para dar mais espaço à chave
    controlWidth,
    22, // aumentado de 16 para 18
    'center',
    7, // fonte menor para consistência
  );

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
    25,
  );
  currentX += fieldWidth;
  fieldWidth = 140;
  drawField('CNPJ/CPF', getValue(fatura.cpfcgc), currentX, y, fieldWidth, 25);
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  drawField(
    'DATA DE EMISSÃO',
    formatDate(fatura.data),
    currentX,
    y,
    fieldWidth,
    25,
    'center',
  );

  y += 25;

  // Segunda linha
  currentX = margin;
  fieldWidth = 320;
  drawField(
    'ENDEREÇO',
    `${getValue(fatura.ender)}, ${getValue(fatura.numero, 'S/N')}`,
    currentX,
    y,
    fieldWidth,
    25,
  );
  currentX += fieldWidth;
  fieldWidth = 140;
  drawField(
    'BAIRRO/DISTRITO',
    getValue(fatura.bairro),
    currentX,
    y,
    fieldWidth,
    25,
  );
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  drawField('CEP', getValue(fatura.cep), currentX, y, fieldWidth, 25, 'center');

  y += 25;

  // Terceira linha
  currentX = margin;
  fieldWidth = 180;
  drawField('MUNICÍPIO', getValue(fatura.cidade), currentX, y, fieldWidth, 25);
  currentX += fieldWidth;
  fieldWidth = 100;
  drawField('FONE/FAX', getValue(fatura.fone), currentX, y, fieldWidth, 25);
  currentX += fieldWidth;
  fieldWidth = 35;
  drawField('UF', getValue(fatura.uf), currentX, y, fieldWidth, 25, 'center');
  currentX += fieldWidth;
  fieldWidth = 145;
  drawField(
    'INSCRIÇÃO ESTADUAL',
    getValue(fatura.iest),
    currentX,
    y,
    fieldWidth,
    25,
  );
  currentX += fieldWidth;
  fieldWidth = contentWidth - currentX + margin;
  drawField('DATA DE ENTR./SAÍDA', '', currentX, y, fieldWidth, 25);

  y += 40;

  // 5. CÁLCULO DO IMPOSTO
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('CÁLCULO DO IMPOSTO', margin, y);
  y += 12;

  const impostoY = y;
  const impostoH = 25;
  doc.setLineWidth(0.5);
  doc.rect(margin, impostoY, contentWidth, impostoH * 2);

  const impostoFieldWidth = contentWidth / 6;

  // Primeira linha de impostos
  drawField(
    'BASE DE CÁLC. DO ICMS',
    formatValue(fatura.baseicms),
    margin,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'VALOR DO ICMS',
    formatValue(fatura.valor_icms),
    margin + impostoFieldWidth,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'BASE DE CÁLC. DO ICMS ST.',
    formatValue(fatura.baseicms_subst),
    margin + 2 * impostoFieldWidth,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'V. IMP. IMPORTAÇÃO',
    '0,00',
    margin + 3 * impostoFieldWidth,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'VALOR DO IPI',
    formatValue(fatura.valor_ipi),
    margin + 4 * impostoFieldWidth,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'VALOR TOTAL DOS PRODUTOS',
    formatValue(fatura.totalprod),
    margin + 5 * impostoFieldWidth,
    impostoY,
    impostoFieldWidth,
    impostoH,
    'right',
  );

  // Segunda linha de impostos
  y += impostoH;
  drawField(
    'VALOR DO FRETE',
    formatValue(fatura.vlrfrete),
    margin,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'VALOR DO SEGURO',
    formatValue(fatura.vlrseg),
    margin + impostoFieldWidth,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'DESCONTO',
    '0,00',
    margin + 2 * impostoFieldWidth,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'OUTRAS DESP.',
    formatValue(fatura.vlrdesp),
    margin + 3 * impostoFieldWidth,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'V. ICMS UF REMET.',
    '0,00',
    margin + 4 * impostoFieldWidth,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );
  drawField(
    'VALOR TOTAL DA NOTA',
    formatValue(fatura.totalnf),
    margin + 5 * impostoFieldWidth,
    y,
    impostoFieldWidth,
    impostoH,
    'right',
  );

  y += impostoH + 20;

  // 6. TRANSPORTADOR/VOLUMES TRANSPORTADOS
  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('TRANSPORTADOR/VOLUMES TRANSPORTADOS', margin, y);
  y += 12;

  const transpY = y;
  const transpRow1H = 40;
  const transpRow2H = 25;
  const transpRow3H = 25;
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
  doc.text('FRETE POR CONTA', freteX + 3, transpY + 8);
  doc.setFontSize(7);
  doc.text('0-Emitente', freteX + 3, transpY + 18);
  doc.text('1-Destinatário', freteX + 3, transpY + 28);
  doc.text('2-Terceiros', freteX + 3, transpY + 38);

  // Checkbox
  const checkboxX = freteX + 70;
  const checkboxY = transpY + 15;
  doc.setLineWidth(1);
  doc.rect(checkboxX, checkboxY, 15, 15);
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(getValue(fatura.destfrete, '1'), checkboxX + 7.5, checkboxY + 10, {
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

  y = transpY3 + transpRow3H + 20;

  // 7. DADOS DOS PRODUTOS
  if (y > 650) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('DADOS DO PRODUTO/SERVIÇO', margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.5,
      lineColor: 0,
      halign: 'center',
    },
    headStyles: {
      halign: 'center',
      fillColor: [255, 255, 255],
      textColor: 0,
      fontSize: 8,
      fontStyle: 'normal',
    },
    showHead: 'firstPage', // Mostrar cabeçalho apenas na primeira página
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    body: produtos.map((p, index) => {
      // Múltiplas fontes para descrição do produto
      const descricao = p.descr || 
                       (p.dbprod && p.dbprod.descr) || 
                       (p as any).descricao || 
                       (p as any).description || 
                       `PRODUTO ${p.codprod}`;
      
      if (index === 0) {
        console.log('🔍 Primeiro produto - debug descrição e impostos:', {
          descr_original: p.descr,
          dbprod_descr: p.dbprod && p.dbprod.descr,
          descricao_campo: (p as any).descricao,
          description_campo: (p as any).description,
          descricao_final: descricao,
          // Debug de impostos
          impostos_disponiveis: {
            baseicms: (p as any).baseicms,
            base_icms: (p as any).base_icms,
            totalicms: (p as any).totalicms,
            vICMS: (p as any).vICMS,
            valor_icms: (p as any).valor_icms,
            icms: (p as any).icms,
            pICMS: (p as any).pICMS,
            aliq_icms: (p as any).aliq_icms,
            baseipi: (p as any).baseipi,
            totalipi: (p as any).totalipi,
            vIPI: (p as any).vIPI,
            valor_ipi: (p as any).valor_ipi,
            ipi: (p as any).ipi,
            pIPI: (p as any).pIPI,
            aliq_ipi: (p as any).aliq_ipi,
            // Verificar valores após conversão
            icms_convertido: Number((p as any).icms || (p as any).pICMS || (p as any).aliq_icms || 0),
            ipi_convertido: Number((p as any).ipi || (p as any).pIPI || (p as any).aliq_ipi || 0),
            campos_com_imposto: Object.keys(p).filter(key => 
              key.toLowerCase().includes('icms') || 
              key.toLowerCase().includes('ipi') ||
              key.toLowerCase().includes('base') ||
              key.toLowerCase().includes('total') ||
              key.toLowerCase().includes('aliq')
            )
          },
          produto_completo: Object.keys(p)
        });
      }
      return [
        getValue(p.codprod),
        getValue(descricao),
        getValue(p.ncm, 'N/A'),
        getValue(p.cst, '0102'),
        getValue(fatura.cfop2, '5405'),
        getValue(p.unimed, 'UN'),
        formatValue(p.qtd),
        formatValue(p.prunit),
        formatValue(p.total_item),
        formatValue((p as any).baseicms || (p as any).base_icms || 0), // Base ICMS
        formatValue((p as any).totalicms || (p as any).vICMS || (p as any).valor_icms || 0), // Valor ICMS
        formatValue((p as any).totalipi || (p as any).vIPI || (p as any).valor_ipi || 0), // Valor IPI
        formatPercent((p as any).icms || (p as any).pICMS || (p as any).aliq_icms || 0), // Alíquota ICMS (%)
        formatPercent((p as any).ipi || (p as any).pIPI || (p as any).aliq_ipi || 0), // Alíquota IPI (%)
      ];
    }),
    head: [
      [
        'CÓDIGO',
        'DESCRIÇÃO DO PRODUTO/SERVIÇO',
        'NCM/SH',
        'CST',
        'CFOP',
        'UN.',
        'QTD.',
        'VLR. UNIT',
        'VLR. TOTAL',
        'BC ICMS',
        'VLR. ICMS',
        'VLR. IPI',
        'ALÍQ. ICMS',
        'ALÍQ. IPI',
      ],
    ],
    didDrawPage: (data) => {
      // Para páginas subsequentes, apenas continuar a tabela normalmente
      // Não adicionar cabeçalho completo para evitar "bug" visual
      if (data.pageNumber && data.pageNumber > 1) {
        // Apenas adicionar um pequeno indicativo de continuação
        doc.setFontSize(7).setFont('helvetica', 'normal');
        doc.text('(continuação)', margin, margin - 5);
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

  // 9. DADOS ADICIONAIS
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, 60);
  const infoComplWidth = contentWidth * 0.65;
  doc.line(margin + infoComplWidth, y, margin + infoComplWidth, y + 60);

  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text('DADOS ADICIONAIS', margin + 3, y + 10);
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('INFORMAÇÕES COMPLEMENTARES', margin + 3, y + 20);

  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text('RESERVA AO FISCO', margin + infoComplWidth + 3, y + 10);

  doc.setFontSize(7).setFont('helvetica', 'normal');
  const infoText = `Venda: ${getValue(venda.nrovenda)} | Vendedor: ${getValue(
    fatura.nomevendedor,
  )} | Obs: ${getValue(
    venda.obs,
  )}\nDOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.\nNÃO GERA DIREITO A CRÉDITO FISCAL DE ICMS, ISS E IPI.`;
  const infoLines = doc.splitTextToSize(infoText, infoComplWidth - 6);
  doc.text(infoLines, margin + 3, y + 30);
  doc.rect(margin, y, contentWidth, 60);
  doc.line(margin + infoComplWidth, y, margin + infoComplWidth, y + 60);
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text(
    'Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizada.',
    margin + 3,
    y + 80,
  );

  // Texto diagonal "SEM VALIDADE" no meio do documento (apenas para preview)
  if (dadosNota.textoMarcaDagua) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const totalPages = doc.getNumberOfPages();
    
    // Aplicar marca d'água em todas as páginas
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      doc.setPage(pageNum);
      
      // Configurar posição
      const centerX = pageWidth / 2;
      const centerY = pageHeight / 2;
      
      // Aplicar estilo com transparência simulada usando cor mais clara
      const [r, g, b] = dadosNota.corMarca;
      // Simular transparência misturando com branco
      const alpha = dadosNota.opacidadeMarca;
      const lightR = Math.round(r + (255 - r) * (1 - alpha));
      const lightG = Math.round(g + (255 - g) * (1 - alpha));
      const lightB = Math.round(b + (255 - b) * (1 - alpha));
      
      doc.setTextColor(lightR, lightG, lightB);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      
      // Desenhar texto rotacionado usando a API pública do jsPDF
      doc.text(dadosNota.textoMarcaDagua, centerX, centerY, { 
        align: 'center',
        angle: -45 // Rotação de -45 graus
      });
    }
  }
  
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
  return gerarPreviewNF(fatura, produtos, venda, dadosEmpresa, 'valida', dadosNFe);
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
