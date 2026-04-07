// Script para verificar certificados no banco de dados
// Verifica se existem certificados válidos na tabela dadosempresa

const { Client } = require('pg');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();
// Configuração do banco (igual ao .env)
const dbConfig = {
  connectionString: process.env.DATABASE_URL_MANAUS || "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15"
};

// Função de descriptografia (igual ao código de produção)
async function decrypt(encryptedText) {
  try {
    if (!encryptedText) return null;

    // Verificar se já está descriptografado (não tem o formato cifrado.salt.iv)
    if (!encryptedText.includes('.')) {
      return encryptedText; // Já está descriptografado
    }

    const parts = encryptedText.split('.');
    if (parts.length !== 3) {
      throw new Error('Formato de texto criptografado inválido: esperado "cifrado.salt.iv".');
    }

    const [encrypted, saltBase64, ivBase64] = parts;

    // Usar a chave mestra do ambiente
    const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || 'e36f65cda1cfadae83028a78a8c8b2e62f82677e5953c4ed7d186c5aed10fc62';
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');

    // Derivar chave usando PBKDF2
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

// Função auxiliar para derivar chave (igual ao código de produção)
function deriveKeyFromMaster(masterKey, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      masterKey,
      salt,
      100000, // PBKDF2_ITERATIONS
      32, // KEY_LENGTH
      'sha512', // PBKDF2_DIGEST
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      },
    );
  });
}

class DatabaseCertificateChecker {
  constructor() {
    this.client = new Client(dbConfig);
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Conectado ao banco de dados');
    } catch (error) {
      console.error('❌ Erro ao conectar:', error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.end();
      console.log('✅ Desconectado do banco');
    } catch (error) {
      console.error('Erro ao desconectar:', error.message);
    }
  }

  // Verificar certificados na tabela dadosempresa
  async checkCertificates() {
    console.log('🔍 VERIFICANDO CERTIFICADOS NO BANCO DE DADOS');
    console.log('===============================================');

    try {
      const query = `
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoKey",
          "certificadoCrt",
          csc_nfce_id,
          csc_nfce_homologacao,
          csc_nfce_producao
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoKey" != ''
          AND "certificadoCrt" IS NOT NULL
          AND "certificadoCrt" != ''
        ORDER BY cgc
      `;

      const result = await this.client.query(query);

      console.log(`📊 Encontrados ${result.rows.length} registros com certificados`);

      if (result.rows.length === 0) {
        console.log('❌ NENHUM CERTIFICADO ENCONTRADO NO BANCO');
        console.log('💡 Verifique se os certificados foram cadastrados na tabela dadosempresa');
        return [];
      }

      const certificates = [];
      for (const row of result.rows) {
        console.log(`\n🏢 EMPRESA: ${row.nomecontribuinte} (CGC: ${row.cgc})`);
        console.log('='.repeat(60));

        const certInfo = await this.analyzeCertificateRow(row);
        certificates.push(certInfo);
      }

      return certificates;

    } catch (error) {
      console.error('❌ Erro na consulta:', error.message);
      throw error;
    }
  }

  // Analisar uma linha de certificado
  async analyzeCertificateRow(row) {
    const certInfo = {
      cgc: row.cgc,
      empresa: row.nomecontribuinte,
      certificadoKey: {
        encrypted: !!row.certificadoKey,
        length: row.certificadoKey?.length || 0,
        decrypted: null,
        valid: false
      },
      certificadoCrt: {
        encrypted: !!row.certificadoCrt,
        length: row.certificadoCrt?.length || 0,
        decrypted: null,
        valid: false
      },
      csc: {
        id: row.csc_nfce_id,
        homologacao: !!row.csc_nfce_homologacao,
        producao: !!row.csc_nfce_producao
      }
    };

    // Tentar descriptografar chave privada
    if (row.certificadoKey) {
      console.log(`🔑 Certificado Key: ${row.certificadoKey.length} caracteres (criptografado)`);
      const decryptedKey = await decrypt(row.certificadoKey);
      if (decryptedKey) {
        certInfo.certificadoKey.decrypted = decryptedKey;
        certInfo.certificadoKey.valid = this.isValidPrivateKey(decryptedKey);
        console.log(`   ✅ Descriptografado com sucesso (${decryptedKey.length} chars)`);
        console.log(`   🔍 Chave privada ${certInfo.certificadoKey.valid ? 'válida' : 'inválida'}`);
      } else {
        console.log(`   ❌ Falha na descriptografia`);
      }
    }

    // Tentar descriptografar certificado
    if (row.certificadoCrt) {
      console.log(`📜 Certificado CRT: ${row.certificadoCrt.length} caracteres (criptografado)`);
      const decryptedCrt = await decrypt(row.certificadoCrt);
      if (decryptedCrt) {
        certInfo.certificadoCrt.decrypted = decryptedCrt;
        certInfo.certificadoCrt.valid = this.isValidCertificate(decryptedCrt);
        console.log(`   ✅ Descriptografado com sucesso (${decryptedCrt.length} chars)`);
        console.log(`   🔍 Certificado ${certInfo.certificadoCrt.valid ? 'válido' : 'inválido'}`);

        if (certInfo.certificadoCrt.valid) {
          this.analyzeCertificateDetails(decryptedCrt);
        }
      } else {
        console.log(`   ❌ Falha na descriptografia`);
      }
    }

    // Verificar CSC
    console.log(`🔢 CSC ID: ${row.csc_nfce_id || 'Não informado'}`);
    if (row.csc_nfce_homologacao) {
      console.log(`🔒 CSC Homologação: Cadastrado (criptografado)`);
      const cscDecrypted = await decrypt(row.csc_nfce_homologacao);
      if (cscDecrypted) {
        console.log(`   ✅ CSC descriptografado: ${cscDecrypted.substring(0, 10)}...`);
      }
    } else {
      console.log(`🔒 CSC Homologação: Não cadastrado`);
    }

    return certInfo;
  }

  // Verificar se é uma chave privada válida
  isValidPrivateKey(keyText) {
    try {
      // Verificar se começa com -----BEGIN PRIVATE KEY----- ou -----BEGIN RSA PRIVATE KEY-----
      return keyText.includes('-----BEGIN') && keyText.includes('PRIVATE KEY-----');
    } catch (error) {
      return false;
    }
  }

  // Verificar se é um certificado válido
  isValidCertificate(certText) {
    try {
      // Verificar se começa com -----BEGIN CERTIFICATE-----
      return certText.includes('-----BEGIN CERTIFICATE-----');
    } catch (error) {
      return false;
    }
  }

  // Analisar detalhes do certificado
  analyzeCertificateDetails(certText) {
    try {
      // Extrair informações básicas do certificado
      const lines = certText.split('\n');
      console.log(`   📄 Certificado tem ${lines.length} linhas`);

      // Procurar por informações de emissor e validade
      const certBody = lines.slice(1, -2).join(''); // Remover header e footer

      // Tentar decodificar base64 para ver informações
      try {
        const certBuffer = Buffer.from(certBody, 'base64');
        console.log(`   📏 Tamanho decodificado: ${certBuffer.length} bytes`);

        // Verificar se parece um certificado válido
        if (certBuffer.length > 1000) {
          console.log(`   ✅ Certificado parece válido (tamanho adequado)`);
        } else {
          console.log(`   ⚠️ Certificado pode estar incompleto`);
        }
      } catch (decodeError) {
        console.log(`   ⚠️ Erro ao decodificar certificado: ${decodeError.message}`);
      }

    } catch (error) {
      console.log(`   ❌ Erro ao analisar certificado: ${error.message}`);
    }
  }

  // Executar verificação completa
  async runFullCheck() {
    try {
      await this.connect();
      const certificates = await this.checkCertificates();

      console.log(`\n🎯 RESUMO DA VERIFICAÇÃO`);
      console.log('========================');

      const validCerts = certificates.filter(cert =>
        cert.certificadoKey.valid && cert.certificadoCrt.valid
      );

      console.log(`📊 Total de empresas com certificados: ${certificates.length}`);
      console.log(`✅ Certificados válidos: ${validCerts.length}`);
      console.log(`❌ Certificados inválidos: ${certificates.length - validCerts.length}`);

      if (validCerts.length > 0) {
        console.log(`\n🏆 EMPRESAS COM CERTIFICADOS VÁLIDOS:`);
        validCerts.forEach(cert => {
          console.log(`   • ${cert.empresa} (CGC: ${cert.cgc})`);
        });

        console.log(`\n💡 PRÓXIMOS PASSOS:`);
        console.log(`   1. ✅ Certificados estão no banco e válidos`);
        console.log(`   2. 🧪 Testar emissão NFC-e em produção`);
        console.log(`   3. 🔍 Verificar se erro 404 persiste`);
      } else {
        console.log(`\n❌ NENHUM CERTIFICADO VÁLIDO ENCONTRADO`);
        console.log(`💡 Ações necessárias:`);
        console.log(`   1. 📥 Obter certificados ICP-Brasil válidos`);
        console.log(`   2. 🔐 Cadastrar na tabela dadosempresa`);
        console.log(`   3. 🧪 Testar emissão NFC-e`);
      }

      return certificates;

    } catch (error) {
      console.error('❌ Erro na verificação:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Executar verificação
async function main() {
  const checker = new DatabaseCertificateChecker();
  await checker.runFullCheck();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}