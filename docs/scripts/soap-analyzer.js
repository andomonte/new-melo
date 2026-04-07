// Script de análise de envelope SOAP para NFC-e
// Criado para auxiliar no diagnóstico de problemas com SEFAZ-AM

const fs = require('fs');
const path = require('path');

class SoapEnvelopeAnalyzer {
  constructor() {
    this.envelope = null;
  }

  /**
   * Carrega um envelope SOAP de um arquivo
   */
  loadFromFile(filePath) {
    try {
      this.envelope = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ Envelope carregado de: ${filePath}`);
      console.log(`📏 Tamanho: ${this.envelope.length} caracteres`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao carregar arquivo: ${error.message}`);
      return false;
    }
  }

  /**
   * Define o envelope SOAP diretamente
   */
  setEnvelope(envelope) {
    this.envelope = envelope;
    console.log(`✅ Envelope definido manualmente`);
    console.log(`📏 Tamanho: ${this.envelope.length} caracteres`);
  }

  /**
   * Analisa a estrutura do envelope SOAP
   */
  analyzeStructure() {
    if (!this.envelope) {
      console.error('❌ Nenhum envelope carregado');
      return false;
    }

    console.log('\n🔍 ANÁLISE DA ESTRUTURA SOAP');
    console.log('==============================');

    // Verificar namespaces
    console.log('\n📋 VERIFICAÇÃO DE NAMESPACES:');
    const namespaces = {
      'SOAP Envelope': this.envelope.includes('xmlns:soap=') || this.envelope.includes('xmlns:soap12='),
      'NFe Autorização': this.envelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"'),
      'NFe': this.envelope.includes('xmlns="http://www.portalfiscal.inf.br/nfe"'),
      'XML Signature': this.envelope.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"')
    };

    Object.entries(namespaces).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });

    // Verificar estrutura básica
    console.log('\n📦 ESTRUTURA SOAP:');
    const estrutura = {
      'Envelope': this.envelope.includes('<soap:Envelope') || this.envelope.includes('<soap12:Envelope'),
      'Body': this.envelope.includes('<soap:Body>') || this.envelope.includes('<soap12:Body>'),
      'nfeAutorizacaoLote': this.envelope.includes('<nfeAutorizacaoLote'),
      'nfeDadosMsg': this.envelope.includes('<nfeDadosMsg>'),
      'enviNFe': this.envelope.includes('<enviNFe')
    };

    Object.entries(estrutura).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });

    // Verificar NFC-e específica
    console.log('\n🎫 CAMPOS NFC-E:');
    const nfeFields = {
      'Modelo 65': this.envelope.includes('<mod>65</mod>'),
      'Ambiente Homologação': this.envelope.includes('<tpAmb>2</tpAmb>'),
      'Assinatura Digital': this.envelope.includes('<Signature'),
      'QR Code': this.envelope.includes('<qrCode>'),
      'infNFeSupl': this.envelope.includes('<infNFeSupl>')
    };

    Object.entries(nfeFields).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });

    // Verificar caracteres especiais
    console.log('\n🔤 ANÁLISE DE CARACTERES:');
    const hasSpecialChars = /[^\x00-\x7F]/.test(this.envelope);
    console.log(`  Caracteres não-ASCII: ${hasSpecialChars ? 'SIM ⚠️' : 'NÃO ✅'}`);

    return true;
  }

  /**
   * Extrai informações específicas da NFC-e
   */
  extractNFeInfo() {
    if (!this.envelope) {
      console.error('❌ Nenhum envelope carregado');
      return null;
    }

    console.log('\n📋 INFORMAÇÕES DA NFC-E');
    console.log('========================');

    const info = {};

    // Extrair chave de acesso
    const chaveMatch = this.envelope.match(/Id="NFe(\d{44})"/);
    if (chaveMatch) {
      info.chaveAcesso = chaveMatch[1];
      console.log(`🔑 Chave de Acesso: ${info.chaveAcesso}`);
    }

    // Extrair CNPJ
    const cnpjMatch = this.envelope.match(/<CNPJ>([^<]+)<\/CNPJ>/);
    if (cnpjMatch) {
      info.cnpj = cnpjMatch[1];
      console.log(`🏢 CNPJ: ${info.cnpj}`);
    }

    // Extrair valor total
    const valorMatch = this.envelope.match(/<vNF>([\d.]+)<\/vNF>/);
    if (valorMatch) {
      info.valorTotal = parseFloat(valorMatch[1]);
      console.log(`💰 Valor Total: R$ ${info.valorTotal.toFixed(2)}`);
    }

    // Extrair QR Code
    const qrMatch = this.envelope.match(/<qrCode><!\[CDATA\[([^\]]+)\]\]><\/qrCode>/);
    if (qrMatch) {
      info.qrCode = qrMatch[1];
      console.log(`📱 QR Code: ${info.qrCode.substring(0, 50)}...`);
    }

    return info;
  }

  /**
   * Salva o envelope em um arquivo para análise posterior
   */
  saveToFile(filePath) {
    if (!this.envelope) {
      console.error('❌ Nenhum envelope para salvar');
      return false;
    }

    try {
      fs.writeFileSync(filePath, this.envelope, 'utf8');
      console.log(`💾 Envelope salvo em: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao salvar arquivo: ${error.message}`);
      return false;
    }
  }

  /**
   * Executa análise completa
   */
  runFullAnalysis() {
    console.log('🚀 INICIANDO ANÁLISE COMPLETA DO ENVELOPE SOAP');
    console.log('===============================================');

    this.analyzeStructure();
    this.extractNFeInfo();

    console.log('\n📋 RESUMO DA ANÁLISE');
    console.log('=====================');
    console.log('✅ Estrutura SOAP analisada');
    console.log('✅ Informações NFC-e extraídas');
    console.log('✅ Validações realizadas');
  }
}

// Função principal para uso via linha de comando
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📖 Uso: node soap-analyzer.js <arquivo.xml> [comando]');
    console.log('');
    console.log('Comandos:');
    console.log('  analyze  - Análise completa (padrão)');
    console.log('  structure - Apenas estrutura');
    console.log('  info     - Apenas informações NFC-e');
    console.log('');
    console.log('Exemplo: node soap-analyzer.js envelope.xml analyze');
    return;
  }

  const filePath = args[0];
  const command = args[1] || 'analyze';

  const analyzer = new SoapEnvelopeAnalyzer();

  if (!analyzer.loadFromFile(filePath)) {
    return;
  }

  switch (command) {
    case 'structure':
      analyzer.analyzeStructure();
      break;
    case 'info':
      analyzer.extractNFeInfo();
      break;
    case 'analyze':
    default:
      analyzer.runFullAnalysis();
      break;
  }
}

// Exportar para uso como módulo
module.exports = SoapEnvelopeAnalyzer;

// Executar se chamado diretamente
if (require.main === module) {
  main();
}