import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { gerarXMLNFe } from '@/components/services/sefazNfe/gerarXml';
import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { decrypt } from '@/utils/crypto';
import { extrairCNPJDoCertificado } from '@/utils/certificadoExtractor';
import gerarDanfePDF from '@/components/services/sefazNfe/gerarDanfePDF';
import { gerarNotaFiscalValida } from '@/utils/gerarPreviewNF';
import { gerarPdfNotaHtml } from '@/lib/danfe/gerarPdfNotaHtml';
import { normalizarPayloadNFe } from '@/utils/normalizarPayloadNFe';
import { create } from 'xmlbuilder2';
import { getPgPool } from '@/lib/pg';
import { determinarSerieFatura, proximoNroForm } from '@/lib/faturamento/gerarNumeracaoFatura';
import { ieEmitentePorSerie } from '@/lib/faturamento/fiscalPorArmazem';
import { getAmbienteSefaz, getUrlSefazAtual } from '@/utils/gerarXmlCupomFiscal';
import { obterCRTEmpresa } from '@/utils/consultarCRTReceita';
 
// Função para registrar erros/mensagens da emissão
async function registrarMensagemFatura(
  codfat: string,
  codigo: string,
  mensagem: string,
) {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    // Verifica se a mensagem já existe na tabela dbmensagens
    const msgExistente = await client.query(
      'SELECT codigo FROM db_manaus.dbmensagens WHERE codigo = $1',
      [codigo],
    );

    // Se não existe, insere a mensagem
    if (msgExistente.rowCount === 0) {
      await client.query(
        'INSERT INTO db_manaus.dbmensagens (codigo, mensagem) VALUES ($1, $2)',
        [codigo, mensagem],
      );
      console.log('✅ Mensagem inserida na dbmensagens:', codigo);
    }

    // Verifica se a relação fatura-mensagem já existe
    const relacaoExistente = await client.query(
      'SELECT codfat FROM db_manaus.dbmensagens_fatura WHERE codfat = $1 AND codmsg = $2',
      [codfat, codigo],
    );

    // Se não exists, insere a relação
    if (relacaoExistente.rowCount === 0) {
      await client.query(
        'INSERT INTO db_manaus.dbmensagens_fatura (codfat, codmsg) VALUES ($1, $2)',
        [codfat, codigo],
      );
      console.log('✅ Relação fatura-mensagem inserida:', codfat, '->', codigo);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao registrar mensagem:', error);
  } finally {
    client.release();
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('🚀 [NF-e] Iniciando emissão de NF-e (Modelo 55)');
  console.log('📋 [NF-e] Endpoint:', req.url);
  console.log('📋 [NF-e] Método:', req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const dados = req.body;

    // 🔍 DEBUG: Log completo dos dados recebidos para debug de email
    console.log('🔍 DEBUG - Dados recebidos na API de emissão:', {
      tem_codfat: !!dados?.codfat,
      codfat_valor: dados?.codfat,
      tem_dbfatura: !!dados?.dbfatura,
      dbfatura_codfat: dados?.dbfatura?.codfat,
      dbfatura_nroform: dados?.dbfatura?.nroform,
      tem_cliente: !!dados?.dbclien,
      cliente_email: dados?.dbclien?.email,
      keys_dados: dados ? Object.keys(dados) : 'undefined',
      dbfatura_completo: dados?.dbfatura
    });

    // 📋 LOG CRÍTICO: Documento do destinatário
    const documentoDestinatario = dados?.dbclien?.cpfcgc || dados?.dbclien?.cgc || 'NÃO INFORMADO';
    console.log('📋 [NF-e] Documento do destinatário:', documentoDestinatario);
    console.log('📋 [NF-e] Tipo esperado: CNPJ (NF-e) ou CPF (NFC-e)');
    
    if (documentoDestinatario !== 'NÃO INFORMADO') {
      const tipoDocumento = documentoDestinatario.length === 14 ? 'CNPJ' : documentoDestinatario.length === 11 ? 'CPF' : 'DESCONHECIDO';
      console.log('📋 [NF-e] Tipo detectado:', tipoDocumento);
      if (tipoDocumento === 'CPF') {
        console.warn('⚠️ [NF-e] ATENÇÃO: Documento CPF detectado, mas endpoint é para NF-e!');
        console.warn('   Para CPF use: /api/faturamento/emitir-cupom');
      }
    }

    // 🛡️ REDE DE SEGURANÇA — DESTINATÁRIO SEMPRE O CLIENTE DA FATURA.
    // O dbclien vem do req.body (frontend). Já houve caso de vir o cliente ERRADO
    // (ambiguidade codvenda/nrovenda) e a NF ser emitida para outro cliente. Aqui
    // resolvemos o cliente pelo codfat e, se divergir do payload, sobrescrevemos.
    try {
      const codfatRef = dados?.codfat || dados?.dbfatura?.codfat || null;
      if (codfatRef) {
        const faturaCli = await getPgPool().query(
          `SELECT c.*
             FROM db_manaus.dbfatura f
             JOIN db_manaus.dbclien c ON c.codcli = f.codcli
            WHERE f.codfat = $1
            LIMIT 1`,
          [codfatRef],
        );
        const clienteFatura = faturaCli.rows[0];
        if (clienteFatura) {
          const docPayload = String(dados?.dbclien?.cpfcgc || '').replace(/\D/g, '');
          const docFatura = String(clienteFatura.cpfcgc || '').replace(/\D/g, '');
          if (!dados?.dbclien || docPayload !== docFatura) {
            console.warn(
              `⚠️ [NF-e] dbclien do payload (doc ${docPayload || 'vazio'}) diverge do cliente da fatura ${codfatRef} (doc ${docFatura}, codcli ${clienteFatura.codcli}). Sobrescrevendo com o cliente CORRETO da fatura.`,
            );
            dados.dbclien = clienteFatura;
          }
        } else {
          console.warn(`⚠️ [NF-e] Não foi possível resolver o cliente da fatura ${codfatRef} — seguindo com o dbclien do payload.`);
        }
      }
    } catch (e) {
      console.error('❌ [NF-e] Falha ao validar cliente da fatura (seguindo com payload):', e);
    }

    // 🆕 BUSCAR CNPJ E IE DA EMPRESA A PARTIR DE DBVENDA
    let cnpjEmpresaVenda: string | null = null;
    let ieEmpresaVenda: string | null = null;

    // Tentar obter dados da venda associada à fatura
    if (dados?.dbvenda?.codvenda) {
      console.log('🔍 Buscando dados da venda para identificar a empresa...');
      try {
        const vendaQuery = await getPgPool().query(
          `SELECT cnpj_empresa, ie_empresa FROM db_manaus.dbvenda WHERE codvenda = $1`,
          [dados.dbvenda.codvenda]
        );
        
        if (vendaQuery.rows.length > 0) {
          cnpjEmpresaVenda = vendaQuery.rows[0].cnpj_empresa;
          ieEmpresaVenda = vendaQuery.rows[0].ie_empresa;
          console.log(`✅ Empresa da venda: CNPJ=${cnpjEmpresaVenda || '(não informado)'}, IE=${ieEmpresaVenda || '(não informado)'}`);
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar dados da venda:', error);
      }
    }

    // Buscar empresas com certificados válidos
    // ⚠️ cadeiaCrt é opcional - alguns certificados modernos não incluem cadeia
    let query = `
      SELECT * FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoCrt" IS NOT NULL
    `;
    const params: string[] = [];

    // Se temos CNPJ da empresa na venda, filtrar por ele
    if (cnpjEmpresaVenda) {
      query += ` AND cgc = $${params.length + 1}`;
      params.push(cnpjEmpresaVenda);
      console.log(`🎯 Filtrando empresa por CNPJ da venda: ${cnpjEmpresaVenda}`);
    }

    // Se temos IE da empresa na venda, filtrar por ela também
    if (ieEmpresaVenda) {
      query += ` AND inscricaoestadual = $${params.length + 1}`;
      params.push(ieEmpresaVenda);
      console.log(`🎯 Filtrando empresa por IE da venda: ${ieEmpresaVenda}`);
    }

    const empresasQuery = await getPgPool().query(query, params);

    console.log(
      'Empresas encontradas com certificados:',
      empresasQuery.rows.length,
    );
    empresasQuery.rows.forEach((emp: any, index: number) => {
      console.log(
        `Empresa ${index + 1}: CNPJ ${emp.cgc}, Nome ${emp.nomecontribuinte}`,
      );
    });

    if (empresasQuery.rows.length === 0) {
      throw new Error(
        'Nenhuma empresa com certificados digitais configurados encontrada',
      );
    }

    let emitenteRaw = null;
    let certificadoCrtDecrypted = null;
    for (const empresa of empresasQuery.rows) {
      const certificadoCrt = empresa.certificadoCrt
        ? await decrypt(empresa.certificadoCrt)
        : null;
      if (!certificadoCrt) {
        console.log(
          `Certificado CRT não encontrado para empresa ${empresa.cgc}`,
        );
        continue;
      }

      const cnpjCertificado = extrairCNPJDoCertificado(certificadoCrt);
      const cnpjEmpresa = empresa.cgc.replace(/\D/g, '');
      console.log(
        `Empresa ${empresa.cgc}: CNPJ certificado extraído: ${cnpjCertificado}, CNPJ empresa: ${cnpjEmpresa}`,
      );
      if (cnpjCertificado && cnpjCertificado === cnpjEmpresa) {
        emitenteRaw = empresa;
        certificadoCrtDecrypted = certificadoCrt;
        console.log(`Empresa correspondente encontrada: ${empresa.cgc}`);
        break;
      }
    }

    if (!emitenteRaw || !certificadoCrtDecrypted) {
      throw new Error(
        'Nenhuma empresa encontrada com certificado digital correspondente ao CNPJ',
      );
    }

    // Ambiente NF-e parametrizado por empresa (dadosEmpresa.ambiente): 1=prod, 2=homolog.
    const ambienteEmpresa = String(emitenteRaw?.ambiente || process.env.AMBIENTE_NFCE || '2');

    // Buscar código do município baseado no nome e UF
    let cMun = '1302603'; // Default: Manaus
    if (emitenteRaw.municipio && emitenteRaw.uf) {
      try {
        const municipioQuery = await getPgPool().query(
          'SELECT codmunicipio FROM dbmunicipio WHERE LOWER(descricao) = LOWER($1) AND uf = $2 LIMIT 1',
          [emitenteRaw.municipio.trim(), emitenteRaw.uf],
        );
        if (municipioQuery.rows.length > 0) {
          cMun = municipioQuery.rows[0].codmunicipio;
        }
      } catch (error) {
        console.warn(
          'Erro ao buscar código do município, usando default:',
          error,
        );
      }
    }

    // 🎯 IE do emitente pela SÉRIE (modelo web armazém→IE): série 2 → IE tipo 07,
    // série 1/3 → IE tipo 04. Substitui a IE global do dadosempresa, mantendo série↔IE
    // consistentes e evitando a rejeição SEFAZ 615 (série vinculada a outra IE).
    {
      const serieFat = String(dados?.dbfatura?.serie ?? '').trim();
      if (serieFat) {
        const clientIE = await getPgPool().connect();
        try {
          const ieCorreta = await ieEmitentePorSerie(clientIE, emitenteRaw.cgc, serieFat);
          const ieAtual = String(emitenteRaw.inscricaoestadual || '').replace(/\D/g, '');
          if (ieCorreta && ieCorreta !== ieAtual) {
            console.log(`🎯 IE do emitente ajustada pela série ${serieFat}: ${ieAtual} → ${ieCorreta}`);
            emitenteRaw.inscricaoestadual = ieCorreta;
          }
        } finally {
          clientIE.release();
        }
      }
    }

    // 🆕 CONSULTAR CRT AUTOMATICAMENTE
    console.log('🔍 Consultando CRT da empresa...');
    const crtEmpresa = await obterCRTEmpresa(
      emitenteRaw.cgc,
      emitenteRaw.inscricaoestadual
    );
    console.log(`✅ CRT obtido: ${crtEmpresa}`);

    dados.emitente = {
      cnpj: emitenteRaw.cgc || '',
      xNome: emitenteRaw.nomecontribuinte || '',
      ie: emitenteRaw.inscricaoestadual || '',
      crt: crtEmpresa, // 🆕 Adicionar CRT ao emitente
      enderEmit: {
        xLgr: emitenteRaw.logradouro || '',
        nro: emitenteRaw.numero || '',
        xBairro: emitenteRaw.bairro || '',
        cMun: cMun,
        xMun: emitenteRaw.municipio || '',
        UF: emitenteRaw.uf || '',
        CEP: emitenteRaw.cep || '',
      },
    };

    // 🚨 LOG CRÍTICO: Verificar IE do emitente
    console.log('');
    console.log('🔍 ========== DADOS DO EMITENTE (dadosempresa) ==========');
    console.log(`📌 CNPJ: ${emitenteRaw.cgc}`);
    console.log(`📌 Nome: ${emitenteRaw.nomecontribuinte}`);
    console.log(
      `📌 IE (inscricaoestadual): "${
        emitenteRaw.inscricaoestadual
      }" (tipo: ${typeof emitenteRaw.inscricaoestadual})`,
    );
    console.log(`📌 UF: ${emitenteRaw.uf}`);
    console.log(`📌 Município: ${emitenteRaw.municipio}`);
    if (
      !emitenteRaw.inscricaoestadual ||
      emitenteRaw.inscricaoestadual.trim() === ''
    ) {
      console.error(
        '🚨 ALERTA: Inscrição Estadual está VAZIA na tabela dadosempresa!',
      );
      console.error('   Isso causará erro "Série já vinculada a outra IE"');
      console.error(
        "   Execute: UPDATE dadosempresa SET inscricaoestadual = 'IE_CORRETA' WHERE cgc = '" +
          emitenteRaw.cgc +
          "';",
      );
    }
    console.log('🔍 ===================================================');
    console.log('');

    // 🎯 SÉRIE + NÚMERO: fonte da verdade é a dbfatura (definida no salvar pela regra
    // Oracle FATURAMENTOS.FATURA_INCLUIR — série 1 mod55 / 3 mod65 / 2 Insc.07; número
    // escopado por (serie, insc07)). Aqui só confiamos no que veio e completamos o que
    // faltar — sem mais série '2' fixa nem MAX de autorizadas.
    let serieEmissao = String(dados?.dbfatura?.serie ?? '').trim();
    let nroformEmissao = dados?.dbfatura?.nroform;
    const insc07Fatura = dados?.dbfatura?.insc07;

    if (!serieEmissao) {
      const cgcEmpresa =
        dados?.emitente?.cgc || dados?.dbfatura?.cnpj_empresa || dados?.emitente?.cnpj || '';
      serieEmissao =
        determinarSerieFatura({ tipofat: '1', insc07: insc07Fatura, cgcEmpresa, tipoNf: 'N' }) || '1';
      if (!dados.dbfatura) dados.dbfatura = {};
      dados.dbfatura.serie = serieEmissao;
      console.log(`📌 Série ausente no payload — derivada pela regra Oracle: ${serieEmissao}`);
    } else {
      console.log(`📌 Série vinda da dbfatura: ${serieEmissao}`);
    }

    if (!nroformEmissao || nroformEmissao === '') {
      console.log('⚠️ nroform ausente no payload — calculando (escopado por série + insc07)...');
      const client = await getPgPool().connect();
      try {
        nroformEmissao = await proximoNroForm(client, { serie: serieEmissao, insc07: insc07Fatura });
      } finally {
        client.release();
      }
      if (!dados.dbfatura) dados.dbfatura = {};
      dados.dbfatura.nroform = nroformEmissao;
      console.log(`🎯 Número calculado para emissão: ${nroformEmissao} (série ${serieEmissao})`);
    } else {
      console.log(`✅ nroform vindo do payload: ${nroformEmissao} (série ${serieEmissao})`);
    }

    const dadosNormalizados = await normalizarPayloadNFe(dados);
    (dadosNormalizados as any).ambiente = ambienteEmpresa;

    // 🔍 DEBUG: Verificar estrutura dos dados originais e normalizados
    console.log('🔍 [DEBUG] dados originais:', Object.keys(dados));
    console.log('🔍 [DEBUG] dados.dbfatura:', dados.dbfatura);
    console.log('🔍 [DEBUG] dados.dbvenda:', dados.dbvenda);
    console.log(
      '🔍 [DEBUG] dadosNormalizados.fatura:',
      dadosNormalizados.fatura,
    );

    // Natureza da operação (cabeçalho) = dbfatura.descrcfop (derivada da OPERAÇÃO
    // no faturamento — NÃO do CFOP dos itens). Fallback p/ faturas antigas.
    (dadosNormalizados as any).naturezaOperacao =
      String(
        (dados as any).dbfatura?.descrcfop ||
          (dadosNormalizados as any).fatura?.descrcfop ||
          '',
      ).trim() || 'VENDA DE MERCADORIAS';

    const xmlBruto = gerarXMLNFe(dadosNormalizados);

    // 🔍 DEBUG: Verificar modelo no XML gerado
    console.log('🔍 [DEBUG] Verificando modelo no XML NF-e:');
    const modeloMatch = xmlBruto.match(/<mod>(\d+)<\/mod>/);
    console.log('🔍 [DEBUG] Modelo encontrado no XML:', modeloMatch ? modeloMatch[1] : 'NÃO ENCONTRADO');
    if (modeloMatch && modeloMatch[1] !== '55') {
      console.error('🚨 ERRO CRÍTICO: XML NF-e gerado com modelo incorreto!');
      console.error('   Esperado: 55 (NF-e), Encontrado:', modeloMatch[1]);
      throw new Error(`XML NF-e gerado com modelo incorreto: ${modeloMatch[1]} (esperado: 55)`);
    }

    // 🔍 DEBUG: Salvar XML antes da assinatura para diagnóstico
    try {
      const fs = require('fs');
      const path = require('path');
      const scriptsDir = path.resolve(process.cwd(), 'scripts');
      
      // Criar diretório se não existir
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(scriptsDir, 'pre-sign.xml'),
        xmlBruto,
        'utf8',
      );
      console.log('🔍 XML pré-assinatura salvo em scripts/pre-sign.xml');
    } catch (debugErr) {
      console.warn('⚠️ Falha ao salvar XML pré-assinatura:', debugErr);
    }

    // Usar certificados do banco de dados (descriptografados)
    const certificadoKey = emitenteRaw.certificadoKey
      ? await decrypt(emitenteRaw.certificadoKey)
      : null;
    const certificadoCrt = certificadoCrtDecrypted;

    if (!certificadoKey || !certificadoCrt) {
      throw new Error(
        'Certificados digitais não encontrados ou inválidos na base de dados',
      );
    }

    // CNPJ já foi validado na seleção da empresa

    const xmlAssinado = await assinarXMLComCertificados(
      xmlBruto,
      'infNFe',
      certificadoKey,
      certificadoCrt,
    );

    // 🔍 DEBUG: Salvar XML após assinatura para diagnóstico
    try {
      const fs = require('fs');
      const path = require('path');
      const scriptsDir = path.resolve(process.cwd(), 'scripts');
      
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(scriptsDir, 'signed.xml'),
        xmlAssinado,
        'utf8',
      );
      console.log('🔍 XML pós-assinatura salvo em scripts/signed.xml');

      // Executar validação automática e abortar se houver diferença crítica
      const { spawn } = require('child_process');
      const validationProcess = spawn(
        'node',
        ['scripts/validate_totals_corrigido.js', 'scripts/signed.xml'],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        },
      );

      let validationOutput = '';
      validationProcess.stdout.on('data', (data: Buffer) => {
        validationOutput += data.toString();
      });
      validationProcess.stderr.on('data', (data: Buffer) => {
        validationOutput += data.toString();
      });

      await new Promise((resolve) => {
        validationProcess.on('close', (code: number) => {
          console.log('🔍 Validação do XML assinado:', validationOutput);
          if (code === 2 || code === 3) {
            console.error(
              '❌ VALIDAÇÃO CRÍTICA FALHOU - XML assinado possui divergência de totais!',
            );
            console.error(
              'Processo de envio será ABORTADO para evitar rejeição 610.',
            );
            throw new Error(
              'XML assinado possui divergência crítica nos totais - envio abortado',
            );
          }
          resolve(null);
        });
      });
    } catch (debugErr) {
      // Se o erro for de validação crítica, re-throw para abortar
      if (
        debugErr instanceof Error &&
        debugErr.message.includes('divergência crítica')
      ) {
        throw debugErr;
      }
      console.warn('⚠️ Falha ao salvar/validar XML pós-assinatura:', debugErr);
    }
    const xmlNFeOnly = xmlAssinado.replace(/^<\?xml[^>]*\?>/, '').trim();

    const xmlEnvio = `
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>000000000000001</idLote>
  <indSinc>1</indSinc>
  ${xmlNFeOnly}
</enviNFe>
`.trim();

    const envelope = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${xmlEnvio}
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>
`.trim();

    // 🔍 DEBUG: Salvar envelope completo para diagnóstico
    try {
      const fs = require('fs');
      const path = require('path');
      const scriptsDir = path.resolve(process.cwd(), 'scripts');
      
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(scriptsDir, 'envelope-soap.xml'),
        envelope,
        'utf8',
      );
      fs.writeFileSync(
        path.join(scriptsDir, 'xml-envio.xml'),
        xmlEnvio,
        'utf8',
      );
      console.log('🔍 Envelope SOAP salvo em scripts/envelope-soap.xml');
      console.log('🔍 XML de envio salvo em scripts/xml-envio.xml');
    } catch (debugErr) {
      console.warn('⚠️ Falha ao salvar envelope SOAP:', debugErr);
    }

    // Preparar certificados para HTTPS agent
    const cadeiaCrt = emitenteRaw.cadeiaCrt
      ? await decrypt(emitenteRaw.cadeiaCrt)
      : null;

    const agent = new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false,
    });

    const ambienteSefaz = getAmbienteSefaz(ambienteEmpresa);
    console.log(`🌐 Ambiente SEFAZ determinado para NF-e: ${ambienteSefaz}`);
    
    const urlSefaz = getUrlSefazAtual('NFE_AUTORIZACAO', ambienteEmpresa);
    console.log(`🔗 URL SEFAZ NF-e: ${urlSefaz}`);

    let sefazResponse;
    try {
      sefazResponse = await axios.post(urlSefaz, envelope, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          SOAPAction:
            'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
        },
        timeout: 30000,
        // Não lançar em 4xx/5xx: queremos INSPECIONAR o corpo/status real da SEFAZ.
        validateStatus: () => true,
      });
    } catch (errSefaz: any) {
      // Erro de transporte/TLS (sem resposta HTTP): capturar código e mensagem.
      const cod = errSefaz?.code || 'SEM_CODIGO';
      console.error('❌ [SEFAZ] Falha de comunicação:', cod, errSefaz?.message);
      throw new Error(
        `Falha na comunicação com a SEFAZ (${cod}): ${errSefaz?.message}. URL: ${urlSefaz}`,
      );
    }

    // Se a SEFAZ devolveu HTTP de erro, extrair o CORPO REAL (SOAP-Fault/HTML) e propagar.
    if (sefazResponse.status >= 400) {
      const corpoRaw = sefazResponse.data;
      const corpo =
        typeof corpoRaw === 'string'
          ? corpoRaw
          : (() => {
              try {
                return JSON.stringify(corpoRaw);
              } catch {
                return String(corpoRaw);
              }
            })();
      console.error(
        `❌ [SEFAZ] HTTP ${sefazResponse.status} | URL: ${urlSefaz} | headers: ${JSON.stringify(
          sefazResponse.headers,
        )} | body(2000): ${(corpo || '(vazio)').slice(0, 2000)}`,
      );
      throw new Error(
        `SEFAZ retornou HTTP ${sefazResponse.status}. Resposta: ${
          (corpo || '(corpo vazio)').slice(0, 1500)
        } | URL: ${urlSefaz}`,
      );
    }

    const xmlResposta = sefazResponse.data;
    console.log('✅ XML de resposta da Sefaz:', xmlResposta);

    // --- CORREÇÃO APLICADA: Leitura robusta do XML de resposta ---
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      // Remove qualquer prefixo de namespace (soap: ou soapenv:) para facilitar a leitura
      tagNameProcessors: [(name) => name.split(':').pop() || name],
    });

    const retEnviNFe = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe;
    if (!retEnviNFe) {
      throw new Error(
        'Estrutura de resposta da Sefaz inesperada: retEnviNFe não encontrado.',
      );
    }

    // --- CORREÇÃO APLICADA: Lógica para tratar respostas aninhadas ---
    let status, motivo, protocolo;

    // Se o status geral for "Lote Processado", o status real está dentro do protNFe
    if (retEnviNFe.cStat === '104') {
      const infProt = retEnviNFe.protNFe?.infProt;
      if (!infProt) {
        throw new Error(
          'Lote processado, mas infProt não foi encontrado na resposta.',
        );
      }
      status = infProt.cStat;
      motivo = infProt.xMotivo;
      protocolo = infProt.nProt || null;
    } else {
      // Senão, o status é o do nível principal
      status = retEnviNFe.cStat;
      motivo = retEnviNFe.xMotivo;
      protocolo = null;
    }

    console.log('✅ Status final da NF-e:', status, motivo);

    if (status === '100') {
      // ✅ CORREÇÃO: Limpar campo 'denegada' quando a emissão é bem-sucedida
      const codfatLimpar = dados?.codfat || dados?.dbfatura?.codfat || null;
      if (codfatLimpar) {
        try {
          const client = await getPgPool().connect();
          try {
            await client.query(
              `UPDATE db_manaus.dbfatura SET denegada = NULL WHERE codfat = $1`,
              [codfatLimpar],
            );
            console.log(`✅ Campo 'denegada' limpo na fatura ${codfatLimpar} (emissão NF-e bem-sucedida)`);
          } finally {
            client.release();
          }
        } catch (erroLimparDenegada) {
          console.error('⚠️ Erro ao limpar campo denegada:', erroLimparDenegada);
        }
      }

      const protNFeXml = create().ele({ protNFe: retEnviNFe.protNFe }).end();
      const _xmlProc = `
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  ${xmlNFeOnly}
  ${protNFeXml}
</nfeProc>`.trim();

      // Extrair dados da NFe para gerar PDF válido
      const chaveAcesso = retEnviNFe.protNFe?.infProt?.chNFe || '';
      const protocolo = retEnviNFe.protNFe?.infProt?.nProt || '';
      // fallback; será sobrescrito com o dhEmi REAL do XML (formato Manaus -04:00) abaixo
      let dataEmissao = new Date().toISOString();
      
      // CORREÇÃO: Extrair número da NFe e série do XML ORIGINAL (antes de enviar)
      // Parse do XML enviado para extrair ide
      const xmlOriginalParsed = await parseStringPromise(xmlNFeOnly, {
        explicitArray: false,
        tagNameProcessors: [(name) => name.split(':').pop() || name],
      });

      const ideOriginal = xmlOriginalParsed?.NFe?.infNFe?.ide;
      let numeroNFe = ideOriginal?.nNF?.toString() || '';
      let serieNFe = ideOriginal?.serie?.toString() || '1';

      // dhEmi REAL da nota (já no horário de Manaus, ex.: "2026-08-14T15:15:42-04:00").
      // Evita a DANFE mostrar hora UTC (do toISOString) ou 00:00 (data da venda).
      if (ideOriginal?.dhEmi) dataEmissao = String(ideOriginal.dhEmi);

      // CORREÇÃO: Se o número extraído for '1' (fallback), tentar extrair da chave de acesso
      if (numeroNFe === '1' && chaveAcesso && chaveAcesso.length === 44) {
        // A chave tem 44 dígitos:
        // - Posições 22-24: série (3 dígitos numéricos - pode ser conversão de alfanumérica)
        // - Posições 25-33: número da NFe (9 dígitos)
        const serieChave = chaveAcesso.substring(22, 25);
        const numeroNFeChave = chaveAcesso.substring(25, 34);

        const serieInt = parseInt(serieChave, 10);
        const numeroNFeInt = parseInt(numeroNFeChave, 10);

        if (numeroNFeInt > 1) {
          numeroNFe = String(numeroNFeInt);
          serieNFe = String(serieInt);
          console.log(
            `⚠️ FALLBACK: Número e série extraídos da chave de acesso: NFe=${numeroNFe}, Série=${serieNFe} (XML tinha '1')`,
          );
          console.log(
            `⚠️ NOTA: Se série original era alfanumérica, este será o código numérico convertido`,
          );
        }
      }

      console.log('🔍 Número e série extraídos do XML original:', {
        numeroNFe,
        serieNFe,
        ideCompleto: ideOriginal,
        nNF_tipo: typeof ideOriginal?.nNF,
        nNF_valor: ideOriginal?.nNF,
        serie_tipo: typeof ideOriginal?.serie,
        serie_valor: ideOriginal?.serie,
        chave_usada:
          chaveAcesso && numeroNFe !== '1' ? 'Sim (extraiu da chave)' : 'Não',
      });

      console.log('📋 Dados extraídos da NFe:', {
        numeroNFe,
        serieNFe,
        chaveAcesso,
        protocolo,
      });
      
      // Dados da NFe válida
      const dadosNFe = {
        chaveAcesso,
        protocolo,
        numeroNFe: numeroNFe,
        serieNFe: serieNFe,
        dataEmissao,
        valorTotal: dados?.total?.ICMSTot?.vNF || 0,
      };

      // Gerar PDF da nota fiscal válida
      console.log('🔄 Iniciando geração do PDF...');
      console.log('📊 Dados para PDF:', {
        dbfatura: dados.dbfatura ? 'OK' : 'undefined',
        produtos: dados.produtos ? dados.produtos.length : 'undefined',
        dbvenda: dados.dbvenda ? dados.dbvenda.length : 'undefined',
        emitente: dados.emitente
          ? dados.emitente.nomecontribuinte ||
            dados.emitente.xNome ||
            'SEM NOME'
          : 'undefined',
        cliente: dados.dbclien
          ? dados.dbclien.nomefant || dados.dbclien.nome || 'SEM NOME'
          : 'undefined',
        itvenda: dados.dbitvenda ? dados.dbitvenda.length : 'undefined',
      });

      console.log('📋 Detalhes dos dados:');
      console.log('- Empresa:', dados.emitente);
      console.log('- Cliente:', dados.dbclien);
      console.log('- Produtos:', dados.dbitvenda?.slice(0, 2)); // Primeiros 2 produtos

      let pdfBuffer: Buffer;
      try {
        console.log('📄 Tentando gerar PDF customizado...');

        // Primeiro definir os dados para o PDF

        // Calcular impostos baseado nos produtos se não estão na fatura
        const calcularImpostos = (produtos: any[]) => {
          let baseicms = 0;
          let valor_icms = 0;
          let valor_pis = 0;
          let valor_cofins = 0;
          let valor_ipi = 0;
          let totalprod = 0;
          // 🆕 IBS e CBS (Lei Complementar nº 214/2025)
          let valor_ibs = 0;
          let valor_cbs = 0;
          let weightedAliquotaIBS = 0;
          let weightedAliquotaCBS = 0;
          let baseForIBS = 0;
          let baseForCBS = 0;

          produtos.forEach((produto) => {
            // Usar os nomes corretos dos campos baseado nos dados reais
            const valorProduto = parseFloat(
              produto.totalproduto || produto.total_item || produto.total || 0,
            );
            const valorIcms = parseFloat(produto.totalicms || 0);
            const valorPis = parseFloat(produto.valorpis || 0);
            const valorCofins = parseFloat(produto.valorcofins || 0);
            const valorIpi = parseFloat(produto.totalipi || 0);
            
            // 🆕 IBS e CBS por produto
            const prodValorIBS = parseFloat(produto.valor_ibs || 0);
            const prodValorCBS = parseFloat(produto.valor_cbs || 0);
            const prodAliquotaIBS = parseFloat(produto.aliquota_ibs || 0);
            const prodAliquotaCBS = parseFloat(produto.aliquota_cbs || 0);

            console.log(
              `📊 Produto ${produto.codprod}: valor=${valorProduto}, icms=${valorIcms}, pis=${valorPis}, cofins=${valorCofins}, ipi=${valorIpi}, ibs=${prodValorIBS}, cbs=${prodValorCBS}`,
            );

            totalprod += valorProduto;
            valor_icms += valorIcms;
            valor_pis += valorPis;
            valor_cofins += valorCofins;
            valor_ipi += valorIpi;
            
            // 🆕 Acumular IBS e CBS
            valor_ibs += prodValorIBS;
            valor_cbs += prodValorCBS;
            
            // Acumular para média ponderada das alíquotas
            if (prodAliquotaIBS > 0) {
              weightedAliquotaIBS += prodAliquotaIBS * valorProduto;
              baseForIBS += valorProduto;
            }
            if (prodAliquotaCBS > 0) {
              weightedAliquotaCBS += prodAliquotaCBS * valorProduto;
              baseForCBS += valorProduto;
            }

            // Base ICMS = soma dos valores dos produtos (simplificado)
            if (valorIcms > 0) {
              baseicms += valorProduto;
            }
          });

          // Calcular alíquotas médias ponderadas de IBS e CBS
          const aliquota_ibs = baseForIBS > 0 
            ? Math.round((weightedAliquotaIBS / baseForIBS) * 100) / 100 
            : 0.1; // Fallback para alíquota padrão
          const aliquota_cbs = baseForCBS > 0 
            ? Math.round((weightedAliquotaCBS / baseForCBS) * 100) / 100 
            : 0.9; // Fallback para alíquota padrão

          return {
            baseicms: Math.round(baseicms * 100) / 100,
            valor_icms: Math.round(valor_icms * 100) / 100,
            valor_pis: Math.round(valor_pis * 100) / 100,
            valor_cofins: Math.round(valor_cofins * 100) / 100,
            valor_ipi: Math.round(valor_ipi * 100) / 100,
            totalprod: Math.round(totalprod * 100) / 100,
            // 🆕 IBS e CBS
            valor_ibs: Math.round(valor_ibs * 100) / 100,
            valor_cbs: Math.round(valor_cbs * 100) / 100,
            aliquota_ibs,
            aliquota_cbs,
          };
        };

        // Primeiro definir os dados para o PDF
        const produtosParaPdf = dados.dbitvenda || dados.produtos || [];
        const vendaParaPdf = dados.dbvenda || {};
        const empresaParaPdf = {
          nomecontribuinte: dados.emitente?.xNome || '',
          cgc: dados.emitente?.cnpj || '',
          inscricaoestadual: dados.emitente?.ie || '',
          logradouro: dados.emitente?.enderEmit?.xLgr || '',
          numero: dados.emitente?.enderEmit?.nro || '',
          municipio: dados.emitente?.enderEmit?.xMun || '',
          uf: dados.emitente?.enderEmit?.UF || '',
          cep: dados.emitente?.enderEmit?.CEP || '',
          telefone: '', // Não disponível na estrutura atual
          crt: (dados.emitente as any)?.crt || '', // 1/2=Simples, 3=Regime Normal (p/ texto do DANFE)
        };

        // Calcular impostos se não estão na fatura
        const impostosCalculados = calcularImpostos(produtosParaPdf);

        // Usar os dados corretos do payload
        const faturaParaPdf = {
          ...dados.dbfatura,
          // Adicionar dados do cliente se não estão na fatura
          nomefant:
            dados.dbclien?.nomefant ||
            dados.dbclien?.nome ||
            dados.dbfatura?.nomefant ||
            '',
          cpfcgc:
            dados.dbclien?.cpfcgc ||
            dados.dbclien?.cgc ||
            dados.dbfatura?.cpfcgc ||
            '',
          ender:
            dados.dbclien?.ender ||
            dados.dbclien?.endereco ||
            dados.dbfatura?.ender ||
            '',
          numero: dados.dbclien?.numero || dados.dbfatura?.numero || '',
          bairro: dados.dbclien?.bairro || dados.dbfatura?.bairro || '',
          cep: dados.dbclien?.cep || dados.dbfatura?.cep || '',
          cidade:
            dados.dbclien?.cidade ||
            dados.dbclien?.municipio ||
            dados.dbfatura?.cidade ||
            '',
          uf: dados.dbclien?.uf || dados.dbfatura?.uf || '',
          fone:
            dados.dbclien?.fone ||
            dados.dbclien?.telefone ||
            dados.dbfatura?.fone ||
            '',
          iest:
            dados.dbclien?.iest ||
            dados.dbclien?.inscricaoestadual ||
            dados.dbfatura?.iest ||
            '',
          // Adicionar impostos calculados se não estão na fatura
          ...impostosCalculados,
          // Sobrescrever com valores da fatura se existirem
          ...(dados.dbfatura || {}),
        };

        console.log('� Impostos calculados:', impostosCalculados);

        console.log('�📋 Dados finais para PDF:', {
          fatura: faturaParaPdf.nomefant ? 'OK' : 'SEM CLIENTE',
          produtos: produtosParaPdf.length,
          empresa: empresaParaPdf.nomecontribuinte || 'SEM EMPRESA',
          impostos: {
            icms: impostosCalculados.valor_icms,
            pis: impostosCalculados.valor_pis,
            cofins: impostosCalculados.valor_cofins,
            total: impostosCalculados.totalprod,
          },
        });

        // NF-e em HTML (layout MELO via puppeteer)
        pdfBuffer = await gerarPdfNotaHtml(
          'nfe',
          faturaParaPdf,
          produtosParaPdf,
          vendaParaPdf,
          empresaParaPdf,
          dadosNFe,
          { homologacao: ambienteSefaz === 'HOMOLOGACAO' },
        );
        console.log('✅ PDF (HTML) gerado com sucesso');
      } catch (pdfError) {
        console.warn('⚠️ NF-e HTML→PDF falhou, usando jsPDF (fallback):', pdfError);
        try {
          const pdfDoc = await gerarNotaFiscalValida(
            faturaParaPdf,
            produtosParaPdf,
            vendaParaPdf,
            empresaParaPdf,
            dadosNFe,
          );
          pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
          console.log('✅ PDF (jsPDF fallback) gerado com sucesso');
        } catch (pdfFallbackError) {
          console.error('❌ Erro no fallback jsPDF também:', pdfFallbackError);
          throw pdfFallbackError;
        }
      }

      // Buscar dados principais para salvar - CORRIGIDO baseado no frontend
      const chave = chaveAcesso;
      // codfat vem no payload principal (linha 854 do frontend: codfat: novoCodfat)
      const codfat = dados?.codfat || dados?.dbfatura?.codfat || null;
      
      // ⚠️ IMPORTANTE: nrodoc_fiscal e codnumerico são DIFERENTES!
      // - nrodoc_fiscal = NÚMERO SEQUENCIAL da NFe (9 dígitos, ex: 096503831)
      // - codnumerico = cNF do XML - código aleatório (8 dígitos, ex: 38310201)
      
      // CORREÇÃO: nrodoc_fiscal deve ser o número sequencial da NFe, NÃO o cNF!
      const nrodoc_fiscal = numeroNFe; // Número sequencial da NFe (ex: 96503831)
      
      // Gerar/buscar cNF (8 dígitos) para codnumerico
      const cnfRandom = Math.floor(Math.random() * 1e8); // 8 dígitos
      const cnfXML = dados?.ide?.cNF || cnfRandom.toString().padStart(8, '0');
      const codnumerico = cnfXML; // cNF do XML (8 dígitos) - código aleatório
      
      const serie = serieNFe || '1';

      console.log('📝 Dados para salvar no banco:', {
        codfat,
        nrodoc_fiscal: nrodoc_fiscal + ' (NÚMERO SEQUENCIAL da NFe)',
        codnumerico: codnumerico + ' (cNF - código aleatório)',
        serie: serie,
        chave: chave,
        numeroNFe: numeroNFe,
        fonte_numero: 'Extraído do xmlNFeOnly',
        fonte_codfat: 'dados.codfat ou dados.dbfatura.codfat',
        nota_importante: 'CORRIGIDO: nrodoc_fiscal = NÚMERO NFe (sequencial), codnumerico = cNF (aleatório)'
      });

      console.log('🔍 VERIFICAÇÃO CRÍTICA - Valores que serão salvos:');
      console.log('  ✅ nrodoc_fiscal (NÚMERO NFe sequencial):', nrodoc_fiscal);
      console.log('  ✅ codnumerico (cNF aleatório 8 dígitos):', codnumerico);
      console.log('  ✅ numeroNFe (mesmo que nrodoc_fiscal):', numeroNFe);
      console.log('  ⚠️ serie deve ser série da NFe:', serie);
      console.log('  ⚠️ codfat deve ser código da fatura:', codfat);

      // 🔍 DEBUG: Log específico do codfat para email
      console.log('🔍 DEBUG - Extração do codfat:', {
        codfat_final: codfat,
        codfat_tipo: typeof codfat,
        dados_codfat: dados?.codfat,
        dbfatura_codfat: dados?.dbfatura?.codfat,
        dados_existe: !!dados,
        dbfatura_existe: !!dados?.dbfatura,
      });

      // --- SALVAR NA BASE DE DADOS (usando pg, pool compartilhado) ---
      try {
        // codnumerico já foi gerado acima (linhas 559-561)
        const modelo = '55';
        const versao = '4.00';

        // CORREÇÃO: Garantir que tipo_emissao seja numérico e emailenviado seja 1 caractere
        const tipo_emissao = 1; // Numérico conforme estrutura da tabela
        const tpemissao = 1; // Número inteiro
        const emailenviado = 'N'; // String de 1 caractere (S/N)

        const dataEmissao = new Date();
        // Guarda a NFe ASSINADA (não a xmlBruto sem assinatura): é o XML que a SEFAZ
        // autorizou e o que o cliente/contador precisa (para montar o nfeProc no envio).
        const xmlremessa = xmlAssinado || xmlBruto;
        const xmlretorno = xmlResposta;
        const pdfBase64 = pdfBuffer.toString('base64');

        // CORREÇÃO: O campo status aceita até 4 caracteres, então podemos usar o valor completo
        const statusChar = status ? String(status) : null;

        // Logar todos os valores antes do insert
        console.log('[dbfat_nfe] Valores para insert:', {
          codfat,
          nrodoc_fiscal,
          codnumerico,
          dataEmissao,
          chave,
          versao,
          xmlremessa: xmlremessa.length + ' chars',
          xmlretorno: xmlretorno.length + ' chars',
          statusChar,
          protocolo,
          motivo: motivo ? motivo.substring(0, 2000) : null, // Limitar a 2000 caracteres
          tipo_emissao,
          modelo,
          tpemissao,
          emailenviado,
        });

        console.log('[DEBUG] Fontes dos dados:');
        console.log('- dadosNormalizados.fatura:', dadosNormalizados?.fatura);
        console.log('- dados.dbfatura:', dados?.dbfatura);
        console.log('- dados.codfat (payload principal):', dados?.codfat);
        console.log('- nrodoc_fiscal (número NFe):', nrodoc_fiscal);
        console.log('- serie NFe:', serie);
        console.log('- codfat extraído:', codfat);

        // Checagem de campos essenciais - codfat pode ser codvenda se não tiver fatura
        if (!codfat || !nrodoc_fiscal || !chave) {
          throw new Error('Campos essenciais para salvar a NF-e estão faltando: ' + JSON.stringify({ codfat, nrodoc_fiscal, chave, serie }));
        }

        const client = await getPgPool().connect();

        try {
          const result = await client.query(
            `INSERT INTO db_manaus.dbfat_nfe (
              codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, xmlremessa, xmlretorno, status, numprotocolo, dthrprotocolo, motivo, tipo_emissao, modelo, tpemissao, imagem, emailenviado
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              codfat,
              nrodoc_fiscal,
              codnumerico,
              dataEmissao,
              chave,
              versao,
              xmlremessa,
              xmlretorno,
              statusChar, // Garantir que seja 1 caractere
              protocolo,
              dataEmissao,
              motivo ? motivo.substring(0, 2000) : null, // Limitar a 2000 caracteres conforme tabela
              tipo_emissao, // String de 1 caractere
              modelo,
              tpemissao,
              Buffer.from(pdfBase64, 'base64'),
              emailenviado,
            ],
          );
          console.log('NF-e salva na tabela dbfat_nfe:', result.rowCount);
          console.log(
            '✅ Dados salvos: nrodoc_fiscal=' +
              nrodoc_fiscal +
              ', série obtida via dbfatura.codfat',
          );
        } finally {
          client.release();
        }
      } catch (e) {
        console.error('Erro ao salvar nota na base (pg):', e);
        // Não impede o retorno da nota, apenas loga o erro
      }

      console.log('✅ NF-e processada com sucesso!', {
        chaveAcesso,
        protocolo,
        codfat: codfat,
        pdfGerado: pdfBuffer ? 'Sim' : 'Não',
      });

      // � DEBUG: Verificar se codfat está disponível para email
      console.log('🔍 DEBUG - Verificação de codfat para email:', {
        codfat_valor: codfat,
        codfat_tipo: typeof codfat,
        codfat_existe: !!codfat,
        dados_codfat: dados?.codfat,
        dbfatura_codfat: dados?.dbfatura?.codfat,
      });

      // 📧 ENVIO AUTOMÁTICO DE EMAIL PARA O CLIENTE
      if (codfat && dados.dbclien?.email) {
        const emailCliente = dados.dbclien.email;
        const nomeCliente =
          dados.dbclien.nomefant || dados.dbclien.nome || 'Cliente';

        console.log('📧 Iniciando envio automático de email para o cliente:', {
          email: emailCliente,
          nome: nomeCliente,
          codfat: codfat,
        });

        // Executar envio em background usando setTimeout
        setTimeout(async () => {
          try {
            console.log(
              '🚀 Enviando email NFe em background para o cliente...',
            );

            const emailResponse = await axios.post(
              `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/faturamento/enviar-email-nfe`,
              {
                codfat: codfat,
                emailCliente: emailCliente,
                nomeCliente: nomeCliente,
                xmlAssinado: xmlAssinado, // Incluir o XML assinado para envio
              },
            );

            if (emailResponse.status === 200) {
              console.log(
                `✅ Email NFe enviado com sucesso para: ${emailCliente}`,
              );
            } else {
              console.error(
                `❌ Erro no envio para ${emailCliente}:`,
                emailResponse.data,
              );
            }
          } catch (emailError) {
            if (axios.isAxiosError(emailError)) {
              console.error('❌ Erro do Axios no envio de email:', {
                status: emailError.response?.status,
                data: emailError.response?.data,
                message: emailError.message,
              });
            } else {
              console.error(
                '❌ Falha geral no envio automático de email:',
                emailError instanceof Error ? emailError.message : emailError,
              );
            }
          }
        }, 1000); // Aguarda 1 segundo para garantir que a resposta HTTP foi enviada
      } else {
        console.log('⚠️ Email não enviado:', {
          codfat_existe: !!codfat,
          email_cliente: dados.dbclien?.email || 'não informado',
          motivo: !codfat
            ? 'codfat não disponível'
            : 'cliente sem email cadastrado',
        });
      }

      return res.status(200).json({
        sucesso: true,
        status,
        motivo,
        protocolo,
        chaveAcesso,
        pdfBase64: pdfBuffer.toString('base64'),
        emailEnviado: !!(codfat && dados.dbclien?.email), // Email será enviado se codfat existe e cliente tem email
        emailCliente: dados.dbclien?.email || null,
      });
    }

    // Se a nota não foi autorizada (status diferente de 100), retorna o erro
    console.log('❌ NFe rejeitada pela SEFAZ:', status, motivo);
    
    // IMPORTANTE: Salvar também NFes rejeitadas para manter histórico de numeração
    // Isso evita duplicidade pois o endpoint de próximo número verá todas as tentativas
    try {
      const codfat = dados.dbfatura?.codfat || dados.codfat || '';

      // Extrair número e série do XML original (antes de enviar)
      const xmlOriginalParsed = await parseStringPromise(xmlNFeOnly, {
        explicitArray: false,
        tagNameProcessors: [(name) => name.split(':').pop() || name],
      });

      const ideOriginal = xmlOriginalParsed?.NFe?.infNFe?.ide;
      const numeroNFe = ideOriginal?.nNF?.toString() || '1';
      const serieNFe = ideOriginal?.serie?.toString() || '1';

      // Extrair chave de acesso do XML ou da resposta da SEFAZ
      const infNFeId = xmlOriginalParsed?.NFe?.infNFe?.['@Id'];
      const chaveAcesso = infNFeId
        ? infNFeId.replace('NFe', '')
        : retEnviNFe.protNFe?.infProt?.chNFe || '';

      console.log('📝 Salvando NFe rejeitada no histórico:', {
        codfat,
        numeroNFe,
        serieNFe,
        chave: chaveAcesso?.substring(0, 20) + '...',
        status,
        motivo: motivo?.substring(0, 50) + '...',
      });

      if (codfat && chaveAcesso) {
        const client = await getPgPool().connect();
        try {
          const baseRandom = Math.floor(Math.random() * 1e6);
          const timestamp = Date.now().toString().slice(-3);
          const codnumerico =
            baseRandom.toString().padStart(6, '0') + timestamp;

          await client.query(
            `INSERT INTO db_manaus.dbfat_nfe (
              codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, xmlremessa, xmlretorno, 
              status, numprotocolo, dthrprotocolo, motivo, tipo_emissao, modelo, tpemissao, emailenviado
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
              codfat,
              numeroNFe,
              codnumerico,
              new Date(),
              chaveAcesso,
              '4.00',
              xmlBruto,
              xmlResposta,
              String(status),
              protocolo,
              new Date(),
              motivo ? motivo.substring(0, 2000) : null,
              1,
              '55',
              1,
              'N',
            ],
          );
          console.log(
            '✅ NFe rejeitada salva no histórico (codfat:',
            codfat,
            ', número:',
            numeroNFe,
            ')',
          );
        } finally {
          client.release();
        }
      }
    } catch (erroSalvar) {
      console.error(
        '⚠️ Erro ao salvar NFe rejeitada no histórico:',
        erroSalvar,
      );
      // Não impede o retorno do erro, apenas loga
    }
    
    // Registrar a mensagem de erro nas tabelas
    const codfat = dados.dbfatura?.codfat || '';
    const _serieUsada = dados.dbfatura?.serie || '';
    const ieUsada = dados.emitente?.ie || '';
    const cnpjUsado = dados.emitente?.cnpj || '';

    if (codfat) {
      await registrarMensagemFatura(
        codfat,
        status, // código do erro (ex: 610, 539, etc)
        motivo || 'Erro não especificado pela SEFAZ',
      );

      // CORREÇÃO: Atualizar campo 'denegada' para 'S' se status for 301, 302 ou 303
      if (status === '301' || status === '302' || status === '303') {
        try {
          const client = await getPgPool().connect();
          try {
            await client.query(
              `UPDATE db_manaus.dbfatura SET denegada = 'S' WHERE codfat = $1`,
              [codfat],
            );
            console.log(
              `✅ Campo 'denegada' atualizado para 'S' na fatura ${codfat} (status SEFAZ: ${status})`,
            );
          } finally {
            client.release();
          }
        } catch (erroDenegada) {
          console.error('❌ Erro ao atualizar campo denegada:', erroDenegada);
        }
      }
    }

    // 🚨 TRATAMENTO ESPECIAL: Erro de série vinculada a outra IE
    const erroSerieVinculada =
      motivo &&
      motivo.toLowerCase().includes('serie') &&
      motivo.toLowerCase().includes('vinculada') &&
      motivo.toLowerCase().includes('inscricao');

    const serieUsadaMsg = String(dados?.dbfatura?.serie ?? serieEmissao ?? '?');
    if (erroSerieVinculada) {
      // Loga o retorno LITERAL da SEFAZ — sem inventar explicação nem sugerir UPDATE.
      console.error('🚨 REJEIÇÃO SEFAZ (série vinculada a IE)');
      console.error(`   cStat: ${status} | xMotivo: ${motivo}`);
      console.error(`   CNPJ: ${cnpjUsado} | Série: ${serieUsadaMsg} | IE enviada: ${ieUsada}`);
    }

    return res.status(400).json({
      sucesso: false,
      status: status,
      motivo: motivo,
      protocolo: protocolo,
      // Informações adicionais para erro de série vinculada
      ...(erroSerieVinculada && {
        detalhes: {
          tipo_erro: 'serie_vinculada_ie',
          cStat: status,
          cnpj: cnpjUsado,
          serie: serieUsadaMsg,
          ie: ieUsada,
          xMotivo: motivo, // retorno LITERAL da SEFAZ — sem tradução nem sugestão de UPDATE
        },
      }),
    });

  } catch (error: any) {
    const detalhe = error?.response?.data || error.message || error;
    console.error('❌ Erro ao emitir NF-e:', JSON.stringify(detalhe, null, 2));

    // Registrar erro genérico nas tabelas se houver codfat
    const codfat = req.body?.dbfatura?.codfat;
    if (codfat) {
      await registrarMensagemFatura(
        codfat,
        'ERRO_GERAL',
        `Erro no processamento: ${error.message || 'Erro desconhecido'}`,
      );
    }

    return res.status(500).json({
      sucesso: false,
      erro: 'Erro no processamento da NF-e.',
      detalhe: detalhe.toString(),
    });
  }
}
