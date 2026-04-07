import { NextApiRequest, NextApiResponse } from 'next';
import { gerarPreviewCupomFiscal } from '@/utils/gerarPDFCupomFiscal';
import { getPgPool } from '@/lib/pg';
import { parseStringPromise } from 'xml2js';
import { create } from 'xmlbuilder2';
import { gerarXmlCupomFiscal } from '@/utils/gerarXmlCupomFiscal';
import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { adicionarQRCodeNFCe } from '@/utils/adicionarQRCodeNFCe';
import { decrypt } from '@/utils/crypto';
import { extrairCNPJDoCertificado } from '@/utils/certificadoExtractor';
import axios from 'axios';
import { SEFAZ_AM_URLS, getSefazUrl } from '@/utils/sefazUrls';
import { getAmbienteSefaz, getUrlSefazAtual } from '@/utils/gerarXmlCupomFiscal';
import https from 'https';
import { DOMParser } from 'xmldom';

const pool = getPgPool();

/**
 * API para emissão de Cupom Fiscal Eletrônico (NFC-e) - Modelo 65
 * Usado para vendas a consumidor final com CPF
 */

// Função para registrar erros/mensagens da emissão
async function registrarMensagemCupom(
  codfat: string,
  codigo: string,
  mensagem: string,
) {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    
    const msgExistente = await client.query(
      'SELECT codigo FROM db_manaus.dbmensagens WHERE codigo = $1',
      [codigo],
    );
    
    if (msgExistente.rowCount === 0) {
      await client.query(
        'INSERT INTO db_manaus.dbmensagens (codigo, mensagem) VALUES ($1, $2)',
        [codigo, mensagem],
      );
      console.log('✅ Mensagem inserida na dbmensagens:', codigo);
    }
    
    const relacaoExistente = await client.query(
      'SELECT codfat FROM db_manaus.dbmensagens_fatura WHERE codfat = $1 AND codmsg = $2',
      [codfat, codigo],
    );
    
    if (relacaoExistente.rowCount === 0) {
      await client.query(
        'INSERT INTO db_manaus.dbmensagens_fatura (codfat, codmsg) VALUES ($1, $2)',
        [codfat, codigo],
      );
      console.log('✅ Relação fatura-mensagem inserida');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao registrar mensagem da fatura:', error);
  } finally {
    client.release();
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('🚀 [NFC-e] Iniciando emissão de NFC-e (Modelo 65)');
  console.log('📋 [NFC-e] Endpoint:', req.url);
  console.log('📋 [NFC-e] Método:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  let xmlBruto = '';
  let xmlResposta = '';
  let codfat = '';

  try {
    console.log(
      '🎫 ========== INICIANDO EMISSÃO DE CUPOM FISCAL (NFC-e) ==========',
    );

    const dados = req.body;
    
    // 📋 LOG CRÍTICO: Documento do destinatário
    const documentoDestinatario = dados?.dbclien?.cpfcgc || dados?.dbclien?.cgc || 'NÃO INFORMADO';
    console.log('📋 [NFC-e] Documento do destinatário:', documentoDestinatario);
    console.log('📋 [NFC-e] Tipo esperado: CPF (NFC-e) ou CNPJ (NF-e)');
    
    if (documentoDestinatario !== 'NÃO INFORMADO') {
      const tipoDocumento = documentoDestinatario.length === 14 ? 'CNPJ' : documentoDestinatario.length === 11 ? 'CPF' : 'DESCONHECIDO';
      console.log('📋 [NFC-e] Tipo detectado:', tipoDocumento);
      if (tipoDocumento === 'CNPJ') {
        console.warn('⚠️ [NFC-e] ATENÇÃO: Documento CNPJ detectado, mas endpoint é para NFC-e!');
        console.warn('   Para CNPJ use: /api/faturamento/emitir');
      }
    }
    
    // Buscar fatura do banco se não veio no payload
    if (!dados?.dbfatura && dados?.codfat && pool) {
      console.log('⚠️ dbfatura não encontrado no payload. Buscando do banco com codfat:', dados.codfat);
      try {
        const result = await pool.query(
          'SELECT * FROM db_manaus.dbfatura WHERE codfat = $1 LIMIT 1',
          [dados.codfat]
        );
        
        if (result.rows && result.rows.length > 0) {
          dados.dbfatura = result.rows[0];
          console.log('✅ Fatura encontrada no banco');
        } else {
          console.log('❌ Fatura não encontrada no banco para codfat:', dados.codfat);
        }
      } catch (erroBusca: any) {
        console.error('❌ Erro ao buscar fatura do banco:', erroBusca.message);
      }
    }
    
    // Validações básicas
    if (!dados?.dbfatura?.codfat) {
      return res.status(400).json({ 
        erro: 'Dados da fatura não informados. Forneça dbfatura ou codfat válido.',
        sucesso: false 
      });
    }

    if (!dados?.dbclien) {
      return res.status(400).json({ 
        erro: 'Dados do cliente não informados',
        sucesso: false
      });
    }

    // Validação: NFC-e é apenas para CPF (não CNPJ)
    const documentoCliente = (dados.dbclien.cpfcgc || dados.dbclien.cnpj || '').replace(/\D/g, '');
    
    if (documentoCliente.length === 14) {
      return res.status(400).json({ 
        erro: 'Cliente com CNPJ não pode receber Cupom Fiscal. Use emissão de NF-e (Nota Fiscal).',
        sucesso: false
      });
    }

    codfat = dados.dbfatura.codfat;
    let serie = dados.dbfatura.serie || '2'; // Série 2 para NFC-e (padrão)
    
    // 🧪 TESTE: Em homologação, forçar série 1 (geralmente a série padrão cadastrada)
    // A variável AMBIENTE_NFCE será definida mais abaixo, então vamos verificar diretamente
    const ambienteTest = process.env.NEXT_PUBLIC_AMBIENTE_NFCE || '2';
    if (ambienteTest === '2' && serie === '2') {
      console.log('🧪 TESTE HOMOLOGAÇÃO: Alterando série 2 → 1 (série padrão)');
      serie = '1';
    }

    console.log('📋 Dados do cupom:', {
      codfat,
      serie,
      cliente: dados.dbclien.nome || dados.dbclien.nomefant,
      cpf: documentoCliente || 'não informado',
      valor: dados.total?.ICMSTot?.vNF
    });

    // 1️⃣ OBTER PRÓXIMO NÚMERO DO CUPOM
    let nroformEmissao = dados.dbfatura.nroform;
    const serieEmissao = serie;

    if (!nroformEmissao && pool) {
      console.log('⚠️ nroform não informado, buscando próximo número da série', serieEmissao);
      
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT MAX(numero) as ultimo_numero
           FROM (
             SELECT CAST(f.nroform AS INTEGER) as numero
             FROM db_manaus.dbfatura f
             WHERE f.serie = $1
               AND f.nroform IS NOT NULL
               AND f.nroform != ''
               AND f.nroform ~ '^[0-9]+$'
             
             UNION ALL
             
             SELECT CAST(nfe.nrodoc_fiscal AS INTEGER)
             FROM db_manaus.dbfat_nfe nfe
             INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
             WHERE f.serie = $1
               AND nfe.nrodoc_fiscal IS NOT NULL
               AND nfe.nrodoc_fiscal != ''
               AND nfe.nrodoc_fiscal ~ '^[0-9]+$'
               AND nfe.status IN ('100', '150', '301', '302', '303')
           ) AS todos_numeros`,
          [serieEmissao]
        );

        if (result.rows.length > 0 && result.rows[0].ultimo_numero !== null) {
          const ultimoNumero = parseInt(result.rows[0].ultimo_numero, 10);
          nroformEmissao = String(ultimoNumero + 1);
          console.log(`✅ Próximo número: ${nroformEmissao} (último: ${ultimoNumero})`);
        } else {
          nroformEmissao = '1';
          console.log(`✅ Começando do número 1`);
        }
      } finally {
        client.release();
      }
    }

    console.log(
      `📝 Número do cupom: ${nroformEmissao}, Série: ${serieEmissao}`,
    );

    // 2️⃣ BUSCAR DADOS DA EMPRESA E CERTIFICADOS (ANTES de gerar XML)
    console.log('🔐 Buscando dados da empresa e certificados digitais...');
    
    if (!pool) {
      throw new Error('Pool de conexão não disponível');
    }
    
    let certificadoKey = '';
    let certificadoCrt = '';
    let cadeiaCrt: string | null = null;
    let cscId = '1';
    let cscToken = '';
    
    // AMBIENTE: 1 = Produção, 2 = Homologação
    const AMBIENTE_NFCE = process.env.NEXT_PUBLIC_AMBIENTE_NFCE || '2';
    const isHomologacao = AMBIENTE_NFCE === '2';
    
    console.log(`🌐 Ambiente NFC-e: ${isHomologacao ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}`);
    
    const resultCert = await pool.query(
      `SELECT 
        "certificadoKey", 
        "certificadoCrt",
        "cadeiaCrt",
        csc_nfce_id,
        csc_nfce_homologacao,
        csc_nfce_producao,
        cgc,
        inscricaoestadual,
        nomecontribuinte,
        logradouro,
        numero,
        bairro,
        municipio,
        uf,
        cep,
        crt
      FROM db_manaus.dadosempresa 
      WHERE "certificadoKey" IS NOT NULL 
        AND "certificadoKey" != '' 
        AND "certificadoCrt" IS NOT NULL 
        AND "certificadoCrt" != ''
      ORDER BY cgc
      LIMIT 1`
    );
    
    if (resultCert.rows.length === 0) {
      throw new Error('Certificados digitais não encontrados na base de dados');
    }
    
    const empresa = resultCert.rows[0];
    
    // ✅ Preencher dados do emitente com dados REAIS do banco ANTES de gerar XML
    if (!dados.emitente) {
      dados.emitente = {};
    }
    dados.emitente.cgc = empresa.cgc;
    dados.emitente.cnpj = empresa.cgc; // Alias para compatibilidade
    dados.emitente.inscricaoestadual = empresa.inscricaoestadual;
    dados.emitente.nomecontribuinte = empresa.nomecontribuinte;
    dados.emitente.nomefantasia = empresa.nomecontribuinte;
    dados.emitente.logradouro = empresa.logradouro;
    dados.emitente.numero = empresa.numero;
    dados.emitente.bairro = empresa.bairro;
    dados.emitente.municipio = empresa.municipio;
    dados.emitente.uf = empresa.uf || 'AM';
    dados.emitente.cep = empresa.cep;
    dados.emitente.crt = empresa.crt || '3';
    
    console.log(`🏢 Dados do emitente carregados do banco:`);
    console.log(`   CNPJ: ${empresa.cgc}`);
    console.log(`   IE: ${empresa.inscricaoestadual}`);
    console.log(`   Nome: ${empresa.nomecontribuinte}`);
    console.log(`   CRT: ${empresa.crt}`);
    
    // Descriptografar certificados
    console.log('🔓 Descriptografando certificados...');
    const keyDecrypted = await decrypt(empresa.certificadoKey);
    const crtDecrypted = await decrypt(empresa.certificadoCrt);
    
    if (!keyDecrypted || !crtDecrypted) {
      throw new Error('Erro ao descriptografar certificados digitais');
    }
    
    // Validar CNPJ do certificado
    const cnpjCertificado = extrairCNPJDoCertificado(crtDecrypted);
    const cnpjEmpresa = empresa.cgc.replace(/\D/g, '');
    console.log(`Empresa ${empresa.cgc}: CNPJ certificado extraído: ${cnpjCertificado}, CNPJ empresa: ${cnpjEmpresa}`);
    
    if (!cnpjCertificado || cnpjCertificado !== cnpjEmpresa) {
      throw new Error(`Certificado não corresponde ao CNPJ da empresa. Certificado: ${cnpjCertificado}, Empresa: ${cnpjEmpresa}`);
    }
    
    certificadoKey = keyDecrypted;
    certificadoCrt = crtDecrypted;
    cadeiaCrt = empresa.cadeiaCrt ? await decrypt(empresa.cadeiaCrt) : null;
    
    // Carregar CSC
    if (isHomologacao) {
      if (empresa.csc_nfce_id && empresa.csc_nfce_homologacao) {
        cscId = empresa.csc_nfce_id;
        const cscDecrypted = await decrypt(empresa.csc_nfce_homologacao);
        if (cscDecrypted) {
          cscToken = cscDecrypted;
          console.log(`✅ CSC de HOMOLOGAÇÃO carregado (ID: ${cscId})`);
        } else {
          cscId = '1';
          cscToken = '0123456789';
          console.log('🔐 CSC de HOMOLOGAÇÃO (fallback): ID=1, Token=0123456789');
        }
      } else {
        cscId = '1';
        cscToken = '0123456789';
        console.log('🔐 CSC de HOMOLOGAÇÃO configurado (teste): ID=1, Token=0123456789');
      }
    } else {
      if (empresa.csc_nfce_id && empresa.csc_nfce_producao) {
        cscId = empresa.csc_nfce_id;
        const cscDecrypted = await decrypt(empresa.csc_nfce_producao);
        if (cscDecrypted) {
          cscToken = cscDecrypted;
          console.log(`✅ CSC de PRODUÇÃO carregado (ID: ${cscId})`);
        } else {
          throw new Error('CSC de produção não encontrado ou erro ao descriptografar');
        }
      } else {
        throw new Error('CSC de produção não configurado para a empresa');
      }
    }
    
    console.log('✅ Certificados carregados');

    // 3️⃣ PREPARAR PRODUTOS
    console.log('🔄 Normalizando dados do cupom fiscal...');
    
    const produtos = (dados.dbitvenda || []).map((item: any, index: number) => {
      const prod = item.dbprod ?? {};
      const qtde = Number(item.qtd ?? 1);
      const preco = Number(item.prunit ?? 0);
      const vProd = Math.round(qtde * preco * 100) / 100;

      // IMPOSTOS REAIS DO BANCO (aritmética de centavos) - igual NF-e
      const vICMS = Math.round(Number(item.totalicms ?? 0) * 100) / 100;
      const vPIS = Math.round(Number(item.valorpis ?? 0) * 100) / 100;
      const vCOFINS = Math.round(Number(item.valorcofins ?? 0) * 100) / 100;
      const baseICMS = Math.round(Number(item.baseicms ?? vProd) * 100) / 100;

      // Calcular percentuais (aritmética de centavos)
      const pICMS = vProd > 0 ? Math.round((vICMS / vProd) * 10000) / 100 : 0;
      const pPIS = vProd > 0 ? Math.round((vPIS / vProd) * 10000) / 100 : 0;
      const pCOFINS = vProd > 0 ? Math.round((vCOFINS / vProd) * 10000) / 100 : 0;

      // NOVA LEI TRIBUTÁRIA: IBS/CBS (igual NF-e)
      // IBS: normalmente 27% (estadual+municipal), CBS: normalmente 10% (federal)
      // Buscar do produto, item, ou usar padrão
      let aliquota_ibs = 27;
      let aliquota_cbs = 10;
      if (typeof item.aliquota_ibs === 'number') aliquota_ibs = item.aliquota_ibs;
      else if (typeof item.aliq_ibs === 'number') aliquota_ibs = item.aliq_ibs;
      else if (typeof prod.aliquota_ibs === 'number') aliquota_ibs = prod.aliquota_ibs;
      else if (typeof prod.aliq_ibs === 'number') aliquota_ibs = prod.aliq_ibs;

      if (typeof item.aliquota_cbs === 'number') aliquota_cbs = item.aliquota_cbs;
      else if (typeof item.aliq_cbs === 'number') aliquota_cbs = item.aliq_cbs;
      else if (typeof prod.aliquota_cbs === 'number') aliquota_cbs = prod.aliquota_cbs;
      else if (typeof prod.aliq_cbs === 'number') aliquota_cbs = prod.aliq_cbs;

      // REGRA HOMOLOGAÇÃO: primeiro produto com descrição padrão
      let descricao = prod.descr?.trim() || `Produto ${index + 1}`;
      if (index === 0) {
        descricao = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
      }

      return {
        codigo: item.codprod ?? `P${index + 1}`,
        descricao,
        ncm: /^[0-9]{8}$/.test(prod.clasfiscal) ? prod.clasfiscal : '84714900',
        cfop: item.cfop || '5102',
        unidade: prod.unimed || 'UN',
        quantidade: qtde,
        valorUnitario: preco,
        valorTotal: vProd,
        aliquota_ibs,
        aliquota_cbs,
        // ✅ NOVOS CAMPOS DE IMPOSTOS (estrutura igual NF-e)
        icms: {
          cstICMS: (item.csticms ?? '00').toString().padStart(2, '0').slice(-2),
          baseICMS: baseICMS,
          pICMS: pICMS,
          vICMS: vICMS,
        },
        pis: {
          cstPIS: item.cstpis ?? '01',
          vBC: vProd,
          pPIS: pPIS,
          vPIS: vPIS,
        },
        cofins: {
          cstCOFINS: item.cstcofins ?? '01',
          vBC: vProd,
          pCOFINS: pCOFINS,
          vCOFINS: vCOFINS,
        },
      };
    });
    
    // Calcular totais
    const totalProdutos = produtos.reduce((sum: number, p: any) => sum + p.valorTotal, 0);
    const totalICMS = produtos.reduce((sum: number, p: any) => sum + p.icms.vICMS, 0);
    const totalIPI = 0; // Sempre 0 para NFC-e
    const totalPIS = produtos.reduce((sum: number, p: any) => sum + p.pis.vPIS, 0);
    const totalCOFINS = produtos.reduce((sum: number, p: any) => sum + p.cofins.vCOFINS, 0);
    const totalNF = totalProdutos; // NFC-e: vNF = vProd (sem IPI)
    
    console.log(`📦 ${produtos.length} produto(s)`);
    console.log(`💰 Total NFC-e: R$ ${totalNF.toFixed(2)}`);
    
    // 4️⃣ GERAR XML DO CUPOM FISCAL
    console.log('🔄 Gerando XML do Cupom Fiscal (NFC-e)...');
    
    const xmlCupom = await gerarXmlCupomFiscal({
      emitente: dados.emitente,
      cliente: dados.dbclien,
      produtos: produtos,
      data: new Date(),
      pedido: nroformEmissao,
      serie: serieEmissao,
      totalProdutos: totalProdutos.toFixed(2),
      totalICMS: totalICMS.toFixed(2),
      totalIPI: totalIPI.toFixed(2),
      totalPIS: totalPIS.toFixed(2),
      totalCOFINS: totalCOFINS.toFixed(2),
      totalNF: totalNF.toFixed(2),
      desconto: '0.00',
      acrescimo: '0.00',
      frete: '0.00',
      seguro: '0.00',
      observacoes: dados.observacoes || '.',
    });

    // 🔍 DEBUG: Verificar modelo no XML gerado
    console.log('🔍 [DEBUG] Verificando modelo no XML NFC-e:');
    const modeloMatch = xmlCupom.match(/<mod>(\d+)<\/mod>/);
    console.log('🔍 [DEBUG] Modelo encontrado no XML:', modeloMatch ? modeloMatch[1] : 'NÃO ENCONTRADO');
    if (modeloMatch && modeloMatch[1] !== '65') {
      console.error('🚨 ERRO CRÍTICO: XML NFC-e gerado com modelo incorreto!');
      console.error('   Esperado: 65 (NFC-e), Encontrado:', modeloMatch[1]);
      throw new Error(`XML NFC-e gerado com modelo incorreto: ${modeloMatch[1]} (esperado: 65)`);
    }

    // 5️⃣ ASSINAR XML
    console.log('🔐 Assinando XML do cupom...');
    let xmlAssinado = await assinarXMLComCertificados(
      xmlCupom,
      'infNFe',
      certificadoKey,
      certificadoCrt,
    );
    
    // 6️⃣ ADICIONAR QR-CODE
    console.log('📱 Adicionando QR-Code ao cupom (infNFeSupl)...');
    
    const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
    const chaveAcesso = chaveMatch ? chaveMatch[1] : '';
    
    if (!chaveAcesso || chaveAcesso.length !== 44) {
      throw new Error(`Chave de acesso inválida: ${chaveAcesso}`);
    }
    
    // 🔧 AJUSTAR CPF PARA HOMOLOGAÇÃO (QR Code)
    // O XML já foi ajustado, mas o QR Code precisa usar o mesmo CPF
    let cpfCliente = documentoCliente;
    if (isHomologacao && cpfCliente.length === 11) {
      console.log(`🔧 QR Code: Ajustando CPF ${cpfCliente} → 01234567890 (teste)`);
      cpfCliente = '01234567890';
    }
    
    // ✅ EXTRAIR data/hora DO XML (não gerar nova)
    // Isso garante que o QR Code use EXATAMENTE a mesma data do XML
    const xmlDoc = new DOMParser().parseFromString(xmlAssinado, 'application/xml');
    const dhEmiElements = xmlDoc.getElementsByTagName('dhEmi');
    if (!dhEmiElements || dhEmiElements.length === 0) {
      throw new Error('Tag dhEmi não encontrada no XML');
    }
    const dataEmissao = dhEmiElements[0].textContent?.trim() || '';
    
    console.log('📅 Data/hora extraída do XML:', dataEmissao);
    
    xmlAssinado = adicionarQRCodeNFCe(
      xmlAssinado,
      chaveAcesso,
      totalNF.toFixed(2),
      cscId,
      cscToken,
      cpfCliente.length === 11 ? cpfCliente : undefined,
      dataEmissao
    );

    xmlBruto = xmlAssinado;

    // 7️⃣ CRIAR ENVELOPE SOAP (igual à NF-e)
    console.log('📤 Preparando envelope SOAP...');
    
    // ⚠️ IMPORTANTE: Remover declaração XML do xmlAssinado antes de incluir no envelope
    // A declaração <?xml...?> não pode estar dentro do SOAP
    const xmlSemDeclaracao = xmlAssinado.replace(/<\?xml[^?]*\?>\s*/gi, '');
    
    // Criar enviNFe para NFC-e
    // NFC-e single exige indSinc=1 (síncrono) na maioria dos estados
    const idLote = '000000000000001'; // Mesmo idLote fixo da NF-e
    const xmlEnviNFe = 
      '<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
      '<idLote>' + idLote + '</idLote>' +
      '<indSinc>1</indSinc>' +
      xmlSemDeclaracao +
      '</enviNFe>';
    
    // XML para debug (igual à NF-e)
    const xmlEnvioDebug = `
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${xmlSemDeclaracao}
</enviNFe>
`.trim();
    
    // Criar envelope SOAP para NFC-e (mesmo namespace que NF-e)
    const envelope = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${xmlEnviNFe}
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>
`.trim();

    console.log('📦 Envelope SOAP preparado, tamanho:', envelope.length);

    // 🔍 DEBUG: Salvar envelope completo para diagnóstico (igual à NF-e)
    try {
      const fs = require('fs');
      const path = require('path');
      const tempDir = path.resolve(process.cwd(), 'temp');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.resolve(tempDir, 'envelope-soap-nfce.xml'), envelope, 'utf8');
      fs.writeFileSync(path.resolve(tempDir, 'xml-envio-nfce.xml'), xmlEnvioDebug, 'utf8');
      console.log('🔍 Envelope SOAP NFC-e salvo em temp/envelope-soap-nfce.xml');
      console.log('🔍 XML de envio NFC-e salvo em temp/xml-envio-nfce.xml');
    } catch (debugErr) {
      console.warn('⚠️ Falha ao salvar envelope SOAP NFC-e:', debugErr);
    }

    // 8️⃣ ENVIAR PARA SEFAZ (com fallback para múltiplas URLs)
    console.log('📤 Enviando cupom para SEFAZ...');
    
    const agent = new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false,
    });
    
    // URLs NFC-e dinâmicas baseadas no ambiente configurado
    const ambienteSefaz = getAmbienteSefaz();
    console.log(`🌐 Ambiente SEFAZ determinado: ${ambienteSefaz}`);
    
    const urlsNfce = [
      getUrlSefazAtual('NFCE_AUTORIZACAO'),     // URL principal baseada no ambiente
      getUrlSefazAtual('NFCE_ALT1'),             // URL alternativa
      'https://hom.nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx', // SVRS Contingência (sempre disponível)
    ];
    
    console.log(`🔗 URLs NFC-e para ${ambienteSefaz}:`, urlsNfce);
    
    let sefazResponse;
    let lastError;
    
    for (const urlSefaz of urlsNfce) {
      try {
        console.log(`🔗 Tentando URL: ${urlSefaz}`);
        
        sefazResponse = await axios.post(urlSefaz, envelope, {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
          },
          timeout: 30000, // 30 segundos timeout
          validateStatus: () => true, // Aceita qualquer status para ver a resposta
        });
        
        // Se status 200, sucesso
        if (sefazResponse.status === 200) {
          console.log(`✅ Sucesso com URL: ${urlSefaz}`);
          break;
        }
        
        // Se não é 200, trata como erro mas mostra a resposta
        console.warn(`⚠️ Status ${sefazResponse.status} da URL ${urlSefaz}`);
        console.warn(`📄 Resposta SEFAZ:`, sefazResponse.data?.substring?.(0, 500) || sefazResponse.data);
        
        lastError = new Error(`Status ${sefazResponse.status}: ${sefazResponse.statusText}`);
        
        // Se não é a última URL, continua tentando
        if (urlSefaz !== urlsNfce[urlsNfce.length - 1]) {
          console.log('🔄 Tentando próxima URL...');
          sefazResponse = undefined; // Reset para tentar próxima
          continue;
        }
        
        // Se é a última URL, lança o erro
        throw new Error(`Todas as URLs NFC-e falharam. Último erro: ${lastError.message}`);
        
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Falha na URL ${urlSefaz}:`, error.message);
        
        // Mostra mais detalhes do erro se houver
        if (error.response) {
          console.warn(`📄 Resposta de erro SEFAZ:`, error.response.data?.substring?.(0, 500) || error.response.data);
        }
        
        // Se não é a última URL, continua tentando
        if (urlSefaz !== urlsNfce[urlsNfce.length - 1]) {
          console.log('🔄 Tentando próxima URL...');
          continue;
        }
        
        // Se é a última URL, lança o erro
        throw new Error(`Todas as URLs NFC-e falharam. Último erro: ${error.message}`);
      }
    }

    if (!sefazResponse) {
      throw new Error(`Falha ao enviar para SEFAZ: ${lastError?.message || 'Todas as URLs falharam'}`);
    }

    xmlResposta = sefazResponse.data;
    console.log('✅ XML de resposta da Sefaz:', xmlResposta);

    // Parse da resposta
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      tagNameProcessors: [(name) => name.split(':').pop() || name],
    });
    
    const retEnviNFe = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe;
    const retConsReciNFe = json?.Envelope?.Body?.nfeResultMsg?.retConsReciNFe;
    
    if (!retEnviNFe && !retConsReciNFe) {
      console.error('❌ Estrutura inesperada:', JSON.stringify(json, null, 2).substring(0, 500));
      throw new Error('Estrutura de resposta da Sefaz inesperada');
    }

    if (retConsReciNFe) {
      const statusConsulta = retConsReciNFe.cStat;
      const motivoConsulta = retConsReciNFe.xMotivo;
      throw new Error(`Erro SEFAZ ${statusConsulta}: ${motivoConsulta}`);
    }

    // 9️⃣ EXTRAIR STATUS
    let status, motivo, protocolo;

    if (retEnviNFe.cStat === '104') {
      const infProt = retEnviNFe.protNFe?.infProt;
      if (!infProt) {
        throw new Error('Lote processado, mas infProt não encontrado');
      }
      status = infProt.cStat;
      motivo = infProt.xMotivo;
      protocolo = infProt.nProt || null;
    } else {
      status = retEnviNFe.cStat;
      motivo = retEnviNFe.xMotivo;
      protocolo = null;
    }

    console.log('✅ Status do cupom:', status, motivo);

    // 🔟 SE AUTORIZADO (100)
    if (status === '100') {
      // ✅ CORREÇÃO: Limpar campo 'denegada' quando a emissão é bem-sucedida
      if (pool && codfat) {
        try {
          const client = await pool.connect();
          try {
            await client.query(
              `UPDATE db_manaus.dbfatura SET denegada = NULL WHERE codfat = $1`,
              [codfat],
            );
            console.log(`✅ Campo 'denegada' limpo na fatura ${codfat} (emissão bem-sucedida)`);
          } finally {
            client.release();
          }
        } catch (erroLimparDenegada) {
          console.error('⚠️ Erro ao limpar campo denegada:', erroLimparDenegada);
        }
      }

      const xmlNFeOnly = xmlAssinado.replace(/^<\?xml[^>]*\?>/, '').trim();
      const protNFeXml = create().ele({ protNFe: retEnviNFe.protNFe }).end();
      
      const xmlProc = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${xmlNFeOnly}${protNFeXml}</nfeProc>`;

      const chaveAutorizada = retEnviNFe.protNFe?.infProt?.chNFe || chaveAcesso;

      console.log('✅ Cupom autorizado! Chave:', chaveAutorizada);

      // Gerar PDF
      console.log('📄 Gerando PDF do cupom...');
      
      // ✅ Mesclar dados do cliente na fatura para o PDF
      const faturaComCliente = {
        ...dados.dbfatura,
        nroform: nroformEmissao,
        serie: serieEmissao,
        // Dados do cliente/destinatário
        nomefant: dados.dbclien?.nome || dados.dbclien?.nomefant || '',
        cpfcgc: dados.dbclien?.cpfcgc || dados.dbclien?.cgc || '',
        ender: dados.dbclien?.ender || dados.dbclien?.endereco || '',
        numero: dados.dbclien?.numero || 'S/N',
        bairro: dados.dbclien?.bairro || '',
        cidade: dados.dbclien?.cidade || dados.dbclien?.municipio || '',
        uf: dados.dbclien?.uf || '',
        cep: dados.dbclien?.cep || '',
        fone: dados.dbclien?.fone || dados.dbclien?.telefone || '',
        iest: dados.dbclien?.iest || '',
      };
      
      const pdfDoc = await gerarPreviewCupomFiscal(
        faturaComCliente,
        dados.dbitvenda || [],
        dados.dbvenda || {},
        dados.emitente || {},
        'valida',
        {
          chaveAcesso: chaveAutorizada,
          protocolo,
          numeroNFe: nroformEmissao,
          serieNFe: serieEmissao,
          dataEmissao: dataEmissao, // Usar a data extraída do XML
          valorTotal: totalNF.toFixed(2)
        }
      );

      const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

      // Salvar no banco
      if (pool) {
        try {
          const baseRandom = Math.floor(Math.random() * 1e6);
          const timestamp = Date.now().toString().slice(-3);
          const codnumerico = baseRandom.toString().padStart(6, '0') + timestamp;
          // ✅ CORREÇÃO: Usar o número real do cupom, não aleatório
          const nrodoc_fiscal = String(nroformEmissao).padStart(9, '0');

          const client = await pool.connect();
          try {
       
            await client.query(
              `INSERT INTO db_manaus.dbfat_nfe (
                codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, 
                xmlremessa, xmlretorno, status, numprotocolo, dthrprotocolo, motivo, 
                tipo_emissao, modelo, tpemissao, imagem, emailenviado
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
              [
                codfat,
                nrodoc_fiscal,
                codnumerico,
                new Date(),
                chaveAutorizada,
                '4.00',
                xmlBruto,
                xmlResposta,
                String(status),
                protocolo,
               new Date(),
                motivo ? motivo.substring(0, 2000) : null,
                1,
                '65', // Modelo 65 = NFC-e
                1,
                Buffer.from(pdfBuffer.toString('base64'), 'base64'),
                'N'
              ]
            );
            console.log('✅ Cupom salvo no banco');
          } finally {
            client.release();
          }
        } catch (erroSalvar) {
          console.error('⚠️ Erro ao salvar cupom no banco:', erroSalvar);
        }
      }

      // ✅ CORREÇÃO: Enviar email NFC-e automaticamente para o cliente
      const emailCliente = dados.dbclien?.email;
      const nomeCliente = dados.dbclien?.nome || dados.dbclien?.nomefant || 'Cliente';

      if (emailCliente && emailCliente.trim() !== '') {
        try {
          console.log('🚀 Enviando email NFC-e em background para o cliente...');

          // Construir URL absoluta para evitar 'Invalid URL' no Node.js
          const host = (req.headers.host as string) || process.env.NEXT_PUBLIC_HOST || 'localhost:3000';
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
          const emailUrl = `${protocol}://${host}/api/faturamento/enviar-email-nfe`;

          const emailResponse = await axios.post(
            emailUrl,
            {
              codfat: codfat,
              emailCliente: emailCliente.trim(),
              nomeCliente: nomeCliente,
              xmlAssinado: xmlAssinado, // Incluir o XML assinado para envio
            },
          );

          if (emailResponse.status === 200) {
            console.log(
              `✅ Email NFC-e enviado com sucesso para: ${emailCliente}`,
            );
          } else {
            console.error(
              `❌ Erro no envio para ${emailCliente}:`,
              emailResponse.data,
            );
          }
        } catch (erroEmail) {
          console.error(
            `⚠️ Erro ao enviar email NFC-e para ${emailCliente}:`,
            erroEmail instanceof Error ? erroEmail.message : String(erroEmail),
          );
          // Não impedir o retorno de sucesso da emissão
        }
      } else {
        console.log('⚠️ Cliente não possui email cadastrado, pulando envio automático');
      }

      return res.status(200).json({
        sucesso: true,
        status,
        motivo,
        protocolo,
        chaveAcesso: chaveAutorizada,
        pdfBase64: pdfBuffer.toString('base64'),
        tipo: 'NFC-e',
        modelo: '65',
        emailEnviado: !!(codfat && dados.dbclien?.email), // Email será enviado se codfat existe e cliente tem email
        emailCliente: dados.dbclien?.email || null,
      });
    }

    // ⚠️ SE NÃO AUTORIZADO
    console.log('❌ Cupom rejeitado pela SEFAZ:', status, motivo);
    
    // Salvar cupom rejeitado
    if (pool && codfat && xmlBruto) {
      try {
        const xmlParsed = await parseStringPromise(xmlBruto, {
          explicitArray: false,
          tagNameProcessors: [(name) => name.split(':').pop() || name],
        });
        
        const infNFeId = xmlParsed?.NFe?.infNFe?.['$']?.Id || xmlParsed?.NFe?.infNFe?.['@Id'];
        const chaveRejeitada = infNFeId ? infNFeId.replace('NFe', '') : chaveAcesso;
        
        const baseRandom = Math.floor(Math.random() * 1e6);
        const timestamp = Date.now().toString().slice(-3);
        const codnumerico = baseRandom.toString().padStart(6, '0') + timestamp;
        const nrodoc_fiscal = String(Math.floor(Math.random() * 1e8)).padStart(
          8,
          '0',
        );

        const client = await getPgPool().connect();
        try {
          await client.query(
            `INSERT INTO db_manaus.dbfat_nfe (
              codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, 
              xmlremessa, xmlretorno, status, numprotocolo, dthrprotocolo, motivo, 
              tipo_emissao, modelo, tpemissao, emailenviado
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
              codfat,
              nrodoc_fiscal,
              codnumerico,
              new Date(),
              chaveRejeitada,
              '4.00',
              xmlBruto,
              xmlResposta,
              String(status),
              protocolo,
              new Date(),
              motivo ? motivo.substring(0, 2000) : null,
              1,
              '65',
              1,
              'N',
            ],
          );
          console.log('✅ Cupom rejeitado salvo no histórico');
          
        } finally {
          client.release();
        }
      } catch (erroSalvar) {
        console.error('⚠️ Erro ao salvar cupom rejeitado:', erroSalvar);
      }
    }

    // Registrar mensagem de erro
    if (codfat) {
      await registrarMensagemCupom(codfat, status, motivo || 'Erro não especificado');
      
      // Marcar como denegada se for 301/302/303
      if ((status === '301' || status === '302' || status === '303') && pool) {
        try {
          const client = await pool.connect();
          try {
            await client.query(
              `UPDATE db_manaus.dbfatura SET denegada = 'S' WHERE codfat = $1`,
              [codfat],
            );
            console.log(
              `✅ Campo 'denegada' atualizado para 'S' na fatura ${codfat}`,
            );
            console.log(`✅ Fatura ${codfat} marcada como denegada`);
          } finally {
            client.release();
          }
        } catch (erroDenegada) {
          console.error('❌ Erro ao atualizar campo denegada:', erroDenegada);
        }
      }
    }

    return res.status(400).json({
      sucesso: false,
      status,
      motivo,
      protocolo,
    });
  } catch (error: any) {
    const detalhe = error?.response?.data || error.message || error;
    console.error('❌ Erro ao emitir cupom fiscal:', detalhe);

    return res.status(500).json({
      sucesso: false,
      erro: 'Erro no processamento do cupom fiscal.',
      detalhe: detalhe.toString(),
    });
  }
}