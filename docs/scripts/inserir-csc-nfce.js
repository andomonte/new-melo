// Script para inserir CSC da NFC-e no banco de dados
// Execute: node scripts/inserir-csc-nfce.js

const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

// Função de criptografia (copiada de src/utils/crypto.ts)
const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || '';
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';

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
        resolve(derivedKey);
      }
    );
  });
}

async function encrypt(text) {
  if (!text) return null;
  
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKeyFromMaster(salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return `${encrypted}.${salt.toString('base64')}.${iv.toString('base64')}`;
}
async function inserirCSC() {
  console.log('🔐 Inserindo CSC da NFC-e no banco de dados...');
  
  // Dados do CSC obtidos da SEFAZ-AM
  const CSC_ID = '000001';
  const CSC_HOMOLOGACAO = '074b1eae0862fd5a';
  
  try {
    // 1️⃣ Criptografar o CSC
    console.log('🔒 Criptografando CSC...');
    const cscCriptografado = await encrypt(CSC_HOMOLOGACAO);
    
    if (!cscCriptografado) {
      throw new Error('Erro ao criptografar CSC');
    }
    
    // 2️⃣ Conectar ao banco
    console.log('📊 Conectando ao banco de dados...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    
    try {
      // 3️⃣ Inserir no banco (usando CGC da empresa principal)
      console.log('💾 Inserindo CSC na tabela dadosempresa...');
      const result = await client.query(`
        UPDATE db_manaus.dadosempresa 
        SET 
          csc_nfce_id = $1,
          csc_nfce_homologacao = $2
        WHERE cgc = '18053139000169 '
        RETURNING csc_nfce_id, cgc
      `, [CSC_ID, cscCriptografado]);
      
      if (result.rowCount === 0) {
        throw new Error('Nenhuma linha foi atualizada. Verifique se existe registro na tabela dadosempresa');
      }
      
      // 4️⃣ Verificar inserção
      console.log('🔍 Verificando CSC inserido...');
      const verificacao = await client.query(`
        SELECT 
          cgc,
          nomecontribuinte,
          csc_nfce_id,
          CASE 
            WHEN csc_nfce_homologacao IS NOT NULL THEN 'Configurado'
            ELSE 'Não configurado'
          END as status_homologacao
        FROM db_manaus.dadosempresa 
        WHERE cgc = '18053139000169 '
      `);
      
      console.log('✅ CSC inserido com sucesso!');
      console.log('📋 Status:', verificacao.rows[0]);
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Erro ao inserir CSC:', error.message);
    process.exit(1);
  }
}

// Executar
inserirCSC().then(() => {
  console.log('🎉 Processo concluído!');
  console.log('🚀 Agora você pode testar a NFC-e com CSC válido!');
  process.exit(0);
});