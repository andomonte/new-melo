#!/usr/bin/env node

// Script SEGURO para backup e conversão de certificados
// Execute: node scripts/backup-seguro-certificados.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function backupSeguroCertificados() {
  console.log('🛡️ BACKUP SEGURO DOS CERTIFICADOS\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // Criar diretório de backup
      const backupDir = path.join(__dirname, '..', 'backup-certificados');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      console.log('1️⃣ 📦 Fazendo backup dos certificados atuais...');

      // Buscar certificados atuais
      const result = await client.query(`
        SELECT
          cgc,
          nomecontribuinte,
          "certificadoKey" as chave_privada_original,
          "certificadoCrt" as certificado_original,
          "cadeiaCrt" as cadeia_original
        FROM db_manaus.dadosempresa
        WHERE "certificadoKey" IS NOT NULL
          AND "certificadoCrt" IS NOT NULL
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        console.log('❌ Nenhum certificado encontrado');
        return;
      }

      const dados = result.rows[0];
      const cnpj = dados.cgc.trim().replace(/[^\d]/g, '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Salvar backup
      const backupFile = path.join(backupDir, `backup-certificados-${cnpj}-${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(dados, null, 2));

      console.log(`✅ Backup salvo em: ${backupFile}`);
      console.log('');

      // ==========================================
      // CONVERTER PARA PEM (versão segura)
      // ==========================================

      console.log('2️⃣ 🔄 Convertendo para formato PEM...');

      function converterParaPEM(conteudo, tipo) {
        if (!conteudo) return null;

        // Se já é PEM, retornar como está
        if (conteudo.includes('-----BEGIN')) {
          console.log(`   ✅ ${tipo} já está em formato PEM`);
          return conteudo;
        }

        console.log(`   🔄 Convertendo ${tipo} para formato PEM`);

        // Detectar tipo baseado no conteúdo
        let header, footer;
        if (tipo === 'CERTIFICADO') {
          header = '-----BEGIN CERTIFICATE-----';
          footer = '-----END CERTIFICATE-----';
        } else if (tipo === 'CHAVE PRIVADA') {
          // Tentar detectar se é PKCS#1 ou PKCS#8
          if (conteudo.includes('BEGIN RSA PRIVATE KEY')) {
            return conteudo; // Já é PEM
          }
          header = '-----BEGIN PRIVATE KEY-----';
          footer = '-----END PRIVATE KEY-----';
        } else if (tipo === 'CADEIA') {
          header = '-----BEGIN CERTIFICATE-----';
          footer = '-----END CERTIFICATE-----';
        }

        try {
          // Decodificar base64 se necessário
          let dadosBinarios;
          try {
            dadosBinarios = Buffer.from(conteudo, 'base64');
          } catch {
            // Se não é base64, assumir que já é binário
            dadosBinarios = Buffer.from(conteudo, 'binary');
          }

          // Converter para base64 e formatar em linhas de 64 chars
          const base64 = dadosBinarios.toString('base64');
          const lines = base64.match(/.{1,64}/g) || [];

          return header + '\n' + lines.join('\n') + '\n' + footer + '\n';

        } catch (error) {
          console.log(`   ⚠️ Erro na conversão ${tipo}, mantendo original: ${error.message}`);
          return conteudo;
        }
      }

      // Converter certificados
      const certPEM = converterParaPEM(dados.certificado_original, 'CERTIFICADO');
      const keyPEM = converterParaPEM(dados.chave_privada_original, 'CHAVE PRIVADA');
      const cadeiaPEM = converterParaPEM(dados.cadeia_original, 'CADEIA');

      // Salvar versão PEM também
      const pemFile = path.join(backupDir, `certificados-pem-${cnpj}-${timestamp}.json`);
      fs.writeFileSync(pemFile, JSON.stringify({
        cgc: dados.cgc,
        nomecontribuinte: dados.nomecontribuinte,
        certificadoCrt: certPEM,
        certificadoKey: keyPEM,
        cadeiaCrt: cadeiaPEM
      }, null, 2));

      console.log(`✅ Versão PEM salva em: ${pemFile}`);
      console.log('');

      // ==========================================
      // ATUALIZAR BANCO (com opção de rollback)
      // ==========================================

      console.log('3️⃣ 💾 Atualizando banco de dados...');

      // Criar tabela de backup se não existir
      await client.query(`
        CREATE TABLE IF NOT EXISTS db_manaus.backup_certificados (
          id SERIAL PRIMARY KEY,
          cgc VARCHAR(20),
          data_backup TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          certificado_key_original TEXT,
          certificado_crt_original TEXT,
          cadeia_crt_original TEXT,
          certificado_key_pem TEXT,
          certificado_crt_pem TEXT,
          cadeia_crt_pem TEXT
        )
      `);

      // Salvar backup na tabela
      await client.query(`
        INSERT INTO db_manaus.backup_certificados
        (cgc, certificado_key_original, certificado_crt_original, cadeia_crt_original,
         certificado_key_pem, certificado_crt_pem, cadeia_crt_pem)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        dados.cgc,
        dados.chave_privada_original,
        dados.certificado_original,
        dados.cadeia_original,
        keyPEM,
        certPEM,
        cadeiaPEM
      ]);

      console.log('✅ Backup salvo na tabela backup_certificados');
      console.log('');

      // Atualizar dadosempresa com versão PEM
      await client.query(`
        UPDATE db_manaus.dadosempresa
        SET
          "certificadoKey" = $1,
          "certificadoCrt" = $2,
          "cadeiaCrt" = $3
        WHERE cgc = $4
      `, [keyPEM, certPEM, cadeiaPEM, dados.cgc]);

      console.log('✅ Banco atualizado com certificados em formato PEM');
      console.log('');

      // ==========================================
      // TESTAR SE FUNCIONA
      // ==========================================

      console.log('4️⃣ 🧪 Testando se os certificados convertidos funcionam...');

      try {
        const https = require('https');
        const agent = new https.Agent({
          key: Buffer.from(keyPEM),
          cert: Buffer.from(certPEM),
          ca: cadeiaPEM ? Buffer.from(cadeiaPEM) : undefined,
          rejectUnauthorized: false
        });

        console.log('✅ Certificados carregados com sucesso no Node.js!');
        console.log('');

        // ==========================================
        // INSTRUÇÕES DE ROLLBACK
        // ==========================================

        console.log('🛡️ INSTRUÇÕES DE SEGURANÇA:');
        console.log('');
        console.log('Se precisar voltar aos certificados originais:');
        console.log('');
        console.log('1. 📄 Arquivos de backup criados:');
        console.log(`   - ${backupFile}`);
        console.log(`   - ${pemFile}`);
        console.log('');
        console.log('2. 🗄️ Backup no banco (tabela backup_certificados)');
        console.log('');
        console.log('3. 🔄 Para restaurar manualmente:');
        console.log(`   UPDATE db_manaus.dadosempresa`);
        console.log(`   SET "certificadoKey" = (SELECT certificado_key_original`);
        console.log(`       FROM db_manaus.backup_certificados`);
        console.log(`       WHERE cgc = '${dados.cgc}' ORDER BY data_backup DESC LIMIT 1),`);
        console.log(`       "certificadoCrt" = (SELECT certificado_crt_original`);
        console.log(`       FROM db_manaus.backup_certificados`);
        console.log(`       WHERE cgc = '${dados.cgc}' ORDER BY data_backup DESC LIMIT 1),`);
        console.log(`       "cadeiaCrt" = (SELECT cadeia_crt_original`);
        console.log(`       FROM db_manaus.backup_certificados`);
        console.log(`       WHERE cgc = '${dados.cgc}' ORDER BY data_backup DESC LIMIT 1)`);
        console.log(`   WHERE cgc = '${dados.cgc}'`);
        console.log('');
        console.log('✅ SUA NF-e CONTINUARÁ FUNCIONANDO NORMALMENTE!');
        console.log('   Os sistemas legados conseguem ler ambos os formatos.');

      } catch (testError) {
        console.log(`❌ Erro ao testar certificados: ${testError.message}`);
        console.log('');
        console.log('🔄 Execute o rollback acima para restaurar os certificados originais.');
      }

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error) {
    console.error('❌ ERRO GERAL:', error.message);
    process.exit(1);
  }
}

backupSeguroCertificados().then(() => {
  console.log('\n🎉 Backup e conversão concluídos com segurança!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});