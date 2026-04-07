require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'srv-captain--postgre-oracle',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'db_manaus',
  user: process.env.DB_USER || 'postgre',
  password: process.env.DB_PASSWORD || 'Skynd@2019',
});

async function consultarContaBB() {
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  CONTAS DO BANCO DO BRASIL');
    console.log('════════════════════════════════════════════════════════\n');

    // Buscar todas as contas do Banco do Brasil
    const contasBB = await pool.query(`
      SELECT 
        cod_conta,
        cod_banco,
        nro_conta,
        oficial,
        digito
      FROM db_manaus.dbconta
      WHERE cod_banco IN ('0001', '001', '1')
      ORDER BY cod_conta;
    `);

    if (contasBB.rows.length === 0) {
      console.log('❌ Nenhuma conta do Banco do Brasil encontrada\n');
      console.log('   Buscando por códigos: 0001, 001, 1\n');
    } else {
      console.log(`✅ Encontradas ${contasBB.rows.length} conta(s) do Banco do Brasil:\n`);
      
      contasBB.rows.forEach((conta, idx) => {
        console.log(`   ┌─ Conta ${idx + 1}`);
        console.log(`   │  Código Conta    : ${conta.cod_conta}`);
        console.log(`   │  Código Banco    : ${conta.cod_banco}`);
        console.log(`   │  Número Conta    : ${conta.nro_conta}`);
        console.log(`   │  Dígito          : ${conta.digito || '(null)'}`);
        console.log(`   │  Oficial         : ${conta.oficial}`);
        console.log('   └─');
      });
    }

    // Buscar também todas as contas oficiais para referência
    console.log('\n────────────────────────────────────────────────────────');
    console.log('📋 TODAS AS CONTAS OFICIAIS (oficial = \'S\')');
    console.log('────────────────────────────────────────────────────────\n');

    const contasOficiais = await pool.query(`
      SELECT 
        cod_conta,
        cod_banco,
        nro_conta,
        digito
      FROM db_manaus.dbconta
      WHERE oficial = 'S'
      ORDER BY cod_banco, cod_conta;
    `);

    console.log(`   Total: ${contasOficiais.rows.length} contas oficiais\n`);
    
    contasOficiais.rows.forEach((conta) => {
      const digito = conta.digito ? `-${conta.digito}` : '';
      console.log(`   Banco ${conta.cod_banco.padEnd(6)} | Conta ${conta.cod_conta.padEnd(6)} | ${conta.nro_conta}${digito}`);
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log('💡 PRÓXIMOS PASSOS');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('   Se encontrou conta do BB, verifique se o nro_conta');
    console.log('   contém a agência e conta real da empresa.');
    console.log('\n   Se não encontrou, procure em outras tabelas ou');
    console.log('   consulte o gerente do Banco do Brasil.\n');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO AO CONSULTAR CONTAS');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.error('\nDetalhes:', error);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

consultarContaBB();
