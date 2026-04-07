
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function atualizarContaBB() {
    const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  ATUALIZANDO DADOS REAIS DO BANCO DO BRASIL');
    console.log('════════════════════════════════════════════════════════\n');

    // Dados reais da conta encontrada em dbconta
    const dadosReais = {
      nroconta: '161625',      // Número da conta (sem dígito)
      agencia: '0000',         // Mantém como estava (não é necessário)
      convenio: '1805313900',  // Convênio correto
      carteira: '17'           // Carteira 17 - RCR
    };

    console.log('📋 Dados a serem atualizados:\n');
    console.log(`   Banco           : 001 (Banco do Brasil)`);
    console.log(`   Agência         : ${dadosReais.agencia} (não utilizado)`);
    console.log(`   Conta           : ${dadosReais.nroconta}-9`);
    console.log(`   Convênio        : ${dadosReais.convenio}`);
    console.log(`   Carteira        : ${dadosReais.carteira}\n`);

    // Atualizar o registro ID 15 (banco='001')
    const resultado = await pool.query(`
      UPDATE db_manaus.dbdados_banco
      SET 
        nroconta = $1,
        agencia = $2,
        convenio = $3,
        carteira = $4
      WHERE banco = '001'
      RETURNING *;
    `, [dadosReais.nroconta, dadosReais.agencia, dadosReais.convenio, dadosReais.carteira]);

    if (resultado.rowCount > 0) {
      console.log('────────────────────────────────────────────────────────');
      console.log('✅ ATUALIZAÇÃO REALIZADA COM SUCESSO!');
      console.log('────────────────────────────────────────────────────────\n');
      
      console.log('   Registro atualizado:\n');
      resultado.rows.forEach(row => {
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === null ? '(null)' : value;
          console.log(`   ${key.padEnd(20)}: ${displayValue}`);
        });
      });

      console.log('\n────────────────────────────────────────────────────────');
      console.log('🎯 PRÓXIMOS PASSOS:');
      console.log('────────────────────────────────────────────────────────\n');
      console.log('   1. ✅ Dados do BB atualizados com a conta REAL: 161625-9');
      console.log('   2. 🧪 Teste a geração de boleto novamente');
      console.log('   3. 📧 Teste o envio de email com NFe + Boleto\n');
      
    } else {
      console.log('⚠️  Nenhum registro foi atualizado!\n');
    }

    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO AO ATUALIZAR');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.error('\nDetalhes completos:');
    console.error(error);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

atualizarContaBB();
