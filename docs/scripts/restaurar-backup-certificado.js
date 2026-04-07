#!/usr/bin/env node

// Script para restaurar certificado do backup
// Execute: node scripts/restaurar-backup-certificado.js

const { Pool } = require('pg');
require('dotenv').config();

async function restaurarBackupCertificado() {
  console.log('🔄 Restaurando certificado do backup...\n');

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      // Buscar backup mais recente
      const backup = await client.query(`
        SELECT
          certificado_key_original,
          certificado_crt_original,
          cadeia_crt_original
        FROM db_manaus.backup_certificados
        WHERE cgc = '18053139000169 '
        ORDER BY data_backup DESC
        LIMIT 1
      `);

      if (backup.rows.length === 0) {
        console.log('❌ ERRO: Nenhum backup encontrado!');
        console.log('💡 Execute primeiro: node scripts/backup-seguro-certificados.js');
        return;
      }

      const dadosBackup = backup.rows[0];

      console.log('📦 Backup encontrado!');
      console.log(`🔑 Tamanho chave privada: ${dadosBackup.certificado_key_original.length} caracteres`);
      console.log(`📜 Tamanho certificado: ${dadosBackup.certificado_crt_original.length} caracteres`);
      console.log(`🔗 Tamanho cadeia: ${dadosBackup.cadeia_crt_original ? dadosBackup.cadeia_crt_original.length : 0} caracteres`);
      console.log('');

      // Restaurar no dadosempresa
      await client.query(`
        UPDATE db_manaus.dadosempresa
        SET
          "certificadoKey" = $1,
          "certificadoCrt" = $2,
          "cadeiaCrt" = $3
        WHERE cgc = '18053139000169 '
      `, [
        dadosBackup.certificado_key_original,
        dadosBackup.certificado_crt_original,
        dadosBackup.cadeia_crt_original
      ]);

      console.log('✅ Certificado restaurado com sucesso!');
      console.log('');
      console.log('🧪 Testando se o certificado restaurado funciona...');

      // Testar se funciona
      try {
        const https = require('https');
        const agent = new https.Agent({
          key: Buffer.from(dadosBackup.certificado_key_original),
          cert: Buffer.from(dadosBackup.certificado_crt_original),
          ca: dadosBackup.cadeia_crt_original ? Buffer.from(dadosBackup.cadeia_crt_original) : undefined,
          rejectUnauthorized: false
        });

        console.log('✅ Certificado carregado com sucesso no Node.js!');
        console.log('');
        console.log('🎯 PRÓXIMOS PASSOS:');
        console.log('1. Teste sua emissão de NF-e - deve funcionar novamente');
        console.log('2. Se NFC-e ainda não funcionar, o problema é específico do formato');
        console.log('3. Para NFC-e, será necessário obter o certificado .pfx original');

      } catch (testError) {
        console.log(`❌ Erro ao testar certificado: ${testError.message}`);
        console.log('💡 O backup pode estar corrompido também');
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

restaurarBackupCertificado().then(() => {
  console.log('\n🎉 Restauração concluída!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 ERRO FATAL:', error);
  process.exit(1);
});