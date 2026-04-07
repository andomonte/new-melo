
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function buscarDadosBancoBB() {
    const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  BUSCANDO DADOS BANCÁRIOS DO BB');
    console.log('════════════════════════════════════════════════════════\n');

    // Buscar na dbdados_banco com código '2' (BB)
    const dadosBB = await pool.query(`
      SELECT * FROM db_manaus.dbdados_banco
      WHERE banco IN ('1', '2', '001', '0001', '0005')
      ORDER BY banco;
    `);

    console.log(`📊 Registros encontrados em dbdados_banco: ${dadosBB.rows.length}\n`);

    if (dadosBB.rows.length > 0) {
      dadosBB.rows.forEach((row, idx) => {
        console.log(`   ┌─ Registro ${idx + 1} - Banco: ${row.banco}`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === null ? '(null)' : value;
          console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
        });
        console.log('   └─\n');
      });
    } else {
      console.log('   ⚠️  Nenhum registro encontrado com esses códigos\n');
    }

    // Verificar TODOS os registros de dbdados_banco
    console.log('────────────────────────────────────────────────────────');
    console.log('📋 TODOS OS REGISTROS DE dbdados_banco:\n');

    const todosDados = await pool.query(`
      SELECT * FROM db_manaus.dbdados_banco
      ORDER BY id;
    `);

    console.log(`   Total: ${todosDados.rows.length} registros\n`);

    todosDados.rows.forEach((row, idx) => {
      console.log(`   ┌─ ID ${row.id} - Banco: ${row.banco}`);
      Object.entries(row).forEach(([key, value]) => {
        const displayValue = value === null ? '(null)' : value;
        console.log(`   │  ${key.padEnd(20)}: ${displayValue}`);
      });
      console.log('   └─\n');
    });

    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Busca concluída!');
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

buscarDadosBancoBB();
