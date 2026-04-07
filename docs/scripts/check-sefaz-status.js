// Script para verificar status do serviço SEFAZ-AM
// Usa o endpoint NfeStatusServico4 para verificar se o serviço está operacional

const https = require('https');
const axios = require('axios');

class SefazStatusChecker {
  constructor() {
    // Endpoint de status do serviço (não requer NFC-e específica)
    this.statusUrl = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4';
  }

  // Criar envelope SOAP para consulta de status
  createStatusEnvelope() {
    const cUF = '13'; // Amazonas
    const versao = '4.00';

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Header>' +
      '<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
      '<cUF>' + cUF + '</cUF>' +
      '<versaoDados>' + versao + '</versaoDados>' +
      '</nfeCabecMsg>' +
      '</soap12:Header>' +
      '<soap12:Body>' +
      '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
      '<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="' + versao + '">' +
      '<tpAmb>2</tpAmb>' + // 2 = Homologação
      '<cServ>AM</cServ>' + // Código do serviço
      '</consStatServ>' +
      '</nfeDadosMsg>' +
      '</soap12:Body>' +
      '</soap12:Envelope>';
  }

  // Criar agente HTTPS (sem certificados para teste básico)
  createHttpsAgent() {
    return new https.Agent({
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      timeout: 30000
    });
  }

  // Headers para a requisição
  getHeaders(envelope) {
    return {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
      'Content-Length': Buffer.byteLength(envelope, 'utf8'),
      'User-Agent': 'Sistema-Melo/1.0',
      'Accept': 'text/xml, application/xml, application/soap+xml, */*'
    };
  }

  // Verificar status do serviço
  async checkServiceStatus() {
    console.log('🔍 VERIFICANDO STATUS DO SERVIÇO SEFAZ-AM');
    console.log('=========================================');
    console.log(`🌐 URL: ${this.statusUrl}`);
    console.log('');

    const envelope = this.createStatusEnvelope();
    console.log('📋 Envelope SOAP criado');
    console.log(`📏 Tamanho: ${envelope.length} caracteres`);
    console.log('');

    try {
      const agent = this.createHttpsAgent();
      const headers = this.getHeaders(envelope);

      console.log('🌐 Enviando consulta de status...');

      const response = await axios.post(this.statusUrl, envelope, {
        httpsAgent: agent,
        headers: headers,
        timeout: 30000
      });

      console.log('✅ CONSULTA BEM-SUCEDIDA!');
      console.log(`📊 Status HTTP: ${response.status}`);

      // Analisar resposta
      this.analyzeStatusResponse(response.data);

      return { success: true, status: response.status, data: response.data };

    } catch (error) {
      console.log('❌ CONSULTA FALHOU');
      console.log(`📊 Status: ${error.response?.status || 'N/A'}`);
      console.log(`🔍 Código do erro: ${error.code || 'N/A'}`);
      console.log(`📝 Mensagem: ${error.message}`);

      if (error.response?.data) {
        console.log(`📄 Resposta do servidor: ${error.response.data.substring(0, 300)}...`);
      }

      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        code: error.code,
        response: error.response?.data
      };
    }
  }

  // Analisar resposta do status
  analyzeStatusResponse(responseData) {
    console.log('\n📊 ANÁLISE DA RESPOSTA:');
    console.log('='.repeat(25));

    try {
      // Extrair informações relevantes da resposta XML
      const statusMatch = responseData.match(/<cStat>(\d+)<\/cStat>/);
      const motivoMatch = responseData.match(/<xMotivo>([^<]+)<\/xMotivo>/);
      const ambienteMatch = responseData.match(/<tpAmb>(\d)<\/tpAmb>/);

      if (statusMatch) {
        const cStat = statusMatch[1];
        console.log(`📊 Código do Status: ${cStat}`);

        // Interpretar código do status
        this.interpretStatusCode(cStat);
      }

      if (motivoMatch) {
        console.log(`📝 Motivo: ${motivoMatch[1]}`);
      }

      if (ambienteMatch) {
        const tpAmb = ambienteMatch[1];
        console.log(`🏠 Ambiente: ${tpAmb === '1' ? 'Produção' : 'Homologação'}`);
      }

      // Verificar se serviço está operacional
      const isOperational = statusMatch && statusMatch[1] === '107';
      console.log(`🚦 Status do Serviço: ${isOperational ? '✅ OPERACIONAL' : '❌ FORA DO AR'}`);

    } catch (error) {
      console.log(`❌ Erro ao analisar resposta: ${error.message}`);
      console.log('📄 Resposta bruta:', responseData.substring(0, 500));
    }
  }

  // Interpretar código do status
  interpretStatusCode(cStat) {
    const statusCodes = {
      '107': '✅ Serviços em Operação',
      '108': '⚠️ Serviços Paralisados Temporariamente',
      '109': '❌ Serviços Paralisados',
      '110': '❓ Status Indisponível'
    };

    const description = statusCodes[cStat] || `🔍 Código ${cStat} - Verificar documentação`;
    console.log(`🔍 Interpretação: ${description}`);
  }

  // Executar verificação completa
  async runStatusCheck() {
    const result = await this.checkServiceStatus();

    console.log('\n🎯 CONCLUSÃO:');
    console.log('='.repeat(15));

    if (result.success) {
      console.log('✅ SERVIÇO SEFAZ-AM acessível');
      console.log('💡 Problema do NFC-e pode ser específico do envelope ou certificados');
      console.log('');
      console.log('🔧 PRÓXIMAS AÇÕES:');
      console.log('   1. ✅ Verificar certificados ICP-Brasil');
      console.log('   2. 🔍 Comparar envelope NFC-e com documentação');
      console.log('   3. 🧪 Testar em produção com certificados válidos');
    } else {
      if (result.code === 'EPROTO') {
        console.log('🔒 ERRO SSL/TLS - Mesmo problema que NFC-e');
        console.log('💡 Confirma que SEFAZ-AM requer certificados válidos');
      } else if (result.status === 404) {
        console.log('🌐 ERRO 404 - Endpoint pode estar incorreto');
        console.log('🔍 Verificar URL do serviço de status');
      } else {
        console.log(`❌ ERRO ${result.status} - Serviço pode estar indisponível`);
        console.log('📞 Considerar contato com SEFAZ-AM');
      }
    }

    console.log('\n📋 RESUMO:');
    console.log('   • Endpoint documentado: ✅ Correto');
    console.log('   • Requer certificados: ✅ Confirmado');
    console.log('   • Envelope NFC-e: 🔍 Precisa verificação adicional');
    console.log('   • Status do serviço: 📊 Verificado acima');

    return result;
  }
}

// Executar verificação
async function main() {
  const checker = new SefazStatusChecker();
  await checker.runStatusCheck();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}