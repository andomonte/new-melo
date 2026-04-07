import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import { gerarXMLNFe } from '@/components/services/sefazNfe/gerarXml';
import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { gerarXmlCupomFiscal } from '@/utils/gerarXmlCupomFiscal';
import { adicionarQRCodeNFCe } from '@/utils/adicionarQRCodeNFCe';
import { gerarNotaFiscalValida } from '@/utils/gerarPreviewNF';
import { gerarPreviewCupomFiscal } from '@/utils/gerarPDFCupomFiscal';
import { normalizarPayloadNFe } from '@/utils/normalizarPayloadNFe';
import { decrypt } from '@/utils/crypto';
import { extrairCNPJDoCertificado } from '@/utils/certificadoExtractor';
import { create } from 'xmlbuilder2';
import { getPgPool } from '@/lib/pg';
import { getAmbienteSefaz, getUrlSefazAtual } from '@/utils/gerarXmlCupomFiscal';
import { DOMParser } from 'xmldom';

/**
 * API para re-emissão de NF-e ou NFC-e de faturas existentes (rejeitadas ou pendentes)
 * Detecta automaticamente se deve gerar NF-e (CNPJ) ou NFC-e (CPF) baseado no cliente
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    // Busca codfat do body
    const { codfat } = req.body;
    if (!codfat) {
      return res.status(400).json({ erro: 'codfat não informado' });
    }

    console.log('🔄 [emitir-faturado] Iniciando re-emissão para codfat:', codfat);

    // 1️⃣ BUSCAR DADOS COMPLETOS DO BANCO
    if (!getPgPool()) {
      throw new Error('Database connection pool is not initialized.');
    }
    
    const client = await getPgPool().connect();
    let dbfatura: any, dbvenda: any, dbclien: any, produtos: any[];
    
    try {
      // Busca fatura
      console.log('📋 Buscando dados da fatura...');
      const fatRes = await client.query(
        'SELECT * FROM db_manaus.dbfatura WHERE codfat = $1',
        [codfat],
      );
      dbfatura = fatRes.rows[0];
      if (!dbfatura) throw new Error('Fatura não encontrada');

      // Buscar codvenda via tabela fatura_venda (relacionamento correto)
      console.log('📋 Buscando codvenda via fatura_venda...');
      const faturaVendaRes = await client.query(
        'SELECT codvenda FROM db_manaus.fatura_venda WHERE codfat = $1',
        [codfat],
      );
      
      let codvendaParaBusca = faturaVendaRes.rows[0]?.codvenda;

      // Se não encontrou na fatura_venda, tentar via nrovenda na dbvenda
      if (!codvendaParaBusca && dbfatura.nrovenda) {
        console.log('📋 Buscando codvenda via nrovenda...');
        const vendaPorNroRes = await client.query(
          'SELECT codvenda FROM db_manaus.dbvenda WHERE nrovenda = $1 OR codvenda = $1',
          [dbfatura.nrovenda],
        );
        codvendaParaBusca = vendaPorNroRes.rows[0]?.codvenda;
      }

      if (!codvendaParaBusca) {
        throw new Error(`Código da venda não encontrado para a fatura ${codfat}. Verifique se a fatura está vinculada a uma venda.`);
      }

      console.log(`✅ codvenda encontrado: ${codvendaParaBusca}`);

      // Busca venda vinculada
      console.log('📋 Buscando dados da venda...');
      const vendaRes = await client.query(
        'SELECT * FROM db_manaus.dbvenda WHERE codvenda = $1',
        [codvendaParaBusca],
      );
      dbvenda = vendaRes.rows[0];

      // Busca cliente
      console.log('📋 Buscando dados do cliente...');
      const codcliParaBusca = dbvenda?.codcli || dbfatura.codcli;
      const clienteRes = await client.query(
        'SELECT * FROM db_manaus.dbclien WHERE codcli = $1',
        [codcliParaBusca],
      );
      dbclien = clienteRes.rows[0];

      // Busca produtos da venda
      console.log('📋 Buscando produtos da venda...');
      const produtosRes = await client.query(
        `SELECT iv.*, p.descr as descr_produto, p.clasfiscal, p.unimed
         FROM db_manaus.dbitvenda iv
         LEFT JOIN db_manaus.dbprod p ON iv.codprod = p.codprod
         WHERE iv.codvenda = $1`,
        [codvendaParaBusca],
      );
      produtos = produtosRes.rows;
      
      if (!produtos || produtos.length === 0) {
        throw new Error('Nenhum produto encontrado para a fatura');
      }

      console.log(`✅ Dados carregados: ${produtos.length} produtos`);
    } finally {
      client.release();
    }

    // 2️⃣ DETERMINAR TIPO DE DOCUMENTO (NFe ou NFCe)
    const documentoCliente = (dbclien?.cpfcgc || '').replace(/\D/g, '');
    const isPessoaFisica = documentoCliente.length === 11;
    const tipoDocumento = isPessoaFisica ? 'NFC-e' : 'NF-e';
    const modelo = isPessoaFisica ? '65' : '55';
    
    console.log('📋 Tipo de cliente:', {
      documento: documentoCliente,
      tamanho: documentoCliente.length,
      isPessoaFisica,
      tipoDocumento,
      modelo
    });

    // 3️⃣ BUSCAR DADOS DA EMPRESA E CERTIFICADOS
    console.log('🔐 Buscando dados da empresa e certificados...');
    
    const empresaQuery = await getPgPool().query(`
      SELECT * FROM db_manaus.dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoCrt" IS NOT NULL
      LIMIT 1
    `);

    if (empresaQuery.rows.length === 0) {
      throw new Error('Nenhuma empresa com certificados digitais configurados');
    }

    const emitenteRaw = empresaQuery.rows[0];
    
    // Descriptografar certificados
    const certificadoKey = await decrypt(emitenteRaw.certificadoKey);
    const certificadoCrt = await decrypt(emitenteRaw.certificadoCrt);
    const cadeiaCrt = emitenteRaw.cadeiaCrt ? await decrypt(emitenteRaw.cadeiaCrt) : null;
    
    if (!certificadoKey || !certificadoCrt) {
      throw new Error('Erro ao descriptografar certificados digitais');
    }

    // Validar CNPJ do certificado
    const cnpjCertificado = extrairCNPJDoCertificado(certificadoCrt);
    const cnpjEmpresa = emitenteRaw.cgc.replace(/\D/g, '');
    
    if (!cnpjCertificado || cnpjCertificado !== cnpjEmpresa) {
      throw new Error(`Certificado não corresponde ao CNPJ da empresa`);
    }

    console.log('✅ Certificados validados para CNPJ:', cnpjEmpresa);

    // 4️⃣ MONTAR DADOS DO EMITENTE
    const emitente = {
      cnpj: emitenteRaw.cgc,
      cgc: emitenteRaw.cgc,
      xNome: emitenteRaw.nomecontribuinte,
      nomecontribuinte: emitenteRaw.nomecontribuinte,
      nomefantasia: emitenteRaw.nomecontribuinte, // Adicionado para compatibilidade
      ie: emitenteRaw.inscricaoestadual,
      inscricaoestadual: emitenteRaw.inscricaoestadual,
      crt: emitenteRaw.crt || '3',
      enderEmit: {
        xLgr: emitenteRaw.logradouro,
        nro: emitenteRaw.numero,
        xBairro: emitenteRaw.bairro,
        cMun: '1302603', // Manaus
        xMun: emitenteRaw.municipio,
        UF: emitenteRaw.uf || 'AM',
        CEP: emitenteRaw.cep,
      },
      logradouro: emitenteRaw.logradouro,
      numero: emitenteRaw.numero,
      bairro: emitenteRaw.bairro,
      municipio: emitenteRaw.municipio,
      uf: emitenteRaw.uf || 'AM',
      cep: emitenteRaw.cep,
      telefone: emitenteRaw.telefone || '',
    };

    // 5️⃣ PREPARAR DADOS PARA EMISSÃO
    const dados = {
      codfat,
      dbfatura,
      dbvenda,
      dbclien,
      dbitvenda: produtos,
      produtos,
      emitente,
    };

    // Ambiente SEFAZ
    const ambienteSefaz = getAmbienteSefaz();
    const isHomologacao = ambienteSefaz === 'HOMOLOGACAO';
    console.log(`🌐 Ambiente SEFAZ: ${ambienteSefaz}`);

    let xmlAssinado: string;
    let urlSefaz: string;
    let chaveAcesso: string = '';

    // 6️⃣ GERAR E ASSINAR XML (DIFERENTE PARA NFe E NFCe)
    if (isPessoaFisica) {
      // ========== NFC-e (CUPOM FISCAL) ==========
      console.log('🎫 Gerando NFC-e (Cupom Fiscal) para pessoa física...');
      
      // Obter CSC para NFC-e
      let cscId = '1';
      let cscToken = '';
      
      if (isHomologacao) {
        // ✅ Carregar CSC de HOMOLOGAÇÃO (igual emitir-cupom.ts)
        if (emitenteRaw.csc_nfce_id && emitenteRaw.csc_nfce_homologacao) {
          // Remover zeros à esquerda do CSC ID
          cscId = String(parseInt(emitenteRaw.csc_nfce_id, 10) || 1);
          const cscDecrypted = await decrypt(emitenteRaw.csc_nfce_homologacao);
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
        if (!emitenteRaw.csc_nfce_id || !emitenteRaw.csc_nfce_producao) {
          throw new Error('CSC de produção não configurado para NFC-e');
        }
        // Remover zeros à esquerda do CSC ID
        cscId = String(parseInt(emitenteRaw.csc_nfce_id, 10) || 1);
        cscToken = await decrypt(emitenteRaw.csc_nfce_producao) || '';
        console.log(`✅ CSC de PRODUÇÃO carregado (ID: ${cscId})`);
      }

      const nroformEmissao = dbfatura.nroform || '1';
      let serieEmissao = dbfatura.serie || '1';
      
      // 🧪 Em homologação, forçar série 1 (geralmente a série padrão cadastrada)
      if (isHomologacao && serieEmissao === '2') {
        console.log('🧪 HOMOLOGAÇÃO: Alterando série 2 → 1 (série padrão)');
        serieEmissao = '1';
      }
      
      // Preparar produtos para NFC-e
      const produtosNFCe = produtos.map((item: any, index: number) => {
        const qtde = Number(item.qtd ?? 1);
        const preco = Number(item.prunit ?? 0);
        const vProd = Math.round(qtde * preco * 100) / 100;
        
        let descricao = item.descr_produto?.trim() || item.descr?.trim() || `Produto ${index + 1}`;
        if (index === 0 && isHomologacao) {
          descricao = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
        }

        // Calcular alíquotas a partir dos valores do banco
        // SEFAZ valida consistência: pAliq * vBC = vImposto
        const vICMS = parseFloat(item.totalicms || 0);
        const vPIS = parseFloat(item.valorpis || 0);
        const vCOFINS = parseFloat(item.valorcofins || 0);
        
        // Calcular alíquotas (evitar divisão por zero)
        const pICMS = vProd > 0 ? Math.round((vICMS / vProd) * 10000) / 100 : 0;
        const pPIS = vProd > 0 ? Math.round((vPIS / vProd) * 10000) / 100 : 0;
        const pCOFINS = vProd > 0 ? Math.round((vCOFINS / vProd) * 10000) / 100 : 0;

        return {
          codigo: item.codprod ?? `P${index + 1}`,
          descricao,
          ncm: /^[0-9]{8}$/.test(item.clasfiscal) ? item.clasfiscal : '84714900',
          cfop: item.cfop || '5102',
          unidade: item.unimed || 'UN',
          quantidade: qtde,
          valorUnitario: preco,
          valorTotal: vProd,
          aliquota_ibs: 27,
          aliquota_cbs: 10,
          icms: {
            cstICMS: (item.csticms ?? '00').toString().padStart(2, '0').slice(-2),
            baseICMS: vProd,
            pICMS: pICMS,
            vICMS: vICMS,
          },
          pis: { cstPIS: '01', vBC: vProd, pPIS: pPIS, vPIS: vPIS },
          cofins: { cstCOFINS: '01', vBC: vProd, pCOFINS: pCOFINS, vCOFINS: vCOFINS },
        };
      });

      const totalProdutos = produtosNFCe.reduce((sum: number, p: any) => sum + p.valorTotal, 0);
      const totalICMS = produtosNFCe.reduce((sum: number, p: any) => sum + p.icms.vICMS, 0);
      const totalPIS = produtosNFCe.reduce((sum: number, p: any) => sum + p.pis.vPIS, 0);
      const totalCOFINS = produtosNFCe.reduce((sum: number, p: any) => sum + p.cofins.vCOFINS, 0);
      const totalNF = totalProdutos;

      // Preparar cliente com estrutura esperada pela função
      const clienteParaXml = {
        nome: dbclien?.nome || dbclien?.nomefant || 'CONSUMIDOR',
        nomefant: dbclien?.nomefant || dbclien?.nome || 'CONSUMIDOR',
        cpfcgc: documentoCliente,
        cpf_cnpj_cli: documentoCliente,
        ender: dbclien?.ender || '',
        numero: dbclien?.numero || '',
        bairro: dbclien?.bairro || '',
        cidade: dbclien?.cidade || '',
        uf: dbclien?.uf || 'AM',
        cep: dbclien?.cep || '',
      };

      // Gerar XML NFC-e
      const xmlCupom = await gerarXmlCupomFiscal({
        emitente,  // Usar emitente diretamente, não dados.emitente
        cliente: clienteParaXml,
        produtos: produtosNFCe,
        data: new Date(),
        pedido: nroformEmissao,
        serie: serieEmissao,
        totalProdutos: totalProdutos.toFixed(2),
        totalICMS: totalICMS.toFixed(2),
        totalIPI: '0.00',
        totalPIS: totalPIS.toFixed(2),
        totalCOFINS: totalCOFINS.toFixed(2),
        totalNF: totalNF.toFixed(2),
        desconto: '0.00',
        acrescimo: '0.00',
        frete: '0.00',
        seguro: '0.00',
        observacoes: '.',
      });

      // Assinar XML
      xmlAssinado = await assinarXMLComCertificados(
        xmlCupom,
        'infNFe',
        certificadoKey,
        certificadoCrt,
      );

      // Extrair chave de acesso
      const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
      chaveAcesso = chaveMatch ? chaveMatch[1] : '';
      
      if (!chaveAcesso || chaveAcesso.length !== 44) {
        throw new Error(`Chave de acesso inválida: ${chaveAcesso}`);
      }

      // Adicionar QR Code
      const xmlDoc = new DOMParser().parseFromString(xmlAssinado, 'application/xml');
      const dhEmiElements = xmlDoc.getElementsByTagName('dhEmi');
      const dataEmissao = dhEmiElements?.[0]?.textContent?.trim() || '';
      
      let cpfCliente = documentoCliente;
      if (isHomologacao && cpfCliente.length === 11) {
        cpfCliente = '01234567890';
      }

      xmlAssinado = adicionarQRCodeNFCe(
        xmlAssinado,
        chaveAcesso,
        totalNF.toFixed(2),
        cscId,
        cscToken,
        cpfCliente.length === 11 ? cpfCliente : undefined,
        dataEmissao
      );

      urlSefaz = getUrlSefazAtual('NFCE_AUTORIZACAO');

    } else {
      // ========== NF-e (NOTA FISCAL) ==========
      console.log('📄 Gerando NF-e (Nota Fiscal) para pessoa jurídica...');
      
      const dadosNormalizados = await normalizarPayloadNFe(dados);
      const xmlBruto = gerarXMLNFe(dadosNormalizados);

      xmlAssinado = await assinarXMLComCertificados(
        xmlBruto,
        'infNFe',
        certificadoKey,
        certificadoCrt,
      );

      // Extrair chave de acesso
      const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
      chaveAcesso = chaveMatch ? chaveMatch[1] : '';

      urlSefaz = getUrlSefazAtual('NFE_AUTORIZACAO');
    }

    console.log('✅ XML assinado, chave:', chaveAcesso);
    console.log('🔗 URL SEFAZ:', urlSefaz);

    // 7️⃣ MONTAR ENVELOPE SOAP E ENVIAR
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

    const agent = new https.Agent({
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
      rejectUnauthorized: false,
    });

    console.log('📤 Enviando para SEFAZ...');
    
    const sefazResponse = await axios.post(urlSefaz, envelope, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      },
      timeout: 30000,
    });

    const xmlResposta = sefazResponse.data;
    console.log('✅ Resposta recebida da SEFAZ');

    // 8️⃣ PROCESSAR RESPOSTA
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      tagNameProcessors: [(name) => name.split(':').pop() || name],
    });

    const retEnviNFe = json?.Envelope?.Body?.nfeResultMsg?.retEnviNFe;
    if (!retEnviNFe) {
      throw new Error('Estrutura de resposta da Sefaz inesperada');
    }

    let status: string, motivo: string, protocolo: string | null;

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

    console.log('✅ Status:', status, motivo);

    // 9️⃣ SE AUTORIZADO (100) - SALVAR E RETORNAR PDF
    if (status === '100') {
      // Limpar campo denegada
      try {
        const updateClient = await getPgPool().connect();
        try {
          await updateClient.query(
            `UPDATE db_manaus.dbfatura SET denegada = NULL WHERE codfat = $1`,
            [codfat],
          );
          console.log(`✅ Campo 'denegada' limpo na fatura ${codfat}`);
        } finally {
          updateClient.release();
        }
      } catch (e) {
        console.error('⚠️ Erro ao limpar campo denegada:', e);
      }

      // Gerar PDF
      let pdfBuffer: Buffer;
      const chaveAutorizada = retEnviNFe.protNFe?.infProt?.chNFe || chaveAcesso;
      const numeroNFe = dbfatura.nroform || '1';
      const serieNFe = dbfatura.serie || '1';

      const faturaParaPdf = {
        ...dbfatura,
        nomefant: dbclien?.nomefant || dbclien?.nome || '',
        cpfcgc: dbclien?.cpfcgc || '',
        ender: dbclien?.ender || '',
        numero: dbclien?.numero || 'S/N',
        bairro: dbclien?.bairro || '',
        cidade: dbclien?.cidade || '',
        uf: dbclien?.uf || '',
        cep: dbclien?.cep || '',
        fone: dbclien?.fone || '',
        iest: dbclien?.iest || '',
      };

      const dadosNFe = {
        chaveAcesso: chaveAutorizada,
        protocolo: protocolo || undefined,
        numeroNFe,
        serieNFe,
        dataEmissao: new Date().toISOString(),
        valorTotal: dbfatura.totalnf || 0,
      };

      if (isPessoaFisica) {
        const pdfDoc = await gerarPreviewCupomFiscal(
          faturaParaPdf,
          produtos,
          dbvenda || {},
          emitente,
          'valida',
          dadosNFe
        );
        pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
      } else {
        const pdfDoc = await gerarNotaFiscalValida(
          faturaParaPdf,
          produtos,
          dbvenda || {},
          emitente,
          dadosNFe
        );
        pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
      }

      // Salvar no banco
      try {
        const saveClient = await getPgPool().connect();
        try {
          const codnumerico = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
          
          await saveClient.query(
            `INSERT INTO db_manaus.dbfat_nfe (
              codfat, nrodoc_fiscal, codnumerico, "data", chave, versao, xmlremessa, xmlretorno, 
              status, numprotocolo, dthrprotocolo, motivo, tipo_emissao, modelo, tpemissao, imagem, emailenviado
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              codfat,
              numeroNFe,
              codnumerico,
              new Date(),
              chaveAutorizada,
              '4.00',
              xmlAssinado,
              xmlResposta,
              status,
              protocolo,
              new Date(),
              motivo?.substring(0, 2000),
              1,
              modelo,
              1,
              pdfBuffer,
              'N',
            ],
          );
          console.log('✅ Nota salva no banco');
          
          // Limpar status de denegação na fatura (se existir a coluna)
          try {
            await saveClient.query(
              `UPDATE db_manaus.dbfatura 
               SET denegada = NULL
               WHERE codfat = $1`,
              [codfat]
            );
            console.log('✅ Status de denegação limpo na fatura');
          } catch (e) {
            console.warn('⚠️ Não foi possível limpar status de denegação (coluna pode não existir):', e);
          }
        } finally {
          saveClient.release();
        }
      } catch (e) {
        console.error('⚠️ Erro ao salvar nota:', e);
      }

      return res.status(200).json({
        sucesso: true,
        status,
        motivo,
        protocolo,
        chaveAcesso: chaveAutorizada,
        tipoDocumento,
        modelo,
        pdfBase64: pdfBuffer.toString('base64'),
      });
    }

    // 🔟 SE REJEITADO - ATUALIZAR DENEGADA SE NECESSÁRIO
    if (status === '301' || status === '302' || status === '303') {
      try {
        const updateClient = await getPgPool().connect();
        try {
          await updateClient.query(
            `UPDATE db_manaus.dbfatura SET denegada = 'S' WHERE codfat = $1`,
            [codfat],
          );
          console.log(`✅ Campo 'denegada' atualizado para 'S'`);
        } finally {
          updateClient.release();
        }
      } catch (e) {
        console.error('❌ Erro ao atualizar denegada:', e);
      }
    }

    return res.status(400).json({
      sucesso: false,
      status,
      motivo,
      protocolo,
      tipoDocumento,
      modelo,
    });

  } catch (error: any) {
    let detalhe = error?.response?.data || error.message || error;
    if (typeof detalhe === 'object') {
      detalhe = JSON.stringify(detalhe, null, 2);
    }
    console.error('❌ Erro ao emitir:', detalhe);

    return res.status(500).json({
      sucesso: false,
      erro: 'Erro no processamento da nota fiscal.',
      detalhe,
    });
  }
}
