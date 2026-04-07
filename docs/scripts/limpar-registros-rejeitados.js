const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function limparRegistrosRejeitados() {
  const client = await pool.connect();
  
  try {
    console.log('\n🧹 LIMPEZA DE REGISTROS REJEITADOS\n');
    console.log('=' .repeat(80));
    
    // Buscar registros rejeitados da fatura 000234583
    const queryBuscar = `
      SELECT codfat, nrodoc_fiscal, chave, status
      FROM db_manaus.dbfat_nfe
      WHERE codfat = '000234583'
      ORDER BY chave
    `;
    
    const result = await client.query(queryBuscar);
    
    console.log(`\n📋 Encontrados ${result.rows.length} registros para a fatura 000234583:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Status ${row.status} - Chave: ${row.chave.substring(0, 44)}...`);
    });
    
    // Deletar todos os registros da fatura 000234583
    console.log('\n\n🗑️  Deletando todos os registros rejeitados...\n');
    
    const queryDelete = `
      DELETE FROM db_manaus.dbfat_nfe
      WHERE codfat = '000234583'
    `;
    
    const deleteResult = await client.query(queryDelete);
    
    console.log(`✅ ${deleteResult.rowCount} registro(s) deletado(s) com sucesso!`);
    
    // Verificar estado final
    console.log('\n\n📊 ESTADO FINAL:\n');
    console.log('=' .repeat(80));
    
    const queryFinal = `
      SELECT 
        MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero,
        COUNT(*) as total_autorizadas
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2' AND nfe.status = '100'
    `;
    
    const finalResult = await client.query(queryFinal);
    const dados = finalResult.rows[0];
    
    console.log(`\nÚltimo número AUTORIZADO: ${dados.ultimo_numero}`);
    console.log(`Total de NFes autorizadas na série 2: ${dados.total_autorizadas}`);
    console.log(`\n✅ Próximo número disponível: ${dados.ultimo_numero + 1}`);
    console.log('\n🎯 Sistema pronto para emitir a fatura 000234583!');
    
  } catch (error) {
    console.error('\n❌ Erro na limpeza:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

limparRegistrosRejeitados();
