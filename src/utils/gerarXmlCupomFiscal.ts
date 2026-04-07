import { create } from 'xmlbuilder2';
import { getSefazUrl } from './sefazUrls';

/**
 * Gera XML para Cupom Fiscal Eletrônico (NFC-e) - Modelo 65
 * Diferente da NF-e (modelo 55), o cupom fiscal é usado para vendas ao consumidor final
 */

// CONFIGURAÇÃO DO AMBIENTE
// 1 = Produção, 2 = Homologação
const AMBIENTE_NFCE = process.env.NEXT_PUBLIC_AMBIENTE_NFCE || process.env.AMBIENTE_NFCE || '2'; // Default homologação

/**
 * Determina o ambiente SEFAZ baseado na configuração
 * @returns 'PRODUCAO' ou 'HOMOLOGACAO'
 */
export function getAmbienteSefaz(): 'PRODUCAO' | 'HOMOLOGACAO' {
  return AMBIENTE_NFCE === '1' ? 'PRODUCAO' : 'HOMOLOGACAO';
}

/**
 * Obtém a URL SEFAZ correta baseada no ambiente e tipo de serviço
 * @param tipo Tipo do serviço SEFAZ
 * @returns URL completa do serviço
 */
export function getUrlSefazAtual(tipo: keyof typeof import('./sefazUrls').SEFAZ_AM_URLS.HOMOLOGACAO): string {
  const ambiente = getAmbienteSefaz();
  return getSefazUrl(ambiente, tipo);
}

/**
 * Validação específica para ambiente de homologação da SEFAZ-AM
 * Conforme documentação: https://portal.fazenda.am.gov.br/nfe/
 * 
 * Para homologação, a SEFAZ exige:
 * 1. Emitente: Usar dados de teste (CNPJ/IE fictícios)
 * 2. Cliente: CPF 01234567890 (11 dígitos, sempre)
 * 3. CSC (Código de Segurança): "0123456789" 
 * 4. ID Token CSC: "000001"
 * 5. Produtos devem conter "TESTE" ou "HOMOLOGACAO" no nome
 * 
 * NOTA: CSC e ID Token são configurados na API (emitir-cupom.ts)
 */
function ajustarDadosParaHomologacao(dados: any) {
  console.log(`🔧 ajustarDadosParaHomologacao - INÍCIO`);
  console.log(`🔧 AMBIENTE_NFCE = "${AMBIENTE_NFCE}" (tipo: ${typeof AMBIENTE_NFCE})`);
  const ambienteSefaz = getAmbienteSefaz();
  console.log(`🔧 Ambiente SEFAZ determinado: ${ambienteSefaz}`);
  console.log(`🔧 Condição para homologação: ${ambienteSefaz === 'HOMOLOGACAO'}`);
  
  if (ambienteSefaz === 'HOMOLOGACAO') {
    console.log('✅ ENTRANDO na lógica de HOMOLOGAÇÃO...');
    console.log('🔧 Dados originais do cliente:', {
      nome: dados.cliente?.nome,
      cpfcgc: dados.cliente?.cpfcgc
    });
    
    // 🏢 Ajustar dados do EMITENTE para homologação
    // IMPORTANTE: Com certificado digital real, o CNPJ E IE devem corresponder ao cadastro na SEFAZ
    // Apenas razão social é alterada para indicar ambiente de teste
    if (dados.emitente) {
      const cnpjOriginal = dados.emitente.cgc;
      const ieOriginal = dados.emitente.inscricaoestadual;
      const nomeOriginal = dados.emitente.nomecontribuinte;
      
      // ❌ NÃO substituir CNPJ quando usar certificado digital real
      // dados.emitente.cgc = '99999999000191'; // Comentado: causa erro 213
      // dados.emitente.cnpj = '99999999000191'; // Comentado: causa erro 213
      
      // ✅ CORREÇÃO: Manter nome real do emitente - apenas indicar teste no endereço
      // dados.emitente.nomecontribuinte = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
      
      // Manter endereço válido mas indicar teste
      if (!dados.emitente.logradouro) {
        dados.emitente.logradouro = 'RUA TESTE HOMOLOGACAO';
        dados.emitente.numero = '0';
        dados.emitente.bairro = 'TESTE';
        dados.emitente.cep = '69000000';
      }
      
      console.log(`🏢 EMITENTE ajustado para teste (CNPJ e IE reais mantidos):`);
      console.log(`   CNPJ: ${cnpjOriginal} (mantido - match com certificado)`);
      console.log(`   IE: ${ieOriginal} (mantida - SEFAZ valida credenciamento)`);
      console.log(`   Nome: ${nomeOriginal} (mantido - nome real da empresa)`);
    }
    
    // 👤 Ajustar dados do cliente/destinatário para homologação
    if (dados.cliente) {
      console.log('✅ dados.cliente existe, ajustando...');
      const cpfOriginal = dados.cliente.cpfcgc || dados.cliente.cpf_cnpj_cli;
      const nomeOriginal = dados.cliente.nome || dados.cliente.nomefant;
      
      console.log('📝 Aplicando ajustes no cliente...');
      dados.cliente.cpfcgc = '01234567890'; // CPF de teste obrigatório (11 dígitos)
      dados.cliente.cpf_cnpj_cli = '01234567890';
      // ✅ CORREÇÃO: Usar nome padrão de homologação para destinatário
      dados.cliente.nome = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
      dados.cliente.nomefant = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
      
      console.log('🔧 Dados do cliente APÓS ajuste:', {
        nome: dados.cliente.nome,
        cpfcgc: dados.cliente.cpfcgc
      });
    } else {
      console.log('❌ dados.cliente NÃO existe! Criando...');
      dados.cliente = {
        cpfcgc: '01234567890',
        cpf_cnpj_cli: '01234567890',
        nome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
        nomefant: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      };
    }
    
    // Ajustar nome dos produtos conforme regras SEFAZ homologação
    // REGRA: Primeiro item DEVE ter descrição exata exigida pela SEFAZ
    if (dados.produtos && Array.isArray(dados.produtos)) {
      dados.produtos = dados.produtos.map((produto: any, index: number) => {
        // Primeiro item: descrição obrigatória SEFAZ
        if (index === 0) {
          return {
            ...produto,
            descricao: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
          };
        }
        // Demais itens: adicionar indicação de teste se não tiver
        if (!produto.descricao?.toUpperCase().includes('TESTE') && 
            !produto.descricao?.toUpperCase().includes('HOMOLOGACAO')) {
          return {
            ...produto,
            descricao: `${produto.descricao} - TESTE HOMOLOGACAO`
          };
        }
        return produto;
      });
      console.log(`📦 Produto 1: Descrição SEFAZ obrigatória aplicada`);
      console.log(`📦 ${dados.produtos.length - 1} produto(s) adicional(is) marcado(s) como teste`);
    }
    
    console.log('✅ Dados ajustados para homologação (CSC será configurado na API)');
  } else {
    console.log('🏭 Ambiente de PRODUÇÃO - usando dados reais');
  }
  
  return dados;
}

// Função para calcular o dígito verificador (Módulo 11)
function calcularDV(chave: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i], 10) * peso;
    peso++;
    if (peso > 9) {
      peso = 2;
    }
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return (dv === 0 || dv === 10 || dv === 11) ? 0 : dv;
}

import { formatarDataHora } from './formatarDataHora';

// Função para formatar a data/hora no padrão exigido pela Sefaz (com fuso horário)
function formatarDataSefaz(data: Date): string {
  console.log('🕒 Data original:', data);
  const dataFormatada = formatarDataHora(data);
  console.log('🕒 Data formatada para XML:', dataFormatada);
  return dataFormatada;
}

export async function gerarXmlCupomFiscal(dados: any): Promise<string> {
  console.log('📝 Gerando XML do Cupom Fiscal (NFC-e - Modelo 65)...');
  console.log(`🌐 Ambiente: ${AMBIENTE_NFCE === '2' ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}`);
  console.log(`🔧 AMBIENTE_NFCE = "${AMBIENTE_NFCE}" (tipo: ${typeof AMBIENTE_NFCE})`);
  
  // Ajustar dados conforme ambiente
  dados = ajustarDadosParaHomologacao(dados);
  
  console.log('🔍 DEBUG - Dados após ajuste para homologação:');
  console.log('   Cliente nome:', dados.cliente?.nome);
  console.log('   Cliente CPF:', dados.cliente?.cpfcgc);
  console.log('   Ambiente detectado:', AMBIENTE_NFCE === '2' ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO');
  
  const {
    emitente,
    cliente,
    produtos,
    data,
    pedido,
    serie,
    totalProdutos,
    totalICMS,
    totalIPI,
    totalPIS,
    totalCOFINS,
    totalNF,
    desconto,
    acrescimo,
    frete,
    seguro,
    observacoes,
    // Novos campos IBS/CBS (Lei Complementar nº 214/2025)
    totalValorIBS,
    totalValorCBS,
    totalAliquotaIBS,
    totalAliquotaCBS,
  } = dados;

  const cUF = '13'; // Amazonas
  const dhEmi = new Date(data || new Date());
  const AAMM = dhEmi.getFullYear().toString().substring(2) + ('0' + (dhEmi.getMonth() + 1)).slice(-2);
  const CNPJ = emitente?.cnpj?.replace(/\D/g, '') ?? emitente?.cgc?.replace(/\D/g, '') ?? '';
  const mod = '65'; // 🎫 MODELO 65 = NFC-e (Cupom Fiscal)

  // ⚠️ VALIDAÇÃO CRÍTICA: IE e UF do emitente
  console.log('🔍 Validando IE:', {
    ie_original: emitente?.ie,
    inscricaoestadual: emitente?.inscricaoestadual,
    ie_depois_replace: emitente?.inscricaoestadual?.replace(/\D/g, '')
  });

  // CORREÇÃO: Usar inscricaoestadual ao invés de ie
  const ieEmitente = emitente?.inscricaoestadual?.replace(/\D/g, '') ?? '';
  const ufEmitente = 'AM'; // Fixo AM pois é SEFAZ-AM
  
  if (!ieEmitente) {
    throw new Error('Inscrição Estadual (IE) do emitente está vazia. Verifique o cadastro da empresa.');
  }
  
  // Validação específica para IE do Amazonas (9 dígitos)
  if (!/^\d{9}$/.test(ieEmitente)) {
    throw new Error(`IE inválida: ${ieEmitente}. Para o Amazonas, deve ter 9 dígitos numéricos.`);
  }
  
  console.log('✅ IE validada:', ieEmitente);

  // CORREÇÃO: A série SEMPRE vem de dbfatura.serie (pode ser alfanumérica: AA, AB, 1, etc)
  const serieNF = serie || '1';
  
  console.log(`🔍 [gerarXmlCupomFiscal] Série recebida:`, serieNF, `(tipo: ${typeof serieNF})`);
  
  // CORREÇÃO: Garantir 9 dígitos para nNF (requisito SEFAZ-AM)
  const numeroNFInt = parseInt(pedido || '1', 10);
  const numeroNF = String(numeroNFInt); // Para XML: valor sem zeros à esquerda
  const nNFChave = String(numeroNFInt).padStart(9, '0'); // Para chave: 9 dígitos com zeros à esquerda
  
  console.log(`🔄 Número NFC-e (nNF): ${numeroNF} (XML - sem zeros à esquerda)`);
  console.log(`🔑 nNF para chave: ${nNFChave} (9 dígitos com zeros à esquerda)`);
  console.log(`📋 Valor original do pedido: ${pedido}`);
  
  // 🚨 LOG CRÍTICO: Série e IE para diagnóstico
  console.log('');
  console.log('🔍 ========== VERIFICAÇÃO CRÍTICA SEFAZ ==========');
  console.log(`📌 CNPJ: ${CNPJ}`);
  console.log(`📌 Série sendo enviada: "${serieNF}"`);
  console.log(`📌 IE (Inscrição Estadual): ${ieEmitente || '⚠️  VAZIA/INVÁLIDA!'}`);
  console.log(`📌 IE original (antes de limpar): ${emitente?.ie || 'undefined'}`);
  console.log(`📌 UF: ${emitente?.enderEmit?.UF ?? 'NÃO INFORMADA'}`);
  console.log('⚠️  ATENÇÃO: SEFAZ vincula CNPJ + SÉRIE + IE');
  console.log('⚠️  Se a IE estiver vazia ou diferente, haverá rejeição!');
  console.log('🔍 ================================================');
  console.log('');

  // Preparar série para chave de acesso
  let serieChave: string;
  if (/^\d+$/.test(serieNF)) {
    serieChave = ('000' + serieNF).slice(-3);
  } else {
    let codigoSerie = 0;
    for (let i = 0; i < serieNF.length; i++) {
      codigoSerie += serieNF.charCodeAt(i);
    }
    serieChave = String(codigoSerie % 1000).padStart(3, '0');
    console.log(`🔄 Série alfanumérica "${serieNF}" convertida para código numérico: ${serieChave}`);
  }
  
  const tpEmis = '1'; // Tipo de emissão: 1 = Normal

  // CORREÇÃO: cNF (Código Numérico) - SEMPRE 8 dígitos
  // Gerar cNF único combinando número do pedido + aleatório
  const parte1 = String(numeroNFInt).padStart(4, '0').slice(-4);
  const parte2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const cNF = parte1 + parte2;

  // Validação: garantir que cNF tem exatamente 8 dígitos numéricos
  if (cNF.length !== 8 || !/^\d{8}$/.test(cNF)) {
    throw new Error(`cNF deve ter 8 dígitos numéricos. Valor gerado: ${cNF} (${cNF.length} dígitos)`);
  }

  console.log(`🔑 Componentes da chave de acesso:`, {
    cUF,
    AAMM,
    CNPJ: CNPJ.substring(0, 8) + '...',
    mod,
    serie: serieChave,
    numeroNFe: nNFChave,
    tpEmis,
    cNF,
    cNF_length: cNF.length,
    cNF_parte1: parte1,
    cNF_parte2: parte2,
    nota: 'cNF único para evitar duplicidade em retry'
  });
  
  // Montar chave de acesso (44 dígitos)
  // Garantir que o CNPJ tem 14 dígitos
  const CNPJChave = CNPJ.padStart(14, '0');
  if (CNPJChave.length !== 14) {
    throw new Error(`CNPJ inválido: ${CNPJChave} (${CNPJChave.length} dígitos - deve ter 14)`);
  }
  
  const chaveAcesso = cUF + AAMM + CNPJChave + mod + serieChave + nNFChave + tpEmis + cNF;
  const cDV = calcularDV(chaveAcesso);
  const chaveCompleta = chaveAcesso + cDV;
  
  console.log('🔍 Componentes da chave:');
  console.log('  cUF:', cUF, `(${cUF.length} dígitos - deve ter 2)`);
  console.log('  AAMM:', AAMM, `(${AAMM.length} dígitos - deve ter 4)`);
  console.log('  CNPJ:', CNPJChave, `(${CNPJChave.length} dígitos - deve ter 14)`);
  console.log('  mod:', mod, `(${mod.length} dígitos - deve ter 2)`);
  console.log('  serieChave:', serieChave, `(${serieChave.length} dígitos - deve ter 3)`);
  console.log('  nNFChave:', nNFChave, `(${nNFChave.length} dígitos - deve ter 9)`);
  console.log('  tpEmis:', tpEmis, `(${tpEmis.length} dígito - deve ter 1)`);
  console.log('  cNF:', cNF, `(${cNF.length} dígitos - deve ter 8)`);
  console.log('  cDV:', cDV, `(${String(cDV).length} dígito - deve ter 1)`);
  console.log('🔑 Chave de acesso (44 dígitos):', chaveCompleta, `(${chaveCompleta.length} caracteres)`);
  
  if (chaveCompleta.length !== 44) {
    console.error('❌ ERRO: Chave de acesso com tamanho incorreto!');
    console.error('   Esperado: 44 dígitos');
    console.error('   Recebido:', chaveCompleta.length, 'dígitos');
    console.error('   Chave:', chaveCompleta);
    throw new Error(`Chave de acesso inválida: ${chaveCompleta.length} dígitos (deve ter 44)`);
  }
  
  // CPF do cliente (OPCIONAL em NFC-e)
  const cpfCliente = cliente?.cpfcgc?.replace(/\D/g, '') || '';
  const temCPF = cpfCliente.length === 11;
  
  console.log('👤 Informações do Consumidor:');
  console.log('   CPF:', temCPF ? cpfCliente : 'Não informado');
  console.log('   Nome:', cliente?.nome || 'Não informado');
  console.log('   Tipo:', 'Consumidor Final (NFC-e)');
  
  // Criar XML da NFC-e (SEM nfeProc - isso é adicionado depois da autorização)
  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  
  // Garantir namespace correto na raiz NFe
  const nfe = doc.ele('NFe', { 
    xmlns: 'http://www.portalfiscal.inf.br/nfe'
  });
  
  // Versão em infNFe (sem namespace - já está definido em NFe)
  const infNFe = nfe.ele('infNFe', {
    versao: '4.00',
    Id: `NFe${chaveCompleta}`
  });

  // Identificação - Específico para NFC-e (Modelo 65)
  // Ordem rigorosa conforme schema XSD
  const ide = infNFe.ele('ide');
  // Grupo B. Identificação da Nota Fiscal eletrônica
  ide.ele('cUF').txt(cUF).up()                    // B02
     .ele('cNF').txt(cNF).up()                    // B03
     .ele('natOp').txt('VENDA CONSUMIDOR').up()   // B04
     .ele('mod').txt(mod).up()                    // B06
     .ele('serie').txt(serieNF).up()             // B07
     .ele('nNF').txt(numeroNF).up()              // B08
     .ele('dhEmi').txt(formatarDataSefaz(dhEmi)).up() // B09
     .ele('tpNF').txt('1').up()                  // B11
     .ele('idDest').txt('1').up()               // B11a
     .ele('cMunFG').txt('1302603').up()         // B12
     .ele('tpImp').txt('4').up()                // B21
     .ele('tpEmis').txt(tpEmis).up()           // B22
     .ele('cDV').txt(String(cDV)).up()         // B23
     .ele('tpAmb').txt(AMBIENTE_NFCE).up()     // B24 - 1=Produção, 2=Homologação
     .ele('finNFe').txt('1').up()              // B25
     .ele('indFinal').txt('1').up()            // B25a
     .ele('indPres').txt('1').up()             // B25b
     .ele('procEmi').txt('1').up()             // B26
     .ele('verProc').txt('4.00').up()           // B27
     .up();

  // Emitente
  const emit = infNFe.ele('emit');
  emit.ele('CNPJ').txt(CNPJ).up();
  emit.ele('xNome').txt(emitente?.nomecontribuinte || '').up();
  // xFant é opcional - só incluir se existir
  if (emitente?.nomecontribuinte) {
    emit.ele('xFant').txt(emitente.nomecontribuinte).up();
  }
  
  const enderEmit = emit.ele('enderEmit');
  enderEmit.ele('xLgr').txt(emitente?.logradouro || '').up();
  enderEmit.ele('nro').txt(emitente?.numero || '').up();
  enderEmit.ele('xBairro').txt(emitente?.bairro || '').up();
  enderEmit.ele('cMun').txt('1302603').up();
  enderEmit.ele('xMun').txt('Manaus').up();
  enderEmit.ele('UF').txt('AM').up();
  enderEmit.ele('CEP').txt(emitente?.cep?.replace(/\D/g, '') || '').up();
  // cPais e xPais são opcionais - removidos
  enderEmit.up();
  
  // IE - se vazio, usar "ISENTO"
  const ie = emitente?.inscricaoestadual?.replace(/\D/g, '');
  emit.ele('IE').txt(ieEmitente).up(); // Usando IE já validada anteriormente
  // 🆕 CRT dinâmico: obtido automaticamente da ReceitaWS ou cadastro
  emit.ele('CRT').txt(emitente?.crt || '1').up(); // Fallback para '1' se não informado
  emit.up();

  // Destinatário - Simplificado para NFC-e (consumidor final)
  const dest = infNFe.ele('dest');
  console.log('📝 CRIANDO XML DEST - cliente.nome:', cliente?.nome);
  console.log('📝 CRIANDO XML DEST - cliente.cpfcgc:', cliente?.cpfcgc);
  if (temCPF) {
    // CPF é opcional em NFC-e - só incluir se foi informado
    dest.ele('CPF').txt(cpfCliente).up();
    // Nome é opcional mesmo com CPF em NFC-e
    if (cliente?.nome) {
      console.log('📝 ADICIONANDO xNome ao XML:', cliente.nome);
      dest.ele('xNome').txt(cliente.nome).up();
    }
  }
  // Sempre indica Não Contribuinte em NFC-e
  dest.ele('indIEDest').txt('9').up();
  dest.up();

  // Produtos
  let itemNum = 1;
  // Determinar CRT para saber qual estrutura de ICMS usar
  const crt = emitente?.crt || '1';
  const isSimples = crt === '1' || crt === '2'; // 1 = Simples Nacional, 2 = Simples Excesso
  
  for (const prod of produtos) {
    const det = infNFe.ele('det', { nItem: String(itemNum) });
    const prodEle = det.ele('prod');
    
    prodEle.ele('cProd').txt(prod.codigo || '').up();
    // ✅ CORREÇÃO erro 883: SEFAZ-AM exige "SEM GTIN" quando não há código de barras
    prodEle.ele('cEAN').txt('SEM GTIN').up();
    // Usar descrição ajustada pela função ajustarDadosParaHomologacao
    // Primeiro item DEVE ser "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
    prodEle.ele('xProd').txt(prod.descricao || 'PRODUTO TESTE').up();
    // ✅ Usar NCM real do produto
    prodEle.ele('NCM').txt(prod.ncm || '84714900').up();
    prodEle.ele('CFOP').txt(prod.cfop || '5102').up();
    prodEle.ele('uCom').txt(prod.unidade || 'UN').up();
    // SEFAZ-AM: Exige EXATAMENTE 4 casas decimais, sem arredondamento
    const qCom = Number(prod.quantidade || 1).toFixed(4);
    const vUnCom = Number(prod.valorUnitario || 0).toFixed(4);
    const vProd = Number(prod.valorTotal || 0).toFixed(2);
    
    // Validar se manteve as 4 casas
    if (!qCom.match(/^\d+\.\d{4}$/) || !vUnCom.match(/^\d+\.\d{4}$/)) {
      throw new Error(`Valores precisam ter exatamente 4 casas decimais: qCom=${qCom}, vUnCom=${vUnCom}`);
    }
    
    prodEle.ele('qCom').txt(qCom).up();
    prodEle.ele('vUnCom').txt(vUnCom).up();
    prodEle.ele('vProd').txt(vProd).up();
    // ✅ CORREÇÃO erro 883: SEFAZ-AM exige "SEM GTIN" quando não há código de barras
    prodEle.ele('cEANTrib').txt('SEM GTIN').up();
    prodEle.ele('uTrib').txt(prod.unidade || 'UN').up();
    prodEle.ele('qTrib').txt(Number(prod.quantidade || 1).toFixed(4)).up();
    prodEle.ele('vUnTrib').txt(Number(prod.valorUnitario || 0).toFixed(4)).up();
    prodEle.ele('indTot').txt('1').up();
    prodEle.up();

    // ✅ IMPOSTOS - Estrutura baseada no CRT (igual NF-e)
    const imposto = det.ele('imposto');
    
    // Valor total de tributos aproximados (Lei da Transparência)
    const vTotTrib = (
      Number(prod.icms?.vICMS ?? 0) + 
      Number(prod.pis?.vPIS ?? 0) + 
      Number(prod.cofins?.vCOFINS ?? 0)
    ).toFixed(2);
    imposto.ele('vTotTrib').txt(vTotTrib).up();
    
    // ICMS baseado no CRT
    const icms = imposto.ele('ICMS');
    if (isSimples) {
      // Simples Nacional - usar CSOSN
      const icmssn = icms.ele('ICMSSN102');
      icmssn.ele('orig').txt('0').up();
      icmssn.ele('CSOSN').txt('102').up(); // 102 = Tributada sem permissão de crédito
      icmssn.up();
    } else {
      // Regime Normal - usar CST com valores reais
      const icms00 = icms.ele('ICMS00');
      icms00.ele('orig').txt('0').up();
      icms00.ele('CST').txt(prod.icms?.cstICMS ?? '00').up();
      icms00.ele('modBC').txt('3').up(); // 3 = Valor da operação
      icms00.ele('vBC').txt(Number(prod.icms?.baseICMS ?? prod.valorTotal ?? 0).toFixed(2)).up();
      icms00.ele('pICMS').txt(Number(prod.icms?.pICMS ?? 0).toFixed(2)).up();
      icms00.ele('vICMS').txt(Number(prod.icms?.vICMS ?? 0).toFixed(2)).up();
      icms00.up();
    }
    icms.up();
    
    // PIS com valores reais
    const pis = imposto.ele('PIS');
    const cstPIS = prod.pis?.cstPIS ?? '01';
    if (['04', '05', '06', '07', '08', '09'].includes(cstPIS)) {
      // CSTs não tributados
      const pisnt = pis.ele('PISNT');
      pisnt.ele('CST').txt(cstPIS).up();
      pisnt.up();
    } else {
      // CSTs tributados - incluir base, alíquota e valor
      const pisAliq = pis.ele('PISAliq');
      pisAliq.ele('CST').txt(cstPIS).up();
      pisAliq.ele('vBC').txt(Number(prod.pis?.vBC ?? prod.valorTotal ?? 0).toFixed(2)).up();
      pisAliq.ele('pPIS').txt(Number(prod.pis?.pPIS ?? 0).toFixed(4)).up();
      pisAliq.ele('vPIS').txt(Number(prod.pis?.vPIS ?? 0).toFixed(2)).up();
      pisAliq.up();
    }
    pis.up();
    
    // COFINS com valores reais
    const cofins = imposto.ele('COFINS');
    const cstCOFINS = prod.cofins?.cstCOFINS ?? '01';
    if (['04', '05', '06', '07', '08', '09'].includes(cstCOFINS)) {
      // CSTs não tributados
      const cofinsnt = cofins.ele('COFINSNT');
      cofinsnt.ele('CST').txt(cstCOFINS).up();
      cofinsnt.up();
    } else {
      // CSTs tributados - incluir base, alíquota e valor
      const cofinsAliq = cofins.ele('COFINSAliq');
      cofinsAliq.ele('CST').txt(cstCOFINS).up();
      cofinsAliq.ele('vBC').txt(Number(prod.cofins?.vBC ?? prod.valorTotal ?? 0).toFixed(2)).up();
      cofinsAliq.ele('pCOFINS').txt(Number(prod.cofins?.pCOFINS ?? 0).toFixed(4)).up();
      cofinsAliq.ele('vCOFINS').txt(Number(prod.cofins?.vCOFINS ?? 0).toFixed(2)).up();
      cofinsAliq.up();
    }
    cofins.up();
    // NOTA: IPI NAO e permitido em NFC-e (modelo 65)
    // O IPI so existe para NF-e modelo 55 (venda entre empresas)
    // Se incluir IPI em NFC-e, a SEFAZ rejeita com erro 215 (Falha no schema XML)
    // Da mesma forma, tags IBS e CBS ainda causam erro de schema se o ambiente não estiver atualizado.
    // Por enquanto, manter apenas nos dados adicionais/PDF.

    imposto.up(); // Fecha imposto
    det.up(); // Fecha det
    itemNum++;
  }

  // Totais - usar valores reais calculadosss
  const vBCTotal = isSimples ? '0.00' : Number(totalProdutos || 0).toFixed(2);
  const vICMSTotal = isSimples ? '0.00' : Number(totalICMS || 0).toFixed(2);
  
  const total = infNFe.ele('total').ele('ICMSTot');
  total.ele('vBC').txt(vBCTotal).up();
  total.ele('vICMS').txt(vICMSTotal).up();
  total.ele('vICMSDeson').txt('0.00').up();
  total.ele('vFCP').txt('0.00').up();
  total.ele('vBCST').txt('0.00').up();
  total.ele('vST').txt('0.00').up();
  total.ele('vFCPST').txt('0.00').up();
  total.ele('vFCPSTRet').txt('0.00').up();
  total.ele('vProd').txt(Number(totalProdutos || 0).toFixed(2)).up();
  total.ele('vFrete').txt(Number(frete || 0).toFixed(2)).up();
  total.ele('vSeg').txt(Number(seguro || 0).toFixed(2)).up();
  total.ele('vDesc').txt(Number(desconto || 0).toFixed(2)).up();
  total.ele('vII').txt('0.00').up();
  total.ele('vIPI').txt(Number(totalIPI || 0).toFixed(2)).up();        // Total IPI calculado
  total.ele('vIPIDevol').txt('0.00').up();   // Sempre zero em NFC-e
  total.ele('vPIS').txt(Number(totalPIS || 0).toFixed(2)).up();        // Total PIS calculado
  total.ele('vCOFINS').txt(Number(totalCOFINS || 0).toFixed(2)).up();     // Total COFINS calculado
  total.ele('vOutro').txt(Number(acrescimo || 0).toFixed(2)).up();
  total.ele('vNF').txt(Number(totalNF || 0).toFixed(2)).up();
  total.up().up();

  // Transporte - NFC-e DEVE usar modFrete=9 (sem frete)
  infNFe.ele('transp').ele('modFrete').txt('9').up().up(); // 9 = Sem frete (obrigatório para NFC-e)

  // Pagamento (obrigatório e detalhado em NFC-e)
  const pag = infNFe.ele('pag');
  
  // vTroco deve ser informado apenas se houver troco
  const valorPago = Number(totalNF || 0);
  const troco = 0; // Se houver troco, calcular aqui
  
  // Detalhamento do pagamento
  const detPag = pag.ele('detPag');
  detPag.ele('tPag').txt('01').up() // 01 = Dinheiro
        .ele('vPag').txt(valorPago.toFixed(2)).up();
  
  // Adicionar tBand e CNPJ da credenciadora apenas se for cartão
  if (false) { // Adaptar conforme necessidade
    detPag.ele('tBand').txt('01').up() // 01 = Visa
          .ele('cAut').txt('1234567890').up(); // Número da autorização
  }
  detPag.up();
  
  // Troco (obrigatório para SEFAZ-AM, mesmo sendo zero)
  pag.ele('vTroco').txt('0.00').up();
  pag.up();

  // Informações Adicionais com IBS/CBS
  const infAdic = infNFe.ele('infAdic');
  
  // Mensagens de interesse do Fisco
  infAdic.ele('infAdFisco')
         .txt('DOCUMENTOS REFERENCIADOS NO PORTAL DA NOTA FISCAL ELETRONICA')
         .up();
  
  // 🆕 Observação obrigatória IBS/CBS (Lei Complementar nº 214/2025)
  const aliquotaIBS = Number(totalAliquotaIBS || 0.1).toFixed(1);
  const aliquotaCBS = Number(totalAliquotaCBS || 0.9).toFixed(1);
  const valorIBS = Number(totalValorIBS || 0).toFixed(2);
  const valorCBS = Number(totalValorCBS || 0).toFixed(2);
  
  const obsIBSCBS = `VALORES REFERENTES AO IBS (${aliquotaIBS}%) E CBS (${aliquotaCBS}%) CALCULADOS PARA FINS DE TRANSIÇÃO E APRENDIZADO, CONFORME LEI COMPLEMENTAR Nº 214/2025. ESTES VALORES NÃO COMPÕEM O TOTAL DA OPERAÇÃO NESTE PERÍODO. VALOR IBS: R$ ${valorIBS} | VALOR CBS: R$ ${valorCBS}`;
  
  // Combinar observações do usuário com a observação IBS/CBS
  const obsCompleta = observacoes?.trim() && observacoes !== '.' && observacoes !== ''
    ? `${observacoes.trim()} | ${obsIBSCBS}`
    : obsIBSCBS;
  
  // Mensagens de interesse do Contribuinte
  infAdic.ele('infCpl')
         .txt(obsCompleta)
         .up();
  infAdic.up();

  // ✅ RESPONSÁVEL TÉCNICO - Obrigatório para NFC-e na SEFAZ-AM (erro 972)
  const infRespTec = infNFe.ele('infRespTec');
  infRespTec.ele('CNPJ').txt('18053139000169').up()  // CNPJ do desenvolvedor
            .ele('xContato').txt('Lucas Melo').up()    // Nome do contato
            .ele('email').txt('lucas@melopecas.com.br').up() // Email do responsável
            .ele('fone').txt('92999999999').up();       // Telefone (apenas números)
  infRespTec.up();

  // Fecha infNFe
  infNFe.up();

  // ⚠️ IMPORTANTE: QR Code e URL (infNFeSupl) serão adicionados após a assinatura
  // Veja adicionarQRCodeNFCe.ts

  // Gera o XML sem quebras de linha ou espaços extras
  const xml = doc.end({ 
    prettyPrint: false,
    indent: '',
    newline: ''
  });
  
  // Validações finais antes de retornar o XML
  const validacoes = {
    ie: ieEmitente && ieEmitente.length >= 9,
    uf: ufEmitente === 'AM',
    chave: chaveCompleta.length === 44,
    modelo: mod === '65',
    // QR Code e infNFeSupl serão adicionados depois da assinatura
  };

  console.log('🔍 Validações finais do XML:');
  Object.entries(validacoes).forEach(([key, value]) => {
    console.log(`  ${value ? '✅' : '❌'} ${key}`);
  });

  if (!Object.values(validacoes).every(v => v)) {
    throw new Error('XML inválido: falhou nas validações finais');
  }

  console.log('✅ XML do Cupom Fiscal (NFC-e) gerado com sucesso');
  console.log('📄 Tamanho do XML:', xml.length, 'caracteres');
  
  return xml;
}
