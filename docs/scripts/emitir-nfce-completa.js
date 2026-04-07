#!/usr/bin/env node

// Script completo para emissão de NFC-e
// Execute: node scripts/emitir-nfce-completa.js

const { Pool } = require('pg');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

async function emitirNFCeCompleta() {
  console.log('🧾 SISTEMA COMPLETO DE EMISSÃO NFC-E\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // ==========================================
      // 1. BUSCAR DADOS DA EMPRESA E CERTIFICADO
      // ==========================================
      console.log('1️⃣ 🔍 Buscando dados da empresa...');

      const empresa = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          inscricaoestadual,
          logradouro,
          numero,
          complemento,
          bairro,
          municipio,
          uf,
          cep,
          telefone,
          email,
          "certificadoKey",
          "certificadoCrt",
          "cadeiaCrt",
          csc_nfce_homologacao,
          csc_nfce_id
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoCrt" IS NOT NULL
        LIMIT 1
      `);

      if (empresa.rows.length === 0) {
        throw new Error('❌ Nenhum certificado encontrado na empresa');
      }

      const dadosEmpresa = empresa.rows[0];
      console.log(`✅ Empresa: ${dadosEmpresa.nomecontribuinte}`);
      console.log(`✅ CNPJ: ${dadosEmpresa.cgc.trim()}`);
      console.log(`✅ IE: ${dadosEmpresa.inscricaoestadual}`);
      console.log('');

      // ==========================================
      // 2. BUSCAR DADOS DA FATURA PARA EMITIR
      // ==========================================
      console.log('2️⃣ 📄 Buscando dados da fatura...');

      // Simular busca de uma fatura (você pode passar o codfat como parâmetro)
      const codfat = process.argv[2] || '12345'; // Recebe codfat como argumento

      const fatura = await client.query(`
        SELECT
          f.codfat,
          f.codcli,
          f.totalfat,
          c.nome as nome_cliente,
          c.cpfcgc as cpf_cliente
        FROM db_manaus.dbfatura f
        LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
        WHERE f.codfat = $1
        LIMIT 1`, [codfat]);

      if (fatura.rows.length === 0) {
        throw new Error(`❌ Fatura ${codfat} não encontrada`);
      }

      const dadosFatura = fatura.rows[0];
      console.log(`✅ Fatura: ${dadosFatura.codfat}`);
      console.log(`✅ Cliente: ${dadosFatura.nome_cliente}`);
      console.log(`✅ Valor: R$ ${dadosFatura.totalfat}`);
      console.log('');

      // ==========================================
      // 3. BUSCAR ITENS DA FATURA
      // ==========================================
      console.log('3️⃣ 📦 Buscando itens da fatura...');

      const itens = await client.query(`
        SELECT
          i.codprod,
          p.descr,
          i.qtd,
          i.prunit,
          i.qtd * i.prunit as total,
          p.unimed as unidade
        FROM db_manaus.dbitvenda i
        LEFT JOIN db_manaus.dbprod p ON i.codprod = p.codprod
        WHERE i.cod_fat = $1
        ORDER BY i.seq`, [codfat]);

      console.log(`✅ ${itens.rows.length} itens encontrados`);
      itens.rows.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.descricao} - Qtd: ${item.quantidade} x R$ ${item.preco_unitario}`);
      });
      console.log('');

      // ==========================================
      // 4. GERAR XML DA NFC-E
      // ==========================================
      console.log('4️⃣ 📝 Gerando XML da NFC-e...');

      const xmlNFCe = gerarXMLNFCe(dadosEmpresa, dadosFatura, itens.rows);
      console.log('✅ XML gerado com sucesso');
      console.log('');

      // ==========================================
      // 5. ASSINAR DIGITALMENTE O XML
      // ==========================================
      console.log('5️⃣ ✍️ Assinando XML digitalmente...');

      // Limpar XML para conformidade SEFAZ antes da assinatura
      const xmlLimpo = cleanXMLForSEFAZ(xmlNFCe);

      const xmlAssinado = await assinarXML(xmlLimpo, dadosEmpresa.certificadoKey, dadosEmpresa.certificadoCrt);
      console.log('✅ XML assinado com sucesso');
      console.log('');

      // ==========================================
      // 6. GERAR QR CODE
      // ==========================================
      console.log('6️⃣ 📱 Gerando QR Code...');

      // Extrair digest value da assinatura para o QR Code
      const digestMatch = xmlAssinado.match(/<DigestValue>([^<]*)<\/DigestValue>/);
      const digestValue = digestMatch ? digestMatch[1] : '';

      const qrCodeData = gerarQRCode(xmlAssinado, dadosEmpresa, digestValue);

      // Inserir QR Code no XML
      const xmlComQRCode = xmlAssinado.replace('</infNFe>', `<infNFeSupl><qrCode><![CDATA[${qrCodeData}]]></qrCode><urlChave>https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp</urlChave></infNFeSupl></infNFe>`);

      console.log('✅ QR Code gerado');
      console.log('');

      // ==========================================
      // 7. ENVIAR PARA SEFAZ-AM
      // ==========================================
      console.log('7️⃣ 📤 Enviando para SEFAZ-AM...');

      const respostaSefaz = await enviarParaSefaz(xmlComQRCode, dadosEmpresa);
      console.log('✅ Resposta recebida da SEFAZ');
      console.log('');

      // ==========================================
      // 8. PROCESSAR RESPOSTA
      // ==========================================
      console.log('8️⃣ 🔍 Processando resposta...');

      const resultado = processarRespostaSefaz(respostaSefaz);

      if (resultado.sucesso) {
        console.log('🎉 NFC-E AUTORIZADA COM SUCESSO!');
        console.log(`📄 Número: ${resultado.numero}`);
        console.log(`🔢 Série: ${resultado.serie}`);
        console.log(`🆔 Chave: ${resultado.chave}`);
        console.log(`📊 Protocolo: ${resultado.protocolo}`);

        // Salvar resultado no banco
        await salvarResultadoEmissao(client, codfat, resultado);

      } else {
        console.log('❌ NFC-E REJEITADA');
        console.log(`💬 Motivo: ${resultado.motivo}`);
        console.log(`🔢 Código: ${resultado.codigo}`);
      }

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error) {
    console.error('❌ ERRO NA EMISSÃO:', error.message);
    process.exit(1);
  }
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function gerarXMLNFCe(empresa, fatura, itens) {
  const cnpj = empresa.cgc.trim().replace(/[^\d]/g, '');
  const dataHora = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">';

  // infNFe
  xml += `<infNFe versao="4.00" Id="NFe${gerarChaveNFe(empresa, fatura)}">`;

  // ide
  xml += '<ide>';
  xml += '<cUF>13</cUF>'; // Amazonas
  xml += '<cNF>12345678</cNF>';
  xml += '<natOp>Venda</natOp>';
  xml += '<mod>65</mod>'; // NFC-e
  xml += '<serie>1</serie>';
  xml += '<nNF>1</nNF>';
  xml += `<dhEmi>${dataHora.replace(' ', 'T')}-04:00</dhEmi>`;
  xml += '<tpNF>1</tpNF>';
  xml += '<idDest>1</idDest>';
  xml += '<cMunFG>1302603</cMunFG>';
  xml += '<tpImp>4</tpImp>';
  xml += '<tpEmis>1</tpEmis>';
  xml += '<cDV>0</cDV>';
  xml += '<tpAmb>2</tpAmb>'; // Homologação
  xml += '<procEmi>0</procEmi>';
  xml += '<verProc>1.0</verProc>';
  xml += '</ide>';

  // emit
  xml += '<emit>';
  xml += `<CNPJ>${cnpj}</CNPJ>`;
  xml += `<xNome>${empresa.nomecontribuinte}</xNome>`;
  xml += `<xFant>EMPRESA TESTE</xFant>`;
  xml += '<enderEmit>';
  xml += `<xLgr>${empresa.logradouro}</xLgr>`;
  xml += `<nro>${empresa.numero}</nro>`;
  xml += `<xBairro>${empresa.bairro}</xBairro>`;
  xml += `<cMun>1302603</cMun>`;
  xml += `<xMun>${empresa.municipio}</xMun>`;
  xml += '<UF>AM</UF>';
  xml += `<CEP>${empresa.cep.replace(/\D/g, '')}</CEP>`;
  xml += '<cPais>1058</cPais>';
  xml += '<xPais>BRASIL</xPais>';
  xml += '</enderEmit>';
  xml += `<IE>${empresa.inscricaoestadual}</IE>`;
  xml += '<CRT>1</CRT>'; // Simples Nacional
  xml += '</emit>';

  // dest (se houver cliente identificado)
  if (fatura.cnpj_cliente) {
    xml += '<dest>';
    xml += `<CNPJ>${fatura.cnpj_cliente.replace(/\D/g, '')}</CNPJ>`;
    xml += `<xNome>${fatura.nome_cliente}</xNome>`;
    xml += '<enderDest>';
    xml += `<xLgr>${fatura.endereco_cliente || 'NÃO INFORMADO'}</xLgr>`;
    xml += '<nro>0</nro>';
    xml += `<xBairro>CENTRO</xBairro>`;
    xml += `<cMun>1302603</cMun>`;
    xml += `<xMun>${fatura.cidade_cliente || 'MANAUS'}</xMun>`;
    xml += `<UF>${fatura.estado_cliente || 'AM'}</UF>`;
    xml += '<CEP>69000000</CEP>';
    xml += '<cPais>1058</cPais>';
    xml += '<xPais>BRASIL</xPais>';
    xml += '</enderDest>';
    xml += `<indIEDest>9</indIEDest>`;
    xml += `<email>${empresa.email || ''}</email>`;
    xml += '</dest>';
  }

  // det (itens)
  itens.forEach((item, index) => {
    xml += `<det nItem="${index + 1}">`;
    xml += '<prod>';
    xml += `<cProd>${item.codprod}</cProd>`;
    xml += `<cEAN></cEAN>`;
    xml += `<xProd>${item.descricao}</xProd>`;
    xml += `<NCM>${item.ncm || '00000000'}</NCM>`;
    xml += `<CFOP>${item.cfop || '5102'}</CFOP>`;
    xml += `<uCom>${item.unidade || 'UN'}</uCom>`;
    xml += `<qCom>${parseFloat(item.quantidade).toFixed(4)}</qCom>`;
    xml += `<vUnCom>${parseFloat(item.preco_unitario).toFixed(10)}</vUnCom>`;
    xml += `<vProd>${parseFloat(item.preco_total).toFixed(2)}</vProd>`;
    xml += `<cEANTrib></cEANTrib>`;
    xml += `<uTrib>${item.unidade || 'UN'}</uTrib>`;
    xml += `<qTrib>${parseFloat(item.quantidade).toFixed(4)}</qTrib>`;
    xml += `<vUnTrib>${parseFloat(item.preco_unitario).toFixed(10)}</vUnTrib>`;
    xml += '<indTot>1</indTot>';
    xml += '</prod>';

    // impostos
    xml += '<imposto>';
    xml += '<ICMS>';
    xml += `<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>`;
    xml += '</ICMS>';
    xml += '<PIS>';
    xml += `<PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr>`;
    xml += '</PIS>';
    xml += '<COFINS>';
    xml += `<COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr>`;
    xml += '</COFINS>';
    xml += '</imposto>';
    xml += '</det>';
  });

  // total
  const valorTotal = itens.reduce((sum, item) => sum + parseFloat(item.preco_total), 0);
  xml += '<total>';
  xml += '<ICMSTot>';
  xml += '<vBC>0.00</vBC>';
  xml += '<vICMS>0.00</vICMS>';
  xml += '<vICMSDeson>0.00</vICMSDeson>';
  xml += '<vFCPUFDest>0.00</vFCPUFDest>';
  xml += '<vICMSUFDest>0.00</vICMSUFDest>';
  xml += '<vICMSUFRemet>0.00</vICMSUFRemet>';
  xml += `<vProd>${valorTotal.toFixed(2)}</vProd>`;
  xml += '<vFrete>0.00</vFrete>';
  xml += '<vSeg>0.00</vSeg>';
  xml += '<vDesc>0.00</vDesc>';
  xml += '<vII>0.00</vII>';
  xml += '<vIPI>0.00</vIPI>';
  xml += '<vIPIDevol>0.00</vIPIDevol>';
  xml += '<vPIS>0.00</vPIS>';
  xml += '<vCOFINS>0.00</vCOFINS>';
  xml += '<vOutro>0.00</vOutro>';
  xml += `<vNF>${valorTotal.toFixed(2)}</vNF>`;
  xml += '<vTotTrib>0.00</vTotTrib>';
  xml += '</ICMSTot>';
  xml += '</total>';

  // transp
  xml += '<transp>';
  xml += '<modFrete>9</modFrete>';
  xml += '</transp>';

  // pag
  xml += '<pag>';
  xml += '<detPag>';
  xml += '<tPag>01</tPag>';
  xml += `<vPag>${valorTotal.toFixed(2)}</vPag>`;
  xml += '</detPag>';
  xml += '</pag>';

  // infIntermed (se aplicável)
  // infRespTec (se aplicável)

  xml += '</infNFe>';
  xml += '</NFe>';

  return xml;
}

function gerarChaveNFe(empresa, fatura) {
  const cuf = '13'; // Amazonas
  const data = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // AAMMDD
  const cnpj = empresa.cgc.trim().replace(/\D/g, '');
  const mod = '65'; // NFC-e
  const serie = '001';
  const nnf = '000000001';
  const tpemis = '1';
  const cnf = '12345678';

  return cuf + data + cnpj + mod + serie + nnf + tpemis + cnf;
}

// Limpar XML para conformidade SEFAZ (remover espaços extras e caracteres problemáticos)
function cleanXMLForSEFAZ(xml) {
  console.log('🧹 Limpando XML para conformidade SEFAZ...');

  // Remover espaços em branco entre tags
  let cleanedXml = xml.replace(/>\s+</g, '><');

  // Remover quebras de linha desnecessárias
  cleanedXml = cleanedXml.replace(/\n\s*/g, '');

  // Garantir que o XML comece corretamente
  cleanedXml = cleanedXml.trim();

  console.log('✅ XML limpo para conformidade SEFAZ');
  return cleanedXml;
}

async function assinarXML(xml, chavePrivada, certificado) {
  console.log('🔐 Assinando XML NFC-e com SHA-256...');

  try {
    // Extrair infNFe
    const infNFeMatch = xml.match(/<infNFe[^>]*>([\s\S]*?)<\/infNFe>/);
    if (!infNFeMatch) {
      throw new Error('Não foi possível encontrar infNFe no XML');
    }

    const infNFeContent = infNFeMatch[1];
    const infNFeId = xml.match(/<infNFe[^>]*Id="([^"]*)"/)?.[1];

    if (!infNFeId) {
      throw new Error('ID do infNFe não encontrado');
    }

    console.log(`📋 ID para assinatura: ${infNFeId}`);

    // Canonicalizar o conteúdo
    const canonicalized = canonicalizeXML(infNFeContent);

    // Calcular digest SHA-256
    const digest = crypto.createHash('sha256').update(canonicalized, 'utf8').digest('base64');

    console.log(`🔢 Digest SHA-256: ${digest.substring(0, 20)}...`);

    // Assinar o digest
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(canonicalized, 'utf8');

    const signature = sign.sign({
      key: chavePrivada,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, 'base64');

    console.log(`✍️  Assinatura RSA-SHA256 gerada: ${signature.substring(0, 20)}...`);

    // Criar elemento Signature
    const signatureElement = createSignatureElement(infNFeId, digest, signature, certificado);

    // Inserir assinatura no XML
    const xmlAssinado = xml.replace(
      /<\/infNFe>/,
      `</infNFe>${signatureElement}`
    );

    console.log('✅ XML assinado com SHA-256');
    return xmlAssinado;

  } catch (error) {
    console.error('❌ Erro na assinatura:', error.message);
    throw error;
  }
}

// Canonicalizar XML (versão simplificada)
function canonicalizeXML(xml) {
  // Remover espaços entre tags
  return xml.replace(/>\s+</g, '><').trim();
}

// Criar elemento Signature
function createSignatureElement(infNFeId, digest, signature, certificado) {
  const now = new Date().toISOString();

  return `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
<SignedInfo>
<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
<Reference URI="#${infNFeId}">
<Transforms>
<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
</Transforms>
<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<DigestValue>${digest}</DigestValue>
</Reference>
</SignedInfo>
<SignatureValue>${signature}</SignatureValue>
<KeyInfo>
<X509Data>
<X509Certificate>${certificado.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '')}</X509Certificate>
</X509Data>
</KeyInfo>
</Signature>`;
}

function gerarQRCode(xml, empresa, digestValue = '') {
  console.log('📱 Gerando QR Code NFC-e...');

  // Extrair chave de acesso do XML
  const chaveMatch = xml.match(/Id="NFe([^"]*)"/);
  if (!chaveMatch) {
    throw new Error('Chave de acesso não encontrada no XML');
  }
  const chaveAcesso = chaveMatch[1];

  // Extrair valor total do XML
  const valorMatch = xml.match(/<vNF>([^<]*)<\/vNF>/);
  const valorTotal = valorMatch ? parseFloat(valorMatch[1]) : 0;

  const tpAmb = '2'; // 1=Produção, 2=Homologação
  const cDest = '74978004268'; // CPF do destinatário
  const dhEmi = new Date().toISOString().replace(/[:-]/g, '').substring(0, 12) + '-0400';
  const vNF = valorTotal.toFixed(2);
  const vICMS = '0.00';
  const digVal = digestValue || 'placeholder'; // Digest SHA-256 do XML
  const cIdToken = empresa.csc_nfce_id || '000001';

  // Calcular cHashQRCode (SHA-256 do QR Code sem o cHashQRCode)
  const qrCodeBase = `chNFe=${chaveAcesso}&nVersao=100&tpAmb=${tpAmb}&cDest=${cDest}&dhEmi=${dhEmi}&vNF=${vNF}&vICMS=${vICMS}&digVal=${digVal}&cIdToken=${cIdToken}`;
  const cHashQRCode = crypto.createHash('sha256').update(qrCodeBase, 'utf8').digest('hex').toUpperCase().substring(0, 8);

  const qrCode = `${qrCodeBase}&cHashQRCode=${cHashQRCode}`;

  console.log('✅ QR Code gerado com SHA-256');

  return qrCode;
}

async function enviarParaSefaz(xml, empresa) {
  // Configurar HTTPS agent
  const agent = new https.Agent({
    key: Buffer.from(empresa.certificadoKey),
    cert: Buffer.from(empresa.certificadoCrt),
    ca: empresa.cadeiaCrt ? Buffer.from(empresa.cadeiaCrt) : undefined,
    rejectUnauthorized: false,
    timeout: 30000
  });

  // Preparar envelope SOAP
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeAutorizacaoLote xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <nfeDadosMsg>
        ${xml}
      </nfeDadosMsg>
    </nfeAutorizacaoLote>
  </soap:Body>
</soap:Envelope>`;

  // Enviar para SEFAZ-AM
  const url = 'https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';

  try {
    const response = await axios.post(url, envelope, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
        'User-Agent': 'Sistema-Melo/1.0'
      },
      timeout: 60000
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    throw error;
  }
}

function processarRespostaSefaz(resposta) {
  // Extrair informações da resposta SOAP
  const match = resposta.match(/<xMotivo>(.*?)<\/xMotivo>/);
  const motivo = match ? match[1] : 'Resposta não identificada';

  const matchCodigo = resposta.match(/<cStat>(.*?)<\/cStat>/);
  const codigo = matchCodigo ? matchCodigo[1] : '0';

  const sucesso = codigo === '100' || codigo === '150'; // 100 = Autorizado, 150 = Autorizado com irregularidades

  let resultado = {
    sucesso,
    motivo,
    codigo
  };

  if (sucesso) {
    // Extrair dados da NFC-e autorizada
    const matchNumero = resposta.match(/<nNF>(.*?)<\/nNF>/);
    const matchSerie = resposta.match(/<serie>(.*?)<\/serie>/);
    const matchChave = resposta.match(/<chNFe>(.*?)<\/chNFe>/);
    const matchProtocolo = resposta.match(/<nProt>(.*?)<\/nProt>/);

    resultado.numero = matchNumero ? matchNumero[1] : '';
    resultado.serie = matchSerie ? matchSerie[1] : '';
    resultado.chave = matchChave ? matchChave[1] : '';
    resultado.protocolo = matchProtocolo ? matchProtocolo[1] : '';
  }

  return resultado;
}

async function salvarResultadoEmissao(client, codfat, resultado) {
  // Salvar resultado no banco de dados
  await client.query(`
    UPDATE db_manaus.dbfatura
    SET
      nfe_numero = $1,
      nfe_serie = $2,
      nfe_chave = $3,
      nfe_protocolo = $4,
      nfe_status = 'AUTORIZADA',
      nfe_data_emissao = CURRENT_TIMESTAMP
    WHERE codfat = $5
  `, [resultado.numero, resultado.serie, resultado.chave, resultado.protocolo, codfat]);

  console.log('💾 Resultado salvo no banco de dados');
}

// ==========================================
// EXECUÇÃO
// ==========================================

// Verificar argumentos
if (process.argv.length < 3) {
  console.log('📋 Uso: node scripts/emitir-nfce-completa.js <codfat>');
  console.log('📋 Exemplo: node scripts/emitir-nfce-completa.js 12345');
  process.exit(1);
}

emitirNFCeCompleta().then(() => {
  console.log('\n🎉 Processo de emissão concluído!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});