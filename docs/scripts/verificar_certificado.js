const { Pool } = require('pg');
const crypto = require('crypto');
const forge = require('node-forge');
const dotenv = require('dotenv');   
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Carregar CRYPTO_MASTER_KEY do .env
const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || '';

if (!CRYPTO_MASTER_KEY || CRYPTO_MASTER_KEY.length < 32) {
  console.error('❌ ERRO: CRYPTO_MASTER_KEY não definida no .env');
  console.error('Não é possível descriptografar sem a chave mestra');
  process.exit(1);
}

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';

/**
 * Deriva uma chave de criptografia (igual ao sistema)
 */
function deriveKeyFromMaster(salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      CRYPTO_MASTER_KEY,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Função de decrypt (igual ao sistema em crypto.ts)
 */
async function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  const parts = encryptedText.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de texto criptografado inválido: esperado "cifrado.salt.iv".');
  }

  const [encrypted, saltBase64, ivBase64] = parts;

  try {
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = await deriveKeyFromMaster(salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error.message);
    return null;
  }
}

async function verificarCertificado() {
  console.log('🔍 ========== VERIFICAÇÃO DE CERTIFICADO ==========\n');
  
  try {
    // Buscar certificado do banco
    const result = await pool.query(`
      SELECT 
        cgc,
        "certificadoCrt",
        "certificadoKey",
        "cadeiaCrt"
      FROM db_manaus.dadosempresa 
      WHERE "certificadoCrt" IS NOT NULL 
        AND "certificadoCrt" != ''
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum certificado encontrado no banco\n');
      return;
    }

    const empresa = result.rows[0];
    console.log('📋 CNPJ da Empresa:', empresa.cgc);
    console.log('');

    // Descriptografar certificado
    console.log('🔓 Descriptografando certificado...');
    const certDecrypted = await decrypt(empresa.certificadoCrt);
    
    if (!certDecrypted) {
      console.log('❌ Erro ao descriptografar certificado\n');
      return;
    }

    console.log('✅ Certificado descriptografado com sucesso\n');

    // Analisar tipo de certificado
    console.log('🔍 ========== ANÁLISE DO CERTIFICADO ==========\n');

    // Converter para string
    const certText = String(certDecrypted);

    // Analisar certificado com node-forge
    let cert = null;
    let isVideoconf = false;
    
    try {
      cert = forge.pki.certificateFromPem(certText);
      
      console.log('📄 INFORMAÇÕES COMPLETAS DO CERTIFICADO X.509:\n');
      console.log('═'.repeat(70));
      
      // Extrair Subject (informações do titular)
      const subject = cert.subject.attributes;
      console.log('\n👤 TITULAR (SUBJECT):');
      console.log('─'.repeat(70));
      subject.forEach(attr => {
        const nome = attr.shortName || attr.name;
        console.log(`   ${nome.padEnd(15)} : ${attr.value}`);
        // Verificar se OU contém videoconferencia
        if ((attr.shortName === 'OU' || attr.name === 'organizationalUnitName') && 
            attr.value.toLowerCase().includes('videoconferencia')) {
          isVideoconf = true;
        }
      });
      
      // Extrair Issuer (emissor)
      const issuer = cert.issuer.attributes;
      console.log('\n🏢 EMISSOR (ISSUER):');
      console.log('─'.repeat(70));
      issuer.forEach(attr => {
        const nome = attr.shortName || attr.name;
        console.log(`   ${nome.padEnd(15)} : ${attr.value}`);
      });
      
      // Validade
      console.log('\n📅 VALIDADE:');
      console.log('─'.repeat(70));
      console.log(`   Início          : ${cert.validity.notBefore}`);
      console.log(`   Término         : ${cert.validity.notAfter}`);
      const agora = new Date();
      const valido = agora >= cert.validity.notBefore && agora <= cert.validity.notAfter;
      console.log(`   Status          : ${valido ? '✅ VÁLIDO' : '❌ EXPIRADO/INVÁLIDO'}`);
      
      // Informações técnicas
      console.log('\n🔧 INFORMAÇÕES TÉCNICAS:');
      console.log('─'.repeat(70));
      console.log(`   Versão          : ${cert.version}`);
      console.log(`   Serial Number   : ${cert.serialNumber}`);
      console.log(`   Signature Alg   : ${cert.signatureOid}`);
      console.log(`   Public Key Alg  : ${cert.publicKey.n ? 'RSA' : 'Outro'}`);
      if (cert.publicKey.n) {
        console.log(`   Key Size        : ${cert.publicKey.n.bitLength()} bits`);
      }
      
      // Extensões (incluindo Key Usage, Extended Key Usage)
      console.log('\n🔑 EXTENSÕES DO CERTIFICADO:');
      console.log('─'.repeat(70));
      
      if (cert.extensions && cert.extensions.length > 0) {
        cert.extensions.forEach((ext, index) => {
          console.log(`\n   [${index + 1}] ${ext.name || ext.id}`);
          console.log(`       OID: ${ext.id}`);
          console.log(`       Critical: ${ext.critical ? 'Sim' : 'Não'}`);
          
          // Key Usage
          if (ext.name === 'keyUsage') {
            console.log('       Uso:');
            if (ext.digitalSignature) console.log('         ✓ Assinatura Digital');
            if (ext.nonRepudiation) console.log('         ✓ Não Repúdio');
            if (ext.keyEncipherment) console.log('         ✓ Ciframento de Chave');
            if (ext.dataEncipherment) console.log('         ✓ Ciframento de Dados');
            if (ext.keyAgreement) console.log('         ✓ Acordo de Chave');
            if (ext.keyCertSign) console.log('         ✓ Assinatura de Certificado');
            if (ext.cRLSign) console.log('         ✓ Assinatura de CRL');
          }
          
          // Extended Key Usage
          if (ext.name === 'extKeyUsage') {
            console.log('       Uso Estendido:');
            if (ext.serverAuth) console.log('         ✓ Autenticação de Servidor (serverAuth)');
            if (ext.clientAuth) console.log('         ✓ Autenticação de Cliente (clientAuth)');
            if (ext.codeSigning) console.log('         ✓ Assinatura de Código (codeSigning)');
            if (ext.emailProtection) console.log('         ✓ Proteção de Email (emailProtection)');
            if (ext.timeStamping) console.log('         ✓ Timestamp (timeStamping)');
          }
          
          // Subject Alternative Name
          if (ext.name === 'subjectAltName') {
            console.log('       Nome Alternativo:');
            if (ext.altNames) {
              ext.altNames.forEach(alt => {
                if (alt.type === 2) console.log(`         DNS: ${alt.value}`);
                if (alt.type === 1) console.log(`         Email: ${alt.value}`);
                if (alt.type === 7) console.log(`         IP: ${alt.value}`);
              });
            }
          }
          
          // Authority Key Identifier
          if (ext.name === 'authorityKeyIdentifier') {
            console.log(`       Authority Key ID: ${ext.keyIdentifier ? forge.util.bytesToHex(ext.keyIdentifier).substring(0, 40) + '...' : 'N/A'}`);
          }
          
          // Subject Key Identifier
          if (ext.name === 'subjectKeyIdentifier') {
            console.log(`       Subject Key ID: ${ext.subjectKeyIdentifier ? forge.util.bytesToHex(ext.subjectKeyIdentifier).substring(0, 40) + '...' : 'N/A'}`);
          }
          
          // Certificate Policies
          if (ext.name === 'certificatePolicies') {
            console.log('       Políticas:');
            if (ext.value) {
              try {
                const hex = forge.util.bytesToHex(ext.value);
                console.log(`         Hex: ${hex.substring(0, 60)}...`);
              } catch (e) {
                console.log('         (dados binários)');
              }
            }
          }
          
          // Qualquer outra extensão
          if (!['keyUsage', 'extKeyUsage', 'subjectAltName', 'authorityKeyIdentifier', 
                'subjectKeyIdentifier', 'certificatePolicies'].includes(ext.name)) {
            if (ext.value) {
              try {
                const hex = forge.util.bytesToHex(ext.value);
                console.log(`       Valor (hex): ${hex.substring(0, 60)}${hex.length > 60 ? '...' : ''}`);
              } catch (e) {
                console.log('       Valor: (dados binários)');
              }
            }
          }
        });
      } else {
        console.log('   Nenhuma extensão encontrada');
      }
      
      // Fingerprints
      console.log('\n🔐 FINGERPRINTS:');
      console.log('─'.repeat(70));
      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      const md5 = forge.md.md5.create();
      md5.update(der);
      console.log(`   MD5    : ${forge.util.bytesToHex(md5.digest().getBytes()).toUpperCase()}`);
      
      const sha1 = forge.md.sha1.create();
      sha1.update(der);
      console.log(`   SHA-1  : ${forge.util.bytesToHex(sha1.digest().getBytes()).toUpperCase()}`);
      
      const sha256 = forge.md.sha256.create();
      sha256.update(der);
      console.log(`   SHA-256: ${forge.util.bytesToHex(sha256.digest().getBytes()).toUpperCase()}`);
      
      console.log('\n═'.repeat(70));
      
    } catch (error) {
      console.log('⚠️ Erro ao analisar certificado com node-forge:', error.message);
      console.log('📄 Primeiros 800 caracteres do certificado:');
      console.log('─'.repeat(60));
      console.log(certText.substring(0, 800));
      console.log('─'.repeat(60));
      console.log('');
    }
    console.log('📌 Tipo detectado:', isVideoconf ? '❌ VIDEOCONFERÊNCIA' : '✅ Outro tipo');
    
    if (isVideoconf) {
      console.log('');
      console.log('⚠️⚠️⚠️ ALERTA CRÍTICO ⚠️⚠️⚠️');
      console.log('Este é um certificado de VIDEOCONFERÊNCIA');
      console.log('NÃO é válido para emissão de NF-e/NFC-e');
      console.log('');
      console.log('✅ SOLUÇÃO:');
      console.log('Obter certificado e-CNPJ A1 ou A3');
      console.log('Custo: R$ 150-300 (A1, 1 ano)');
      console.log('');
    }

    // Extrair informações do certificado
    console.log('📄 Informações encontradas no certificado:\n');

    // Procurar por campos comuns
    const campos = [
      { regex: /CN=([^,\n]+)/i, nome: 'Nome Comum (CN)' },
      { regex: /OU=([^,\n]+)/gi, nome: 'Unidade Organizacional (OU)' },
      { regex: /O=([^,\n]+)/i, nome: 'Organização (O)' },
      { regex: /L=([^,\n]+)/i, nome: 'Localidade (L)' },
      { regex: /ST=([^,\n]+)/i, nome: 'Estado (ST)' },
      { regex: /C=([^,\n]+)/i, nome: 'País (C)' },
    ];

    campos.forEach(campo => {
      const matches = certDecrypted.match(campo.regex);
      if (matches) {
        if (campo.regex.global) {
          // Múltiplas correspondências (OU)
          const valores = [];
          let match;
          const regex = new RegExp(campo.regex.source, campo.regex.flags);
          while ((match = regex.exec(certDecrypted)) !== null) {
            valores.push(match[1]);
          }
          console.log(`  ${campo.nome}:`);
          valores.forEach(v => console.log(`    - ${v}`));
        } else {
          console.log(`  ${campo.nome}: ${matches[1]}`);
        }
      }
    });

    // Verificar validade
    console.log('\n📅 Validade:');
    const validadeRegex = /Not Before:\s*([^\n]+)[\s\S]*?Not After\s*:\s*([^\n]+)/i;
    const validade = certDecrypted.match(validadeRegex);
    if (validade) {
      console.log(`  De: ${validade[1]}`);
      console.log(`  Até: ${validade[2]}`);
    } else {
      console.log('  ⚠️ Não foi possível extrair datas de validade');
    }

    // Verificar uso permitido
    console.log('\n🔑 Uso do Certificado:');
    if (certDecrypted.includes('Key Usage') || certDecrypted.includes('Extended Key Usage')) {
      const keyUsage = certDecrypted.match(/Key Usage[:\s]+([^\n]+)/i);
      const extKeyUsage = certDecrypted.match(/Extended Key Usage[:\s]+([^\n]+)/i);
      
      if (keyUsage) console.log(`  Key Usage: ${keyUsage[1]}`);
      if (extKeyUsage) console.log(`  Extended Key Usage: ${extKeyUsage[1]}`);
    } else {
      console.log('  ℹ️ Informações de uso não encontradas no formato texto');
    }

    // Resumo final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA VERIFICAÇÃO');
    console.log('='.repeat(50) + '\n');

    if (isVideoconf) {
      console.log('❌ CERTIFICADO INADEQUADO PARA NF-e/NFC-e');
      console.log('');
      console.log('Este certificado é de VIDEOCONFERÊNCIA');
      console.log('Não pode ser usado para emissão fiscal');
      console.log('');
      console.log('🎯 PRÓXIMOS PASSOS:');
      console.log('1. Verificar se há outro certificado .pfx no computador');
      console.log('2. Se não houver: Contratar e-CNPJ A1');
      console.log('3. Autoridades Certificadoras:');
      console.log('   - Serpro: https://certificados.serpro.gov.br');
      console.log('   - Certisign: https://www.certisign.com.br');
      console.log('   - Serasa: https://serasa.certificadodigital.com.br');
      console.log('   - Valid: https://www.validcertificadora.com.br');
    } else {
      console.log('✅ Certificado pode ser adequado');
      console.log('');
      console.log('⚠️ IMPORTANTE:');
      console.log('Verifique se é certificado e-CNPJ A1 ou A3');
      console.log('Certificados e-CPF não servem para empresa');
    }

    console.log('\n' + '='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Erro ao verificar certificado:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Executar
verificarCertificado();
