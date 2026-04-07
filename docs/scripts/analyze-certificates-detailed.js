// Script para analisar detalhadamente os certificados digitais
// Verifica validade, emissor, expiração, tipo ICP-Brasil, etc.

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');

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

class CertificateDetailedAnalyzer {
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

  // Analisar certificado em detalhes
  async analyzeCertificateDetails(certPem, keyPem) {
    const analysis = {
      certificate: {
        valid: false,
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        serialNumber: null,
        isExpired: false,
        daysUntilExpiry: null,
        isICP: false,
        extensions: []
      },
      privateKey: {
        valid: false,
        type: null,
        size: null
      }
    };

    try {
      // Salvar temporariamente para análise
      const certFile = 'temp_cert.pem';
      const keyFile = 'temp_key.pem';

      fs.writeFileSync(certFile, certPem);
      fs.writeFileSync(keyFile, keyPem);

      // Usar openssl para analisar certificado
      const certInfo = await this.runOpensslCommand(`openssl x509 -in ${certFile} -text -noout`);
      const keyInfo = await this.runOpensslCommand(`openssl rsa -in ${keyFile} -text -noout`);

      // Limpar arquivos temporários
      fs.unlinkSync(certFile);
      fs.unlinkSync(keyFile);

      // Analisar informações do certificado
      analysis.certificate = this.parseCertificateInfo(certInfo);
      analysis.privateKey = this.parsePrivateKeyInfo(keyInfo);

      return analysis;

    } catch (error) {
      console.error('❌ Erro ao analisar certificado:', error.message);
      return analysis;
    }
  }

  // Executar comando openssl
  async runOpensslCommand(command) {
    const { execSync } = require('child_process');
    try {
      return execSync(command, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Erro no comando openssl: ${error.message}`);
    }
  }

  // Parse das informações do certificado
  parseCertificateInfo(certText) {
    const info = {
      valid: true,
      issuer: null,
      subject: null,
      validFrom: null,
      validTo: null,
      serialNumber: null,
      isExpired: false,
      daysUntilExpiry: null,
      isICP: false,
      extensions: []
    };

    try {
      // Extrair issuer
      const issuerMatch = certText.match(/Issuer:\s*(.+)/);
      if (issuerMatch) {
        info.issuer = issuerMatch[1].trim();
      }

      // Extrair subject
      const subjectMatch = certText.match(/Subject:\s*(.+)/);
      if (subjectMatch) {
        info.subject = subjectMatch[1].trim();
      }

      // Extrair validity
      const notBeforeMatch = certText.match(/Not Before:\s*(.+)/);
      const notAfterMatch = certText.match(/Not After\s*:\s*(.+)/);

      if (notBeforeMatch) {
        info.validFrom = new Date(notBeforeMatch[1].trim());
      }

      if (notAfterMatch) {
        info.validTo = new Date(notAfterMatch[1].trim());
        const now = new Date();
        info.isExpired = info.validTo < now;
        info.daysUntilExpiry = Math.ceil((info.validTo - now) / (1000 * 60 * 60 * 24));
      }

      // Extrair serial number
      const serialMatch = certText.match(/Serial Number:\s*(.+)/);
      if (serialMatch) {
        info.serialNumber = serialMatch[1].trim();
      }

      // Verificar se é ICP-Brasil
      info.isICP = this.isICPBrasilCertificate(certText);

      // Extrair extensions
      const extensionsSection = certText.match(/X509v3 extensions:([\s\S]*?)(?=Signature Algorithm|$)/);
      if (extensionsSection) {
        info.extensions = this.parseExtensions(extensionsSection[1]);
      }

    } catch (error) {
      console.error('Erro ao fazer parse do certificado:', error.message);
      info.valid = false;
    }

    return info;
  }

  // Verificar se é certificado ICP-Brasil
  isICPBrasilCertificate(certText) {
    // Verificar se contém referências ao ICP-Brasil
    const icpIndicators = [
      'ICP-Brasil',
      'ICP Brasil',
      'Autoridade Certificadora Raiz da ICP-Brasil',
      'AC Raiz da ICP-Brasil',
      'ICP-EDU',
      'ICP-EMP',
      'ICP-PF'
    ];

    const upperCert = certText.toUpperCase();
    return icpIndicators.some(indicator => upperCert.includes(indicator.toUpperCase()));
  }

  // Parse das extensions
  parseExtensions(extensionsText) {
    const extensions = [];
    const lines = extensionsText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('X509v3') || trimmed.includes(':')) {
        extensions.push(trimmed);
      }
    }

    return extensions;
  }

  // Parse das informações da chave privada
  parsePrivateKeyInfo(keyText) {
    const info = {
      valid: true,
      type: null,
      size: null
    };

    try {
      // Verificar tipo da chave
      if (keyText.includes('RSA Private-Key:')) {
        info.type = 'RSA';
      } else if (keyText.includes('Private-Key:')) {
        info.type = 'EC';
      }

      // Extrair tamanho da chave
      const sizeMatch = keyText.match(/Private-Key: \((\d+) bit\)/);
      if (sizeMatch) {
        info.size = parseInt(sizeMatch[1]);
      }

    } catch (error) {
      console.error('Erro ao fazer parse da chave privada:', error.message);
      info.valid = false;
    }

    return info;
  }

  // Executar análise completa
  async runDetailedAnalysis() {
    console.log('🔬 ANÁLISE DETALHADA DE CERTIFICADOS ICP-BRASIL');
    console.log('=================================================\n');

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

        // Analisar em detalhes
        const analysis = await this.analyzeCertificateDetails(certPem, keyPem);

        // Exibir resultados
        this.displayAnalysisResults(analysis);
        console.log('');
      }

    } catch (error) {
      console.error('❌ Erro na análise:', error.message);
    } finally {
      await this.disconnect();
    }
  }

  // Exibir resultados da análise
  displayAnalysisResults(analysis) {
    const cert = analysis.certificate;
    const key = analysis.privateKey;

    // Status geral
    console.log('📊 STATUS GERAL:');
    console.log(`   ✅ Certificado válido: ${cert.valid ? 'SIM' : 'NÃO'}`);
    console.log(`   ✅ Chave privada válida: ${key.valid ? 'SIM' : 'NÃO'}`);
    console.log(`   ✅ É ICP-Brasil: ${cert.isICP ? 'SIM' : 'NÃO'}`);
    console.log(`   ⏰ Expirado: ${cert.isExpired ? 'SIM' : 'NÃO'}`);

    if (cert.valid) {
      console.log('\n📜 INFORMAÇÕES DO CERTIFICADO:');
      console.log(`   🏢 Emissor: ${cert.issuer || 'N/A'}`);
      console.log(`   👤 Titular: ${cert.subject || 'N/A'}`);
      console.log(`   🔢 Serial: ${cert.serialNumber || 'N/A'}`);
      console.log(`   📅 Válido de: ${cert.validFrom ? cert.validFrom.toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`   📅 Válido até: ${cert.validTo ? cert.validTo.toLocaleDateString('pt-BR') : 'N/A'}`);

      if (cert.daysUntilExpiry !== null) {
        if (cert.daysUntilExpiry > 0) {
          console.log(`   ⏳ Dias até expirar: ${cert.daysUntilExpiry}`);
        } else {
          console.log(`   ⚠️  Expirou há ${Math.abs(cert.daysUntilExpiry)} dias`);
        }
      }
    }

    if (key.valid) {
      console.log('\n🔑 INFORMAÇÕES DA CHAVE PRIVADA:');
      console.log(`   🔐 Tipo: ${key.type || 'N/A'}`);
      console.log(`   📏 Tamanho: ${key.size || 'N/A'} bits`);
    }

    // Diagnóstico para SEFAZ-AM
    console.log('\n🔍 DIAGNÓSTICO PARA SEFAZ-AM:');
    if (!cert.isICP) {
      console.log('   ❌ PROBLEMA: Certificado NÃO é ICP-Brasil');
      console.log('   💡 SOLUÇÃO: Obter certificado ICP-Brasil válido');
    } else if (cert.isExpired) {
      console.log('   ❌ PROBLEMA: Certificado EXPIRADO');
      console.log('   💡 SOLUÇÃO: Renovar certificado ICP-Brasil');
    } else if (!cert.valid || !key.valid) {
      console.log('   ❌ PROBLEMA: Certificado ou chave inválida');
      console.log('   💡 SOLUÇÃO: Verificar integridade dos arquivos');
    } else {
      console.log('   ✅ Certificado parece válido para SEFAZ-AM');
      console.log('   🔍 Verificar outros fatores (endpoint, envelope, etc.)');
    }
  }
}

// Executar análise
async function main() {
  const analyzer = new CertificateDetailedAnalyzer();
  await analyzer.runDetailedAnalysis();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}