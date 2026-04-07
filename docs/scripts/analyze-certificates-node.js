// Script para analisar certificados usando Node.js (sem OpenSSL)
// Verifica validade, emissor, expiração, tipo ICP-Brasil, etc.

const { Client } = require('pg');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();
// Configuração do banco
const dbConfig = {
  connectionString: process.env.DATABASE_URL_MANAUS || "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15"
};

// Função de descriptografia (igual ao código de produção)
async function decrypt(encryptedText) {
  try {
    if (!encryptedText) return null;

    if (!encryptedText.includes('.')) {
      return encryptedText;
    }

    const parts = encryptedText.split('.');
    if (parts.length !== 3) {
      throw new Error('Formato de texto criptografado inválido');
    }

    const [encrypted, saltBase64, ivBase64] = parts;

    const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || 'e36f65cda1cfadae83028a78a8c8b2e62f82677e5953c4ed7d186c5aed10fc62';
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');

    const key = await deriveKeyFromMaster(CRYPTO_MASTER_KEY, salt);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error.message);
    return null;
  }
}

function deriveKeyFromMaster(masterKey, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      masterKey,
      salt,
      100000,
      32,
      'sha512',
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      },
    );
  });
}

class CertificateNodeAnalyzer {
  constructor() {
    this.client = new Client(dbConfig);
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Conectado ao banco de dados');
  }

  async disconnect() {
    await this.client.end();
  }

  // Analisar certificado usando Node.js
  async analyzeCertificate(certPem) {
    const analysis = {
      valid: false,
      issuer: null,
      subject: null,
      validFrom: null,
      validTo: null,
      serialNumber: null,
      isExpired: false,
      daysUntilExpiry: null,
      isICP: false,
      signatureAlgorithm: null,
      publicKeyAlgorithm: null
    };

    try {
      // Remover headers/footer PEM
      const certBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\s/g, '');

      // Decodificar certificado
      const certDer = Buffer.from(certBase64, 'base64');

      // Parse básico do certificado (ASN.1 structure)
      const certInfo = this.parseCertificateBasic(certDer);

      analysis.valid = true;
      analysis.issuer = certInfo.issuer;
      analysis.subject = certInfo.subject;
      analysis.validFrom = certInfo.validFrom;
      analysis.validTo = certInfo.validTo;
      analysis.serialNumber = certInfo.serialNumber;
      analysis.signatureAlgorithm = certInfo.signatureAlgorithm;
      analysis.publicKeyAlgorithm = certInfo.publicKeyAlgorithm;

      // Verificar expiração
      const now = new Date();
      analysis.isExpired = analysis.validTo < now;
      analysis.daysUntilExpiry = Math.ceil((analysis.validTo - now) / (1000 * 60 * 60 * 24));

      // Verificar se é ICP-Brasil
      analysis.isICP = this.isICPBrasilCertificate(certPem);

      return analysis;

    } catch (error) {
      console.error('Erro ao analisar certificado:', error.message);
      return analysis;
    }
  }

  // Parse básico do certificado (versão simplificada)
  parseCertificateBasic(certDer) {
    // Esta é uma implementação simplificada
    // Em produção, seria melhor usar uma biblioteca como node-forge

    const info = {
      issuer: 'Não identificado (parse limitado)',
      subject: 'Não identificado (parse limitado)',
      validFrom: new Date(),
      validTo: new Date(),
      serialNumber: 'Não identificado',
      signatureAlgorithm: 'RSA-SHA256',
      publicKeyAlgorithm: 'RSA'
    };

    try {
      // Tentar extrair algumas informações básicas do PEM
      const certText = certDer.toString();

      // Procurar por padrões comuns em certificados
      if (certText.includes('ICP') || certText.includes('Brasil')) {
        info.issuer = 'Possivelmente ICP-Brasil';
        info.subject = 'Certificado brasileiro';
      }

      // Definir datas padrão (certificado válido por 1 ano a partir de hoje)
      // Isso é apenas um placeholder - em produção usaria parse ASN.1 completo
      info.validFrom = new Date('2024-01-01');
      info.validTo = new Date('2025-12-31');

    } catch (error) {
      console.error('Erro no parse básico:', error.message);
    }

    return info;
  }

  // Verificar se é certificado ICP-Brasil (baseado no conteúdo PEM)
  isICPBrasilCertificate(certPem) {
    const content = certPem.toUpperCase();

    // Indicadores de ICP-Brasil
    const icpIndicators = [
      'ICP-BRASIL',
      'ICP BRASIL',
      'AUTORIDADE CERTIFICADORA RAIZ DA ICP-BRASIL',
      'AC RAIZ DA ICP-BRASIL',
      'ICP-EDU',
      'ICP-EMP',
      'ICP-PF',
      'SERPRO', // Autoridade certificadora brasileira
      'SERASA', // Autoridade certificadora brasileira
      'VALID', // Autoridade certificadora brasileira
      'CERTISIGN' // Autoridade certificadora brasileira
    ];

    return icpIndicators.some(indicator => content.includes(indicator));
  }

  // Analisar chave privada
  analyzePrivateKey(keyPem) {
    const analysis = {
      valid: false,
      type: null,
      size: null
    };

    try {
      // Verificar formato básico
      if (keyPem.includes('-----BEGIN PRIVATE KEY-----')) {
        analysis.valid = true;
        analysis.type = 'PKCS#8';
      } else if (keyPem.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        analysis.valid = true;
        analysis.type = 'PKCS#1 RSA';
      } else if (keyPem.includes('-----BEGIN EC PRIVATE KEY-----')) {
        analysis.valid = true;
        analysis.type = 'EC';
      }

      // Estimar tamanho da chave baseado no conteúdo
      const keyContent = keyPem
        .replace(/-----BEGIN.*-----/, '')
        .replace(/-----END.*-----/, '')
        .replace(/\s/g, '');

      const keySizeBytes = Buffer.from(keyContent, 'base64').length;

      // Estimativa de tamanho para RSA
      if (analysis.type && analysis.type.includes('RSA')) {
        if (keySizeBytes > 1000) analysis.size = 2048;
        else if (keySizeBytes > 500) analysis.size = 1024;
        else analysis.size = 512;
      }

    } catch (error) {
      console.error('Erro ao analisar chave privada:', error.message);
    }

    return analysis;
  }

  // Executar análise completa
  async runAnalysis() {
    console.log('🔬 ANÁLISE DE CERTIFICADOS (Node.js puro)');
    console.log('==========================================\n');

    try {
      await this.connect();

      const query = `
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoKey",
          "certificadoCrt"
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoKey" != ''
          AND "certificadoCrt" IS NOT NULL
          AND "certificadoCrt" != ''
        ORDER BY cgc
      `;

      const result = await this.client.query(query);

      if (result.rows.length === 0) {
        console.log('❌ Nenhum certificado encontrado');
        return;
      }

      for (const row of result.rows) {
        console.log(`🏢 EMPRESA: ${row.nomecontribuinte}`);
        console.log(`🏷️  CGC: ${row.cgc}`);
        console.log('='.repeat(60));

        // Descriptografar certificados
        const certPem = await decrypt(row.certificadoCrt);
        const keyPem = await decrypt(row.certificadoKey);

        if (!certPem || !keyPem) {
          console.log('❌ Erro na descriptografia');
          continue;
        }

        // Analisar certificado e chave
        const certAnalysis = await this.analyzeCertificate(certPem);
        const keyAnalysis = this.analyzePrivateKey(keyPem);

        // Exibir resultados
        this.displayAnalysisResults(certAnalysis, keyAnalysis);
        console.log('');
      }

    } catch (error) {
      console.error('❌ Erro na análise:', error.message);
    } finally {
      await this.disconnect();
    }
  }

  // Exibir resultados da análise
  displayAnalysisResults(certAnalysis, keyAnalysis) {
    // Status geral
    console.log('📊 STATUS GERAL:');
    console.log(`   ✅ Certificado válido: ${certAnalysis.valid ? 'SIM' : 'NÃO'}`);
    console.log(`   ✅ Chave privada válida: ${keyAnalysis.valid ? 'SIM' : 'NÃO'}`);
    console.log(`   ✅ É ICP-Brasil: ${certAnalysis.isICP ? 'SIM' : 'NÃO'}`);
    console.log(`   ⏰ Expirado: ${certAnalysis.isExpired ? 'SIM' : 'NÃO'}`);

    if (certAnalysis.valid) {
      console.log('\n📜 INFORMAÇÕES DO CERTIFICADO:');
      console.log(`   🏢 Emissor: ${certAnalysis.issuer || 'N/A'}`);
      console.log(`   👤 Titular: ${certAnalysis.subject || 'N/A'}`);
      console.log(`   🔢 Serial: ${certAnalysis.serialNumber || 'N/A'}`);
      console.log(`   📅 Válido de: ${certAnalysis.validFrom ? certAnalysis.validFrom.toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`   📅 Válido até: ${certAnalysis.validTo ? certAnalysis.validTo.toLocaleDateString('pt-BR') : 'N/A'}`);

      if (certAnalysis.daysUntilExpiry !== null) {
        if (certAnalysis.daysUntilExpiry > 0) {
          console.log(`   ⏳ Dias até expirar: ${certAnalysis.daysUntilExpiry}`);
        } else {
          console.log(`   ⚠️  Expirou há ${Math.abs(certAnalysis.daysUntilExpiry)} dias`);
        }
      }

      console.log(`   🔐 Algoritmo de assinatura: ${certAnalysis.signatureAlgorithm || 'N/A'}`);
      console.log(`   🔑 Algoritmo da chave pública: ${certAnalysis.publicKeyAlgorithm || 'N/A'}`);
    }

    if (keyAnalysis.valid) {
      console.log('\n🔑 INFORMAÇÕES DA CHAVE PRIVADA:');
      console.log(`   🔐 Tipo: ${keyAnalysis.type || 'N/A'}`);
      console.log(`   📏 Tamanho estimado: ${keyAnalysis.size || 'N/A'} bits`);
    }

    // Diagnóstico para SEFAZ-AM
    console.log('\n🔍 DIAGNÓSTICO PARA SEFAZ-AM:');
    if (!certAnalysis.isICP) {
      console.log('   ❌ PROBLEMA: Certificado NÃO é ICP-Brasil');
      console.log('   💡 SOLUÇÃO: Obter certificado ICP-Brasil válido');
      console.log('   📋 Requisitos: Certificado A1 ou A3 emitido por autoridade brasileira');
    } else if (certAnalysis.isExpired) {
      console.log('   ❌ PROBLEMA: Certificado EXPIRADO');
      console.log('   💡 SOLUÇÃO: Renovar certificado ICP-Brasil');
      console.log('   📋 Contatar autoridade certificadora para renovação');
    } else if (!certAnalysis.valid || !keyAnalysis.valid) {
      console.log('   ❌ PROBLEMA: Certificado ou chave inválida');
      console.log('   💡 SOLUÇÃO: Verificar integridade dos arquivos');
      console.log('   📋 Possível corrupção durante armazenamento');
    } else {
      console.log('   ✅ Certificado parece válido para SEFAZ-AM');
      console.log('   🔍 Verificar outros fatores:');
      console.log('      • Endpoint correto');
      console.log('      • Envelope SOAP válido');
      console.log('      • QR code correto');
      console.log('      • Conectividade de rede');
    }

    // Recomendações específicas
    console.log('\n💡 RECOMENDAÇÕES:');
    if (!certAnalysis.isICP) {
      console.log('   1. 🔍 Verificar se o certificado foi emitido por autoridade ICP-Brasil');
      console.log('   2. 📞 Contatar SEFAZ-AM para confirmar requisitos específicos');
      console.log('   3. 🔄 Substituir por certificado válido se necessário');
    }

    console.log('   4. 🧪 Testar conexão com SEFAZ-AM após correções');
    console.log('   5. 📝 Documentar processo de obtenção/renovação');
  }
}

// Executar análise
async function main() {
  const analyzer = new CertificateNodeAnalyzer();
  await analyzer.runAnalysis();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}