
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function buscarContaBB() {

      const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  BUSCANDO CONTAS DO BANCO DO BRASIL');
    console.log('════════════════════════════════════════════════════════\n');

    // Buscar contas do Banco do Brasil (código 0001 ou variações)
    const contas = await pool.query(`
      SELECT 
        cod_conta,
        cod_banco,
        nro_conta,
        oficial,
        digito
      FROM db_manaus.dbconta
      WHERE cod_banco IN ('0001', '001', '1', '0005')
      ORDER BY oficial DESC, cod_conta;
    `);

    if (contas.rows.length === 0) {
      console.log('⚠️  Nenhuma conta do Banco do Brasil encontrada\n');
      console.log('   Códigos pesquisados: 0001, 001, 1, 0005\n');
    } else {
      console.log(`✅ Encontradas ${contas.rows.length} conta(s) do Banco do Brasil:\n`);
      
      contas.rows.forEach((row, idx) => {
        console.log(`   ┌─ Conta ${idx + 1} ${row.oficial === 'S' ? '⭐ OFICIAL' : ''}`);
        console.log(`   │  Código Conta     : ${row.cod_conta}`);
        console.log(`   │  Código Banco     : ${row.cod_banco}`);
        console.log(`   │  Número da Conta  : ${row.nro_conta}`);
        console.log(`   │  Dígito          : ${row.digito || '(sem dígito)'}`);
        console.log(`   │  Oficial         : ${row.oficial}`);
        console.log('   └─');
      });
    }

    // Buscar também na tabela dbbanco para mais informações
    console.log('\n────────────────────────────────────────────────────────');
    console.log('🔍  Verificando tabela dbbanco...\n');

    const bancos = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
      AND table_name = 'dbbanco'
      ORDER BY ordinal_position
      LIMIT 1;
    `);

    if (bancos.rows.length > 0) {
      const dadosBanco = await pool.query(`
        SELECT * FROM db_manaus.dbbanco
        WHERE codigo IN ('0001', '001', '1', '0005')
        LIMIT 5;
      `);

      if (dadosBanco.rows.length > 0) {
        console.log(`   ✅ Encontrados ${dadosBanco.rows.length} registro(s) em dbbanco:\n`);
        dadosBanco.rows.forEach((row, idx) => {
          console.log(`   ┌─ Banco ${idx + 1}`);
          Object.entries(row).forEach(([key, value]) => {
            const displayValue = value === null ? '(null)' : value;
            console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
          });
          console.log('   └─');
        });
      } else {
        console.log('   ⚠️  Nenhum registro encontrado em dbbanco para BB\n');
      }
    } else {
      console.log('   ℹ️  Tabela dbbanco não encontrada\n');
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ Busca concluída!');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO AO BUSCAR CONTAS');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.error('\nDetalhes completos:');
    console.error(error);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

buscarContaBB();
