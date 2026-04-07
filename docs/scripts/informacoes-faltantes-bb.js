
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function atualizarContaRealBB() {

    const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  ATUALIZANDO COM CONTA REAL DO BB');
    console.log('════════════════════════════════════════════════════════\n');

    // Dados reais encontrados na tabela dbconta
    const dadosReais = {
      nroconta: '161625',      // Número da conta sem dígito
      agencia: 'PENDENTE',     // VOCÊ PRECISA SABER A AGÊNCIA!
      convenio: '1805313900',  // Convênio já estava correto
      carteira: '17'           // Carteira já estava correta
    };

    console.log('📋 Dados a serem atualizados:\n');
    console.log(`   Agência         : ${dadosReais.agencia} ⚠️  VOCÊ PRECISA INFORMAR!`);
    console.log(`   Conta           : ${dadosReais.nroconta}-9`);
    console.log(`   Convênio        : ${dadosReais.convenio}`);
    console.log(`   Carteira        : ${dadosReais.carteira}`);
    console.log(`\n   🔍 Banco: 001 (Banco do Brasil)\n`);

    console.log('────────────────────────────────────────────────────────');
    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('────────────────────────────────────────────────────────\n');
    console.log('   Para completar a configuração, você precisa informar:\n');
    console.log('   1. 🏢 AGÊNCIA do Banco do Brasil');
    console.log('      Onde encontrar:');
    console.log('      - Contrato de cobrança/boleto com o BB');
    console.log('      - App/Internet Banking do BB');
    console.log('      - Boletos antigos emitidos');
    console.log('      - Extrato bancário\n');
    console.log('   2. ✅ Confirmar se a CONTA 161625-9 está correta\n');
    console.log('   3. ✅ Confirmar se o CONVÊNIO 1805313900 está correto');
    console.log('      (Este convênio tem 10 dígitos, convênios BB podem ter 6 ou 7)\n');

    console.log('────────────────────────────────────────────────────────');
    console.log('💡 COMO PROCEDER:');
    console.log('────────────────────────────────────────────────────────\n');
    console.log('   Depois de obter a AGÊNCIA, edite o arquivo:');
    console.log('   scripts/atualizar-dados-banco-real.js\n');
    console.log('   E substitua:');
    console.log('   - AGENCIA_REAL    → Exemplo: "3715" (4 dígitos)');
    console.log('   - CONTA_REAL      → "161625" (já sabemos)');
    console.log('   - CONVENIO_REAL   → Verificar se "1805313900" está correto');
    console.log('   - CARTEIRA_REAL   → "17" (RCR - já configurada)\n');
    console.log('   Depois execute: node .\\scripts\\atualizar-dados-banco-real.js\n');

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

atualizarContaRealBB();
