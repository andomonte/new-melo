// Atualizar dados bancários reais do Banco do Brasil
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function atualizarDadosBanco() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🏦 Atualizando dados bancários do Banco do Brasil...\n');
    
    // ⚠️ IMPORTANTE: Substitua pelos dados REAIS da empresa!
    const AGENCIA_REAL = '0000';        // ⚠️ SUBSTITUIR pela agência real
    const CONTA_REAL = '0000000';       // ⚠️ SUBSTITUIR pela conta real
    const CONVENIO_REAL = '1805313900'; // ⚠️ CONFIRMAR se está correto
    const CARTEIRA_REAL = '17';         // ⚠️ Carteira RCR (Cobrança Simples)

    console.log('⚠️  ATENÇÃO: Verifique se os dados abaixo estão corretos!');
    console.log(`   Agência: ${AGENCIA_REAL}`);
    console.log(`   Conta: ${CONTA_REAL}`);
    console.log(`   Convênio: ${CONVENIO_REAL}`);
    console.log(`   Carteira: ${CARTEIRA_REAL}\n`);

    await pool.query(
      `UPDATE db_manaus.dbdados_banco 
       SET 
         agencia = $1,
         nroconta = $2,
         convenio = $3,
         carteira = $4
       WHERE banco = '001'`,
      [AGENCIA_REAL, CONTA_REAL, CONVENIO_REAL, CARTEIRA_REAL]
    );

    console.log('✅ Dados atualizados com sucesso!\n');

    // Mostrar dados finais
    const resultado = await pool.query(
      `SELECT * FROM db_manaus.dbdados_banco WHERE banco = '001'`
    );
    
    console.log('📋 Dados cadastrados:');
    console.log(JSON.stringify(resultado.rows[0], null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

atualizarDadosBanco();
