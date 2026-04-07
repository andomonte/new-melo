import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface OrdemCompraPDFData {
  numeroOC: string;
  dataEmissao: Date;
  nomeRequisitante: string;
  centroCusto: string;
  setor: string;
  fornecedor: {
    nome: string;
    cpfCnpj: string;
    endereco: string;
  };
  valorTotal: number;
  prazoEntrega: number;
  justificativa: string;
  observacoes?: string;
  compraUrgencia: boolean;
  itens: Array<{
    codigoReferencia: string;
    quantidade: number;
    unidade: string;
    descricao: string;
    marca?: string;
    precoUnitario: number;
    precoTotal: number;
  }>;
}

async function buscarDadosOrdem(orcId: string): Promise<OrdemCompraPDFData | null> {
  const pool = getPgPool('manaus');
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        -- Dados da Ordem
        o.orc_id::text as numero_oc,
        o.orc_data,
        o.orc_status,

        -- Dados da Requisição
        r.req_observacao as justificativa,
        r.req_cond_pagto as condicoes_pagamento,
        r.req_tipo,
        r.req_previsao_chegada,

        -- Dados do Comprador (Requisitante)
        c.nome as comprador_nome,
        'Compras' as comprador_setor,

        -- Dados do Fornecedor (via requisição)
        f.nome as fornecedor_nome,
        f.cpf_cgc as fornecedor_cpf_cnpj,
        f.endereco as fornecedor_endereco,
        f.cidade as fornecedor_cidade,
        f.uf as fornecedor_uf,

        -- Dados da Filial (Centro de Custo)
        COALESCE(u.unm_nome, 'MANAUS') as centro_custo

      FROM db_manaus.cmp_ordem_compra o
      JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.cad_unidade_melo u ON r.req_unm_id_destino = u.unm_id

      WHERE o.orc_id = $1
    `;

    const resultOrdem = await client.query(query, [orcId]);

    if (resultOrdem.rows.length === 0) {
      return null;
    }

    const ordem = resultOrdem.rows[0] as any;

    // Buscar itens da ordem com valor total e unitário
    const queryItens = `
      SELECT
        ri.itr_codprod as codigo_referencia,
        ri.itr_quantidade::float as quantidade,
        'UN' as unidade,
        p.descr as descricao,
        COALESCE(m.descr, '') as marca,
        COALESCE(ri.itr_pr_unitario::float, 0) as preco_unitario,
        COALESCE((ri.itr_quantidade * ri.itr_pr_unitario)::float, 0) as preco_total
      FROM db_manaus.cmp_it_requisicao ri
      JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      WHERE ri.itr_req_id = (
        SELECT orc_req_id FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1
      )
      AND ri.itr_req_versao = (
        SELECT orc_req_versao FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1
      )
    `;

    const resultItens = await client.query(queryItens, [orcId]);
    const itens = resultItens.rows as any[];
    
    // Calcular valor total dos itens
    const valorTotal = itens.reduce((total: number, item: any) => total + (item.preco_total || 0), 0);

    // Montar objeto final com dados reais completos
    const endereco_completo = `${ordem.fornecedor_endereco || ''}${ordem.fornecedor_cidade ? ', ' + ordem.fornecedor_cidade : ''}${ordem.fornecedor_uf ? ' - ' + ordem.fornecedor_uf : ''}`.trim();
    
    const dadosOrdem: OrdemCompraPDFData = {
      numeroOC: ordem.numero_oc,
      dataEmissao: new Date(ordem.orc_data),
      nomeRequisitante: ordem.comprador_nome || 'Não informado',
      centroCusto: ordem.centro_custo || 'MANAUS',
      setor: ordem.comprador_setor || 'Compras',
      fornecedor: {
        nome: ordem.fornecedor_nome || 'Não informado',
        cpfCnpj: ordem.fornecedor_cpf_cnpj || '',
        endereco: endereco_completo || 'Endereço não informado',
      },
      valorTotal: valorTotal,
      prazoEntrega: 30, // Padrão de 30 dias
      justificativa: ordem.justificativa || 'Compra necessária para operação',
      observacoes: ordem.condicoes_pagamento || 'A combinar',
      compraUrgencia: false, // Removemos a lógica de urgência
      itens: itens.map(item => ({
        codigoReferencia: item.codigo_referencia || '',
        quantidade: item.quantidade || 1,
        unidade: item.unidade || 'UN',
        descricao: item.descricao || 'Produto não especificado',
        marca: item.marca || '',
        precoUnitario: item.preco_unitario || 0,
        precoTotal: item.preco_total || 0,
      }))
    };

    return dadosOrdem;

  } catch (error) {
    console.error('Erro ao buscar dados da ordem:', error);
    return null;
  } finally {
    client.release();
  }
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

function gerarPDF(dados: OrdemCompraPDFData): Buffer {
  // Criar PDF em formato A4
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  
  // Configurações iniciais
  const margemEsquerda = 15;
  const margemDireita = 15;
  const larguraPagina = 210 - margemEsquerda - margemDireita; // 180mm
  let posicaoY = 20;

  // CABEÇALHO PROFISSIONAL MELO PEÇAS
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logoPdf.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath).toString('base64');
      // Logo posicionada à esquerda, menor e sem sobrepor
      pdf.addImage(`data:image/png;base64,${logoData}`, 'PNG', margemEsquerda, posicaoY, 50, 25);
    }
  } catch (error) {
    console.log('Erro ao carregar logo:', error);
  }

  // Título ORDEM DE COMPRA - posicionado à direita da logo
  pdf.setTextColor(41, 84, 144); // Azul Melo
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ORDEM DE COMPRA', margemEsquerda + 70, posicaoY + 15);

  // Número da OC (caixa elegante no canto direito)
  const larguraCaixaOC = 35;
  const posicaoXCaixaOC = 210 - margemDireita - larguraCaixaOC;
  pdf.setDrawColor(41, 84, 144);
  pdf.setLineWidth(1);
  pdf.rect(posicaoXCaixaOC, posicaoY, larguraCaixaOC, 25);
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Nº DA ORDEM', posicaoXCaixaOC + larguraCaixaOC/2, posicaoY + 8, { align: 'center' });
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(dados.numeroOC, posicaoXCaixaOC + larguraCaixaOC/2, posicaoY + 18, { align: 'center' });

  posicaoY += 35;

  // INFORMAÇÕES DA ORDEM - Layout profissional com dados reais
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  // Seção 1: Dados da Ordem
  const alturaCelula = 10;
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaCelula, 'F');
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaCelula);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('DADOS DA ORDEM', margemEsquerda + 5, posicaoY + 7);
  posicaoY += alturaCelula;

  // Linha 1: Requisitante | Data de Emissão | Status
  pdf.rect(margemEsquerda, posicaoY, larguraPagina * 0.4, alturaCelula);
  pdf.rect(margemEsquerda + larguraPagina * 0.4, posicaoY, larguraPagina * 0.35, alturaCelula);
  pdf.rect(margemEsquerda + larguraPagina * 0.75, posicaoY, larguraPagina * 0.25, alturaCelula);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('REQUISITANTE:', margemEsquerda + 2, posicaoY + 4);
  pdf.text('DATA DE EMISSÃO:', margemEsquerda + larguraPagina * 0.4 + 2, posicaoY + 4);
  pdf.text('STATUS:', margemEsquerda + larguraPagina * 0.75 + 2, posicaoY + 4);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(dados.nomeRequisitante, margemEsquerda + 2, posicaoY + 8);
  pdf.text(formatarData(dados.dataEmissao), margemEsquerda + larguraPagina * 0.4 + 2, posicaoY + 8);
  pdf.text('PENDENTE', margemEsquerda + larguraPagina * 0.75 + 2, posicaoY + 8);

  posicaoY += alturaCelula;

  // Linha 2: Local de Entrega | Valor Total
  pdf.rect(margemEsquerda, posicaoY, larguraPagina * 0.6, alturaCelula);
  pdf.rect(margemEsquerda + larguraPagina * 0.6, posicaoY, larguraPagina * 0.4, alturaCelula);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('LOCAL DE ENTREGA:', margemEsquerda + 2, posicaoY + 4);
  pdf.text('VALOR TOTAL:', margemEsquerda + larguraPagina * 0.6 + 2, posicaoY + 4);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(dados.centroCusto, margemEsquerda + 2, posicaoY + 8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(formatarMoeda(dados.valorTotal), margemEsquerda + larguraPagina * 0.6 + 2, posicaoY + 8);

  posicaoY += alturaCelula + 8;

  // TABELA DE ITENS
  const colunaReferencia = 25;
  const colunaMarca = 25;
  const colunaQuantidade = 20;
  const colunaValorUnit = 26;
  const colunaTotal = 26;
  const colunaDescricao = larguraPagina - colunaReferencia - colunaMarca - colunaQuantidade - colunaValorUnit - colunaTotal;

  // Cabeçalho da tabela
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.rect(margemEsquerda, posicaoY, colunaReferencia, alturaCelula);
  pdf.rect(margemEsquerda + colunaReferencia, posicaoY, colunaDescricao, alturaCelula);
  pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao, posicaoY, colunaMarca, alturaCelula);
  pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca, posicaoY, colunaQuantidade, alturaCelula);
  pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade, posicaoY, colunaValorUnit, alturaCelula);
  pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit, posicaoY, colunaTotal, alturaCelula);

  pdf.text('REFERÊNCIA', margemEsquerda + colunaReferencia/2, posicaoY + 5, { align: 'center' });
  pdf.text('DESCRIÇÃO', margemEsquerda + colunaReferencia + 2, posicaoY + 5);
  pdf.text('MARCA', margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca/2, posicaoY + 5, { align: 'center' });
  pdf.text('QTD', margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade/2, posicaoY + 5, { align: 'center' });
  pdf.text('PREÇO UNIT.', margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit/2, posicaoY + 5, { align: 'center' });
  pdf.text('PREÇO TOTAL', margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit + colunaTotal/2, posicaoY + 5, { align: 'center' });

  posicaoY += alturaCelula;

  // Itens da tabela - Com quebra de linha automática na descrição
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const alturaLinhaItemMinima = 8;
  const alturaLinhaPorTexto = 3.5; // Altura por linha de texto

  dados.itens.forEach((item, index) => {
    // Quebrar descrição em múltiplas linhas se necessário
    pdf.setFontSize(8);
    const linhasDescricao = pdf.splitTextToSize(item.descricao, colunaDescricao - 4);
    const numLinhasDescricao = Array.isArray(linhasDescricao) ? linhasDescricao.length : 1;

    // Calcular altura da célula baseado no número de linhas da descrição
    const alturaLinhaItem = Math.max(alturaLinhaItemMinima, numLinhasDescricao * alturaLinhaPorTexto + 4);

    if (posicaoY + alturaLinhaItem > 270) { // Próximo de fim da página
      pdf.addPage();
      posicaoY = 20;
    }

    pdf.rect(margemEsquerda, posicaoY, colunaReferencia, alturaLinhaItem);
    pdf.rect(margemEsquerda + colunaReferencia, posicaoY, colunaDescricao, alturaLinhaItem);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao, posicaoY, colunaMarca, alturaLinhaItem);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca, posicaoY, colunaQuantidade, alturaLinhaItem);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade, posicaoY, colunaValorUnit, alturaLinhaItem);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit, posicaoY, colunaTotal, alturaLinhaItem);

    // Código de Referência (centralizado verticalmente)
    pdf.setFontSize(8);
    const posicaoYCentroVertical = posicaoY + alturaLinhaItem / 2 + 1;
    pdf.text(item.codigoReferencia, margemEsquerda + colunaReferencia/2, posicaoYCentroVertical, { align: 'center' });

    // Descrição com quebra de linha automática
    pdf.setFontSize(8);
    pdf.text(linhasDescricao, margemEsquerda + colunaReferencia + 2, posicaoY + 3.5);

    // Marca (centralizada verticalmente e truncada se muito longa)
    const marcaTruncada = (item.marca || '-').length > 12
      ? (item.marca || '-').substring(0, 10) + '...'
      : (item.marca || '-');
    pdf.text(marcaTruncada, margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca/2, posicaoYCentroVertical, { align: 'center' });

    // Quantidade (centralizada verticalmente)
    pdf.text(item.quantidade.toString(), margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade/2, posicaoYCentroVertical, { align: 'center' });

    // Adicionar preço unitário (centralizado verticalmente)
    pdf.setFontSize(7);
    pdf.text(formatarMoeda(item.precoUnitario), margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit/2, posicaoYCentroVertical, { align: 'center' });

    // Adicionar preço total (centralizado verticalmente)
    pdf.text(formatarMoeda(item.precoTotal), margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit + colunaTotal/2, posicaoYCentroVertical, { align: 'center' });
    pdf.setFontSize(9);

    posicaoY += alturaLinhaItem;
  });

  // Adicionar linhas vazias apenas se tiver poucos itens (máximo 8 linhas no total)
  const linhasVazias = Math.max(0, 8 - dados.itens.length);
  for (let i = 0; i < linhasVazias; i++) {
    // Verificar se precisa de nova página
    if (posicaoY + alturaLinhaItemMinima > 270) {
      pdf.addPage();
      posicaoY = 20;
    }

    pdf.rect(margemEsquerda, posicaoY, colunaReferencia, alturaLinhaItemMinima);
    pdf.rect(margemEsquerda + colunaReferencia, posicaoY, colunaDescricao, alturaLinhaItemMinima);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao, posicaoY, colunaMarca, alturaLinhaItemMinima);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca, posicaoY, colunaQuantidade, alturaLinhaItemMinima);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade, posicaoY, colunaValorUnit, alturaLinhaItemMinima);
    pdf.rect(margemEsquerda + colunaReferencia + colunaDescricao + colunaMarca + colunaQuantidade + colunaValorUnit, posicaoY, colunaTotal, alturaLinhaItemMinima);
    posicaoY += alturaLinhaItemMinima;
  }

  // LINHA DE TOTAL GERAL - Após a tabela de itens
  const alturaTotalGeral = 10;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaTotalGeral, 'F');
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaTotalGeral);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  const textoTotal = `TOTAL GERAL: ${formatarMoeda(dados.valorTotal)}`;
  pdf.text(textoTotal, margemEsquerda + larguraPagina - 2, posicaoY + 7, { align: 'right' });

  posicaoY += alturaTotalGeral + 5;

  // Verificar se há espaço para o rodapé completo (estimativa ~120mm mínimo) ou criar nova página
  // Agora as caixas de justificativa e fornecedor são dinâmicas, então estimamos um espaço razoável
  const espacoMinimoRodape = 120;
  if (posicaoY + espacoMinimoRodape > 270) {
    pdf.addPage();
    posicaoY = 20;
  }

  // JUSTIFICAÇÃO PARA A COMPRA - Com quebra de linha automática
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, 8);
  pdf.text('JUSTIFICATIFICAÇÃO PARA A COMPRA:', margemEsquerda + 2, posicaoY + 5);
  posicaoY += 8;

  // Conteúdo da justificativa com quebra automática
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const linhasJustificativa = pdf.splitTextToSize(dados.justificativa, larguraPagina - 4);
  const alturaJustificativa = Math.max(12, linhasJustificativa.length * 5 + 4); // Mínimo 12mm

  // Verificar se precisa de nova página antes de desenhar
  if (posicaoY + alturaJustificativa > 270) {
    pdf.addPage();
    posicaoY = 20;
    // Redesenhar o cabeçalho da seção
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.rect(margemEsquerda, posicaoY, larguraPagina, 8);
    pdf.text('JUSTIFICATIFICAÇÃO PARA A COMPRA:', margemEsquerda + 2, posicaoY + 5);
    posicaoY += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
  }

  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaJustificativa);
  pdf.text(linhasJustificativa, margemEsquerda + 2, posicaoY + 4);

  posicaoY += alturaJustificativa + 2;

  // INDICAÇÃO DE FORNECEDORES - Com quebra de linha automática
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, 8);
  pdf.text('INDICAÇÃO DE FORNECEDORES / CONTACTO / EMAIL:', margemEsquerda + 2, posicaoY + 5);
  posicaoY += 8;

  // Conteúdo do fornecedor com quebra automática
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const infoFornecedor = `${dados.fornecedor.nome} - ${dados.fornecedor.cpfCnpj} - ${dados.fornecedor.endereco}`;

  // Quebrar texto em linhas para não estourar
  const linhasFornecedor = pdf.splitTextToSize(infoFornecedor, larguraPagina - 4);
  const alturaFornecedor = linhasFornecedor.length * 5 + 4; // 5mm por linha + padding

  // Verificar se precisa de nova página antes de desenhar
  if (posicaoY + alturaFornecedor > 270) {
    pdf.addPage();
    posicaoY = 20;
    // Redesenhar o cabeçalho da seção
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.rect(margemEsquerda, posicaoY, larguraPagina, 8);
    pdf.text('INDICAÇÃO DE FORNECEDORES / CONTACTO / EMAIL:', margemEsquerda + 2, posicaoY + 5);
    posicaoY += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
  }

  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaFornecedor);
  pdf.text(linhasFornecedor, margemEsquerda + 2, posicaoY + 4);

  posicaoY += alturaFornecedor + 2;

  // INFORMAÇÕES ADICIONAIS - Dados reais do sistema
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, 10, 'F');
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, 10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INFORMAÇÕES ADICIONAIS', margemEsquerda + 5, posicaoY + 7);
  posicaoY += 10;

  // Prazo de Entrega e Data de Previsão
  const larguraMetade = larguraPagina / 2;
  pdf.rect(margemEsquerda, posicaoY, larguraMetade, 12);
  pdf.rect(margemEsquerda + larguraMetade, posicaoY, larguraMetade, 12);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('PRAZO DE ENTREGA (DIAS):', margemEsquerda + 2, posicaoY + 4);
  pdf.text('DATA PREVISTA DE CHEGADA:', margemEsquerda + larguraMetade + 2, posicaoY + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(dados.prazoEntrega.toString() + ' dias', margemEsquerda + 2, posicaoY + 8);
  const dataPrevisao = new Date();
  dataPrevisao.setDate(dataPrevisao.getDate() + dados.prazoEntrega);
  pdf.text(formatarData(dataPrevisao), margemEsquerda + larguraMetade + 2, posicaoY + 8);

  posicaoY += 15;

  // Condições de Pagamento (dados reais da requisição)
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, 12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('CONDIÇÕES DE PAGAMENTO:', margemEsquerda + 2, posicaoY + 4);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  // Usaremos req_cond_pagto da requisição
  pdf.text(dados.observacoes || 'A combinar', margemEsquerda + 2, posicaoY + 8);

  posicaoY += 15;

  // SEÇÃO DE APROVAÇÃO - Profissional com mais espaço
  const alturaSecaoAprovacao = 50;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaSecaoAprovacao, 'F');
  pdf.setDrawColor(41, 84, 144);
  pdf.setLineWidth(1);
  pdf.rect(margemEsquerda, posicaoY, larguraPagina, alturaSecaoAprovacao);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('APROVAÇÃO E AUTORIZAÇÕES', margemEsquerda + 5, posicaoY + 8);

  // Campos de assinatura em linha - MAIOR ESPAÇO
  const larguraAssinatura = larguraPagina / 3;
  const alturaAssinatura = 35;
  pdf.rect(margemEsquerda, posicaoY + 12, larguraAssinatura, alturaAssinatura);
  pdf.rect(margemEsquerda + larguraAssinatura, posicaoY + 12, larguraAssinatura, alturaAssinatura);
  pdf.rect(margemEsquerda + 2 * larguraAssinatura, posicaoY + 12, larguraAssinatura, alturaAssinatura);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  // Linhas de assinatura mais embaixo para dar espaço
  pdf.line(margemEsquerda + 5, posicaoY + 40, margemEsquerda + larguraAssinatura - 5, posicaoY + 40);
  pdf.line(margemEsquerda + larguraAssinatura + 5, posicaoY + 40, margemEsquerda + 2 * larguraAssinatura - 5, posicaoY + 40);
  pdf.line(margemEsquerda + 2 * larguraAssinatura + 5, posicaoY + 40, margemEsquerda + 3 * larguraAssinatura - 5, posicaoY + 40);

  // Nomes abaixo das linhas de assinatura
  pdf.text('SOLICITANTE', margemEsquerda + larguraAssinatura/2, posicaoY + 44, { align: 'center' });
  pdf.text('GERENTE DE COMPRAS', margemEsquerda + larguraAssinatura + larguraAssinatura/2, posicaoY + 44, { align: 'center' });
  pdf.text('DIRETOR FINANCEIRO', margemEsquerda + 2 * larguraAssinatura + larguraAssinatura/2, posicaoY + 44, { align: 'center' });

  // RODAPÉ PROFISSIONAL
  posicaoY += alturaSecaoAprovacao + 10;
  pdf.setDrawColor(41, 84, 144);
  pdf.setLineWidth(0.5);
  pdf.line(margemEsquerda, posicaoY, margemEsquerda + larguraPagina, posicaoY);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  
  const dataGeracao = new Date().toLocaleString('pt-BR');
  pdf.text(`Documento gerado automaticamente pelo Sistema Melo Peças em ${dataGeracao}`, margemEsquerda, posicaoY + 5);
  pdf.text('Este documento possui validade legal e pode ser utilizado para fins comerciais e fiscais.', margemEsquerda, posicaoY + 9);

  return Buffer.from(pdf.output('arraybuffer'));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID da ordem é obrigatório' });
  }

  try {
    const dadosOrdem = await buscarDadosOrdem(id);

    if (!dadosOrdem) {
      return res.status(404).json({ message: 'Ordem de compra não encontrada' });
    }

    const pdfBuffer = gerarPDF(dadosOrdem);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ordem-compra-${dadosOrdem.numeroOC}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}