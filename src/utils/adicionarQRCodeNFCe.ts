import { DOMParser, XMLSerializer } from 'xmldom';
import crypto from 'crypto';

// CONFIGURAÇÃO DO AMBIENTE
// 1 = Produção, 2 = Homologação
const AMBIENTE_NFCE = process.env.NEXT_PUBLIC_AMBIENTE_NFCE || '2';

/**
 * Adiciona tag infNFeSupl com QR-Code ao XML da NFC-e
 * DEVE ser chamado DEPOIS da assinatura digital
 * 
 * Ordem correta: <infNFe> → <Signature> → <infNFeSupl>
 */
export function adicionarQRCodeNFCe(
  xmlAssinado: string,
  chaveAcesso: string,
  valorNF: string,
  cscId: string,
  cscToken: string,
  cpfDestinatario?: string,
  dataEmissao?: string
): string {
  console.log(`🌐 Ambiente QR Code: ${AMBIENTE_NFCE === '2' ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}`);
  
  const doc = new DOMParser().parseFromString(xmlAssinado, 'application/xml');
  
  // Encontrar a tag infNFe (não NFe)
  const infNFeElements = doc.getElementsByTagName('infNFe');
  if (!infNFeElements || infNFeElements.length === 0) {
    throw new Error('Tag infNFe não encontrada no XML');
  }
  
  const infNFeElement = infNFeElements[0];
  
  // Verificar se já existe infNFeSupl (evitar duplicação)
  const existingSupl = doc.getElementsByTagName('infNFeSupl');
  if (existingSupl && existingSupl.length > 0) {
    console.log('⚠️ infNFeSupl já existe no XML, pulando adição');
    return xmlAssinado;
  }
  
  // 🔍 EXTRAIR DIGEST VALUE DA ASSINATURA
  let digestValue = '';
  const digestElements = doc.getElementsByTagName('DigestValue');
  if (digestElements && digestElements.length > 0) {
    const digestText = digestElements[0].textContent;
    if (digestText) {
      digestValue = digestText.trim();
      console.log(`📋 DigestValue extraído da assinatura: ${digestValue.substring(0, 20)}...`);
    }
  }
  
  if (!digestValue) {
    throw new Error('DigestValue não encontrado na assinatura XML');
  }
  
  // Constantes para QR Code
  const tpAmb = AMBIENTE_NFCE; // Usa a variável de ambiente
  const nVersao = '100';
  const vICMS = '0.00';
  
  // ✅ NORMALIZAR DATA/HORA PARA O FORMATO CORRETO DO QR CODE
  // Formato SEFAZ: AAAAMMDDTHHMMSS±HHMM (ex: 20251022T143857-0400)
  let dataEmissaoNormalizada = '';
  
  if (dataEmissao) {
    try {
      console.log('🕒 Data/hora XML recebida:', dataEmissao);
      
      // Entrada esperada: 2025-10-22T14:38:57-04:00
      // Saída esperada para QR Code: 20251022T143857-0400 (COM O "T")
      
      // PASSO 1: Extrair o timezone ANTES de modificar a string
      const tzMatch = dataEmissao.match(/([+-]\d{2}):?(\d{2})$/);
      
      if (!tzMatch) {
        throw new Error('Timezone não encontrado na data de emissão');
      }
      
      const timezone = tzMatch[1] + tzMatch[2]; // Ex: -04:00 → -0400
      console.log('⏰ Timezone extraído:', timezone);
      
      // PASSO 2: Remover milissegundos se existir (.123)
      let dataLimpa = dataEmissao.replace(/\.\d{3}/, '');
      
      // PASSO 3: Remover timezone do final temporariamente
      dataLimpa = dataLimpa.replace(/[+-]\d{2}:\d{2}$/, '');
      
      // Agora dataLimpa = "2025-10-22T14:38:57"
      console.log('📅 Data sem timezone:', dataLimpa);
      
      // PASSO 4: Separar data e hora pelo "T"
      const [dataParte, horaParte] = dataLimpa.split('T');
      
      if (!dataParte || !horaParte) {
        throw new Error('Formato de data inválido, esperado AAAA-MM-DDTHH:MM:SS');
      }
      
      // PASSO 5: Remover separadores de data e hora (mas MANTER o T)
      const dataFormatada = dataParte.replace(/-/g, ''); // 20251022
      const horaFormatada = horaParte.replace(/:/g, '');  // 143857
      
      // PASSO 6: Juntar com T no meio e timezone no final
      // Formato: AAAAMMDDTHHMMSS±HHMM
      dataEmissaoNormalizada = `${dataFormatada}T${horaFormatada}${timezone}`;
      
      console.log('✅ Data/hora QR Code final:', dataEmissaoNormalizada);
      
      // VALIDAR formato final - COM o T
      if (!/^\d{8}T\d{6}[+-]\d{4}$/.test(dataEmissaoNormalizada)) {
        throw new Error(`Formato inválido após processamento: ${dataEmissaoNormalizada}`);
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao normalizar data para QR Code:', error.message);
      console.error('📋 Data recebida:', dataEmissao);
      throw new Error(`Data inválida para QR Code: ${dataEmissao} - ${error.message}`);
    }
  } else {
    // Se não foi fornecida data, gerar agora
    const agora = new Date();
    const ano = agora.getFullYear(); 
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    const segundo = String(agora.getSeconds()).padStart(2, '0');
    
    // Formato correto com T: AAAAMMDDTHHMMSS±HHMM
    dataEmissaoNormalizada = `${ano}${mes}${dia}T${hora}${minuto}${segundo}-0400`;
    console.log('📅 Data/hora gerada automaticamente:', dataEmissaoNormalizada);
  }
  
  console.log('📅 Data/hora normalizada FINAL para QR Code:', dataEmissaoNormalizada);
  
  // ✅ FORMATO AMAZONAS: hash = SHA1(chave|versao|tpAmb|idCSC+CSC)
  // Nota importante: idCSC DEVE MANTER o zero à esquerda no hash!
  // Exemplo: 13260104618302000189650010017020341203428588|2|2|010123456789
  // Onde: idCSC (COM zeros à esquerda) + CSC concatenados SEM PIPE
  
  const tpNF = '1'; // 1 = Saída (NFC-e sempre é saída)
  const indNFe = '1'; // Fixo = 1
  
  // CORREÇÃO: Formato NT 2016.002 = chave|versao|tpAmb|idCSC (COM pipe) + CSC (sem pipe)
  // idCSC mantém formato original do banco (exemplo: "1" ou "000001")
  // Concatena CSC direto após idCSC (SEM pipe entre idCSC e CSC)
  
  const dadosParaHash = [
    chaveAcesso,
    '2',  // Versão do QR Code (fixo = 2)
    tpAmb,  // 1=Produção, 2=Homologação
    cscId,  // idCSC como está no banco (exemplo: "1")
  ].join('|') + cscToken;  // CSC concatenado direto após o último pipe
  
  console.log(`🔐 Calculando hash QR-Code AM (CSC ID: ${cscId}, CSC presente: ${cscToken ? 'SIM' : 'NÃO'})`);
  console.log(`📋 String para hash: ${dadosParaHash}`);
  
  // Gerar SHA-1 - Formato Amazonas
  let cHashQRCode = 'HASH_PLACEHOLDER';
  if (cscToken) {
    const hash = crypto.createHash('sha1');
    hash.update(dadosParaHash, 'utf8');
    cHashQRCode = hash.digest('hex').toUpperCase();
    console.log(`✅ Hash QR-Code AM calculado: ${cHashQRCode.substring(0, 20)}...`);
  } else {
    console.warn('⚠️ CSC não fornecido - usando HASH_PLACEHOLDER (SERÁ REJEITADO!)');
  }
  
  // ✅ FORMATO NT 2016.002 - QR-Code versão 2 (emissão normal tpEmis=1)
  // URL: chave|nVersao|tpAmb|idCSC|cHashQRCode
  // Onde nVersao=2, e idCSC é o identificador do CSC (sem pipe entre idCSC e hash!)
  
  // Montar string para URL do QR Code (formato oficial NT 2016.002)
  const dadosQRCode = [
    chaveAcesso,
    '2',       // nVersao - versão do QR Code (fixo = 2)
    tpAmb,     // tpAmb - 1=Produção, 2=Homologação
    cscId,     // idCSC - identificador do CSC
    cHashQRCode
  ].join('|');
  
  // URL base conforme ambiente - AMAZONAS
  const urlBase = AMBIENTE_NFCE === '2' 
    ? 'https://sistemas.sefaz.am.gov.br/nfceweb-hom/consultarNFCe.jsp'   // Homologação
    : 'https://www.sefaz.am.gov.br/nfce/consulta';  // Produção
  
  const urlConsultaCompleta = `${urlBase}?p=${dadosQRCode}`;
  
  console.log(`🔗 URL QR Code AM (${AMBIENTE_NFCE === '2' ? 'HOM' : 'PROD'}): ${urlConsultaCompleta}`);
  
  console.log(`🔍 Tamanho da URL do QR Code: ${urlConsultaCompleta.length} caracteres`);
  
  // Validar tamanho (deve ter entre 100 e 600 caracteres segundo NT 2015.002)
  if (urlConsultaCompleta.length < 100 || urlConsultaCompleta.length > 600) {
    console.warn(`⚠️ URL do QR Code fora do padrão! Tamanho: ${urlConsultaCompleta.length} (esperado: 100-600)`);
  }
  
  // Criar elemento infNFeSupl
  const infNFeSupl = doc.createElement('infNFeSupl');
  
  // Criar qrCode com CDATA
  // IMPORTANTE: O CDATA protege os caracteres especiais da URL, incluindo &
  const qrCode = doc.createElement('qrCode');
  const cdataQrCode = doc.createCDATASection(urlConsultaCompleta.trim());
  qrCode.appendChild(cdataQrCode);
  infNFeSupl.appendChild(qrCode);
  //teste
  // Criar urlChave - formato AM (com protocolo https://)
  const urlChave = doc.createElement('urlChave');
  const urlChaveText = AMBIENTE_NFCE === '2'
    ? 'https://sistemas.sefaz.am.gov.br/nfceweb-hom/consultarNFCe.jsp'  // Homologação
    : 'https://www.sefaz.am.gov.br/nfce/consulta';      // Produção
  const textUrlChave = doc.createTextNode(urlChaveText);
  urlChave.appendChild(textUrlChave);
  infNFeSupl.appendChild(urlChave);
  
  // ⚠️ CRÍTICO NFC-e: infNFeSupl fica FORA do infNFe, entre infNFe e Signature
  // Estrutura: <NFe> → <infNFe>...</infNFe> → <infNFeSupl>...</infNFeSupl> → <Signature>
  
  // Encontrar o elemento NFe (pai de infNFe)
  const nfeElements = doc.getElementsByTagName('NFe');
  if (!nfeElements || nfeElements.length === 0) {
    throw new Error('Tag NFe não encontrada no XML');
  }
  const nfeElement = nfeElements[0];
  
  // Encontrar o elemento Signature
  const signatureElements = doc.getElementsByTagName('Signature');
  
  if (signatureElements && signatureElements.length > 0) {
    // Inserir infNFeSupl no NFe, ANTES de Signature (entre infNFe e Signature)
    const signatureElement = signatureElements[0];
    nfeElement.insertBefore(infNFeSupl, signatureElement);
    console.log('✅ QR-Code (infNFeSupl) inserido entre infNFe e Signature (ordem correta NFC-e)');
  } else {
    // Se não houver Signature, adiciona no final do NFe
    nfeElement.appendChild(infNFeSupl);
    console.warn('⚠️ Signature não encontrada, infNFeSupl adicionado no final de NFe');
  }
  
  console.log('🔍 URL do QR Code antes da serialização:', urlConsultaCompleta);
  
  // Verificar se a data está correta na URL antes da serialização
  // Formato esperado: 20251107T180154-0400
  const dhEmiPreSerialization = urlConsultaCompleta.match(/dhEmi=([0-9T+-]+)/);
  if (dhEmiPreSerialization) {
    console.log('📅 Data/hora na URL antes da serialização:', dhEmiPreSerialization[1]);
  }
  
  // Serializar o documento
  const serializer = new XMLSerializer();
  let xmlFinal = serializer.serializeToString(doc);
  
  // Remover formatação extra
  xmlFinal = xmlFinal
    .replace(/\s+</g, '<')
    .replace(/>\s+/g, '>')
    .replace(/\r?\n/g, '');
  
  // CRÍTICO: Verificar se o CDATA está preservado corretamente
  if (!xmlFinal.includes('<![CDATA[')) {
    console.error('❌ CDATA foi removido durante a serialização!');
    throw new Error('Erro na serialização: CDATA não preservado');
  }
  
  // ✅ Validar QR Code no formato Amazonas (com pipes)
  // Formato: https://sistemas.sefaz.am.gov.br/nfceweb-hom/consultarNFCe.jsp?p=CHAVE|TPAMB|TPNF|1|HASH
  console.log('🔍 Verificando QR Code no formato AM (com pipes)...');
  const qrCodeFormatAM = xmlFinal.match(/(nfce\/consulta|consultarNFCe\.jsp)\?p=\d{44}\|\d\|\d\|\d\|[A-F0-9]{40}/);
  if (qrCodeFormatAM) {
    console.log('✅ QR Code no formato correto AM (com pipes)');
  } else {
    console.warn('⚠️ QR Code pode estar em formato diferente do esperado (AM)');
  }
  
  // Logs detalhados do XML
  console.log('\n📋 DETALHES DO XML GERADO:');
  console.log('================================================================================');
  console.log('📝 XML Completo:');
  console.log(xmlFinal);
  console.log('================================================================================');
  console.log('📊 Informações do XML:');
  console.log(`- Tamanho total: ${xmlFinal.length} caracteres`);
  console.log(`- Possui Signature: ${xmlFinal.includes('<Signature')}`);
  console.log(`- Possui QR Code: ${xmlFinal.includes('<qrCode>')}`);
  console.log(`- Possui URL Consulta: ${xmlFinal.includes('<urlChave>')}`);
  
  console.log('================================================================================\n');
  
  return xmlFinal;
}