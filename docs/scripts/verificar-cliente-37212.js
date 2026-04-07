
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarCliente37212() {
    const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🔍  VERIFICANDO CLIENTE 37212');
    console.log('════════════════════════════════════════════════════════\n');

    const cliente = await pool.query(`
      SELECT 
        codcli,
        nome,
        nomefant,
        cpfcgc,
        LENGTH(REPLACE(REPLACE(REPLACE(cpfcgc, '.', ''), '-', ''), '/', '')) as tamanho_doc,
        CASE 
          WHEN LENGTH(REPLACE(REPLACE(REPLACE(cpfcgc, '.', ''), '-', ''), '/', '')) = 14 THEN 'CNPJ'
          WHEN LENGTH(REPLACE(REPLACE(REPLACE(cpfcgc, '.', ''), '-', ''), '/', '')) = 11 THEN 'CPF'
          ELSE 'INVÁLIDO'
        END as tipo_documento,
        email,
        banco
      FROM db_manaus.dbclien
      WHERE codcli = '37212';
    `);

    if (cliente.rows.length > 0) {
      const c = cliente.rows[0];
      
      console.log('📋 DADOS DO CLIENTE 37212:\n');
      console.log(`   Código          : ${c.codcli}`);
      console.log(`   Nome            : ${c.nome}`);
      console.log(`   Nome Fantasia   : ${c.nomefant || '(não informado)'}`);
      console.log(`   CPF/CNPJ        : ${c.cpfcgc}`);
      console.log(`   Tipo Documento  : ${c.tipo_documento} (${c.tamanho_doc} dígitos)`);
      console.log(`   Email           : ${c.email || '(não informado)'}`);
      console.log(`   Banco           : ${c.banco || '(não informado)'}`);

      console.log('\n────────────────────────────────────────────────────────');
      console.log('🎯 ANÁLISE:');
      console.log('────────────────────────────────────────────────────────\n');

      if (c.tipo_documento === 'CNPJ') {
        console.log('   ❌ Cliente possui CNPJ!');
        console.log('   → Deve emitir NF-e (Nota Fiscal - Modelo 55)');
        console.log('   → Endpoint: /api/faturamento/emitir\n');
      } else if (c.tipo_documento === 'CPF') {
        console.log('   ✅ Cliente possui CPF!');
        console.log('   → Pode emitir NFC-e (Cupom Fiscal - Modelo 65)');
        console.log('   → Endpoint: /api/faturamento/emitir-cupom\n');
      } else {
        console.log('   ⚠️  Documento inválido ou vazio!');
        console.log(`   → Tamanho: ${c.tamanho_doc} dígitos`);
        console.log(`   → CPF deve ter 11 dígitos, CNPJ deve ter 14 dígitos\n`);
      }

      console.log('────────────────────────────────────────────────────────');
      console.log('🔍 POSSÍVEL PROBLEMA:');
      console.log('────────────────────────────────────────────────────────\n');
      
      if (c.tipo_documento === 'CPF') {
        console.log('   Se está dando erro 400 ao tentar emitir cupom,');
        console.log('   verifique o log do backend para ver a mensagem exata.');
        console.log('   O erro pode ser:');
        console.log('   - Cliente não informado no payload');
        console.log('   - Campo cpfcgc vazio no payload');
        console.log('   - Outro problema de validação\n');
      }

    } else {
      console.log('⚠️  Cliente 37212 não encontrado\n');
    }

    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Verificação concluída!');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

verificarCliente37212();
