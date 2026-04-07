import axios from 'axios';
import https from 'https';
import { SEFAZ_AM_URLS } from './sefazUrls';
const dotenv = require('dotenv');
dotenv.config();
interface EnvioSefazParams {
  xmlAssinado: string;
  certificadoKey: string;
  certificadoCrt: string;
  cadeiaCrt?: string;
}

// Função para testar conectividade da URL
async function testarConectividade(url: string, timeout = 5000): Promise<boolean> {
  try {
    console.log(`🔍 Testando conectividade: ${url}`);
    
    // Para serviços SOAP, devemos fazer POST com envelope SOAP mínimo
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header/>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
      <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>2</tpAmb>
        <cServ>AM</cServ>
        <cUF>13</cUF>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
    
    const response = await axios.post(url, soapEnvelope, {
      timeout,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': '',
        'User-Agent': 'NFC-e System Diagnostic'
      }
    });

    // Se chegou aqui, a URL está acessível
    console.log(`✅ URL acessível (SOAP): ${url}`);
    return true;
    
  } catch (error: any) {
    console.log(`❌ URL indisponível: ${url} (${error.code || error.message})`);
    return false;
  }
}

// Função para tentar envio via API REST (caso SEFAZ tenha migrado)
async function tentarEnvioREST(xmlAssinado: string, certificadoKey: string, certificadoCrt: string, cadeiaCrt?: string): Promise<string> {
  console.log('� Tentando envio via API REST...');
  
  const urlRest = SEFAZ_AM_URLS.HOMOLOGACAO.NFCE_REST;
  
  try {
    // Para API REST, o XML vai no body como JSON
    const payload = {
      xml: xmlAssinado,
      ambiente: '2', // Homologação
      versao: '4.00'
    };
    
    const response = await axios.post(urlRest, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + Buffer.from(certificadoCrt).toString('base64'), // Exemplo
      },
      timeout: 30000
    });
    
    console.log('✅ Envio REST bem-sucedido!');
    return response.data;
    
  } catch (error: any) {
    console.log('❌ API REST também falhou:', error.message);
    throw error;
  }
}

// Função para corrigir data/hora no QR Code
function corrigirDataHoraQRCode(xml: string): string {
  return xml.replace(
    /<qrCode><!\[CDATA\[(.*?)\]\]><\/qrCode>/,
    (match, url) => {
      // Extrair dhEmi da URL
      const dhEmiMatch = url.match(/dhEmi=(\d{8}T\d+)/);
      
      if (dhEmiMatch) {
        const dhEmiOriginal = dhEmiMatch[1];
        
        // Sempre remover o hífen se existir
        // Formato correto: AAAAMMDDTHHMMSSTHHMM
        // Exemplo: 20251022T1438570400
        if (dhEmiOriginal.includes('-')) {
          console.log('⚠️ Removendo hífen da data/hora no QR Code:', dhEmiOriginal);
          
          // Remover o hífen
          const corrigido = dhEmiOriginal.replace(/-/g, '');
          
          url = url.replace(dhEmiOriginal, corrigido);
          console.log('✅ Data/hora QR Code corrigida:', corrigido);
        }
      }
      
      return `<qrCode><![CDATA[${url}]]></qrCode>`;
    }
  );
}

// Função para limpar namespace duplicado na tag NFe
function limparNamespaceNFe(xml: string): string {
  // A tag NFe deve ter xmlns APENAS UMA VEZ
  // Remover declaração XML se existir
  let limpo = xml.replace(/<\?xml[^>]*\?>/, '').trim();
  
  // Garantir que NFe tenha namespace apenas uma vez
  limpo = limpo.replace(
    /<NFe[^>]*>/,
    '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">'
  );
  
  return limpo;
}

// Função para formatar XML removendo espaços
function compactarXML(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\r?\n/g, '')
    .trim();
}

// Função principal para preparar XML para SEFAZ
function prepararXMLParaSefaz(xmlAssinado: string): string {
  console.log('🔧 Preparando XML para SEFAZ...');
  
  let xml = xmlAssinado;
  
  // 1. Corrigir data/hora no QR Code
  xml = corrigirDataHoraQRCode(xml);
  
  // 2. Limpar namespace duplicado
  xml = limparNamespaceNFe(xml);
  
  // 3. Compactar (remover espaços)
  xml = compactarXML(xml);
  
  console.log('✅ XML preparado');
  return xml;
}

// Função para criar envelope SOAP exatamente como SEFAZ espera
function criarEnvelopeSOAP(xmlEnviNFe: string): string {
  // Importante: NÃO adicionar declaração XML no envelope
  // A SEFAZ-AM espera o envelope SEM <?xml...?>
  const envelope = 
    '<soap:Envelope ' +
    'xmlns:soap="http://www.w3.org/2003/05/soap-envelope" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
    '<soap:Header/>' +
    '<soap:Body>' +
    '<nfeAutorizacaoLote xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
    '<nfeDadosMsg>' +
    xmlEnviNFe +
    '</nfeDadosMsg>' +
    '</nfeAutorizacaoLote>' +
    '</soap:Body>' +
    '</soap:Envelope>';
  
  return envelope;
}

// Função para logar detalhes do XML para debug
function logarDetalhesXML(xml: string): void {
  console.log('\n📋 ANÁLISE DO XML:');
  console.log('================================================================================');
  
  const checks = {
    'Tem namespace NFe': xml.includes('xmlns="http://www.portalfiscal.inf.br/nfe"'),
    'Tem Signature': xml.includes('<Signature'),
    'Tem namespace Signature': xml.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"'),
    'Tem QR Code': xml.includes('<qrCode>'),
    'Tem CDATA': xml.includes('<![CDATA['),
    'Tem infNFeSupl': xml.includes('<infNFeSupl>'),
    'Modelo 65': xml.includes('<mod>65</mod>'),
    'Versão 4.00': xml.includes('versao="4.00"')
  };
  
  Object.entries(checks).forEach(([nome, valor]) => {
    console.log(`${valor ? '✅' : '❌'} ${nome}`);
  });
  
  // Verificar formato da data no QR Code
  const dhEmiMatch = xml.match(/dhEmi=(\d{8}T\d+)/);
  if (dhEmiMatch) {
    const dhEmi = dhEmiMatch[1];
    const formatoCorreto = /^\d{8}T\d{6}[-+]\d{4}$/.test(dhEmi);
    console.log(`${formatoCorreto ? '✅' : '❌'} Formato dhEmi QR Code: ${dhEmi}`);
  }
  
  console.log('================================================================================\n');
}

export async function enviarCupomParaSefaz(
  xmlAssinado: string,
  certificadoKey: string,
  certificadoCrt: string,
  cadeiaCrt?: string
): Promise<string> {
  console.log('📤 Iniciando envio para SEFAZ-AM...');
  console.log('📄 Tamanho do XML original:', xmlAssinado.length, 'caracteres');
  
  // Validações básicas
  if (!xmlAssinado.includes('<Signature')) {
    throw new Error('❌ XML não está assinado digitalmente');
  }
  
  if (!xmlAssinado.includes('<mod>65</mod>')) {
    throw new Error('❌ XML não é modelo 65 (NFC-e)');
  }
  
  if (!xmlAssinado.includes('<infNFeSupl>')) {
    throw new Error('❌ XML não contém infNFeSupl (QR Code)');
  }
  
  // Preparar XML
  const xmlPreparado = prepararXMLParaSefaz(xmlAssinado);
  
  // Logar análise
  logarDetalhesXML(xmlPreparado);
  
  // Criar estrutura enviNFe
  const idLote = Date.now().toString().substring(0, 15);
  
  // IMPORTANTE: enviNFe NÃO deve ter namespace duplicado
  // O namespace já está na tag NFe interna
  const xmlEnviNFe = 
    '<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00" idLote="' + idLote + '">' +
    '<indSinc>1</indSinc>' +
    xmlPreparado +
    '</enviNFe>';
  
  // Criar envelope SOAP
  const envelope = criarEnvelopeSOAP(xmlEnviNFe);
  
  console.log('🔢 ID do Lote:', idLote);
  console.log('📏 Tamanho do envelope SOAP:', envelope.length, 'caracteres');
  
  // Salvar envelope para debug (primeiros 1000 caracteres)
  console.log('\n📋 ENVELOPE SOAP (preview):');
  console.log(envelope.substring(0, 1000) + '...');
  console.log('\n');
  
  // Preparar certificado - usando configuração simples como na NF-e
  const agent = new https.Agent({
    key: Buffer.from(certificadoKey),
    cert: Buffer.from(certificadoCrt),
    ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
    rejectUnauthorized: false,
  });
  
  // URLs SEFAZ-AM Homologação (URLs oficiais atualizadas)
  const urlsSefaz = [
    SEFAZ_AM_URLS.HOMOLOGACAO.NFCE_AUTORIZACAO,  // URL oficial principal
    SEFAZ_AM_URLS.HOMOLOGACAO.NFCE_ALT1,         // URL alternativa
    SEFAZ_AM_URLS.PRODUCAO.NFCE_AUTORIZACAO,     // Produção como último recurso
  ];
  
  console.log('🌐 Enviando para SEFAZ-AM...');
  console.log('� Ambiente: Homologação (tpAmb=2)');
  
  // Testar conectividade das URLs
  let urlSefaz = null;
  for (const url of urlsSefaz) {
    console.log(`� Testando conectividade: ${url}`);
    const conectividadeOk = await testarConectividade(url);
    if (conectividadeOk) {
      urlSefaz = url;
      console.log(`✅ URL funcional encontrada: ${url}`);
      break;
    } else {
      console.log(`❌ URL indisponível: ${url}`);
    }
  }
  
  if (!urlSefaz) {
    throw new Error('❌ Nenhuma URL da SEFAZ-AM está acessível no momento');
  }
  
  console.log('🔗 URL selecionada:', urlSefaz);
  
  // Implementar retry com a URL selecionada
  let lastError: any = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${maxRetries}...`);
      
      const response = await axios.post(urlSefaz, envelope, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
          'Content-Length': Buffer.byteLength(envelope, 'utf8')
        },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('✅ Resposta recebida com sucesso!');
      console.log('📊 Status HTTP:', response.status);
      console.log('📋 Resposta SEFAZ (preview):', response.data.substring(0, 500));
      
      return response.data;
      
    } catch (error: any) {
      lastError = error;
      console.log(`❌ Tentativa ${attempt}/${maxRetries} falhou:`, error.code || error.message);
      
      if (error.response) {
        console.error('📊 Status HTTP:', error.response.status);
        console.error('📋 Resposta SEFAZ:', error.response.data?.substring(0, 500) + '...');
      }
      
      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`⏳ Aguardando ${waitTime}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // Se todas as tentativas SOAP falharam, tentar API REST
  console.error('\n❌ Todas as URLs SOAP falharam. Tentando API REST...');
  
  try {
    return await tentarEnvioREST(xmlAssinado, certificadoKey, certificadoCrt, cadeiaCrt);
  } catch (restError: any) {
    console.error('❌ API REST também falhou');
    throw new Error(`Erro SEFAZ: Todas as APIs (SOAP e REST) falharam. Último erro: ${lastError.response?.status || 'desconhecido'}: ${lastError.message}`);
  }
}