const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});


async function checkStructure() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbreceb'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Estrutura atual da tabela dbreceb:\n');
    result.rows.forEach(col => {
      const type = col.character_maximum_length 
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      console.log(`  ✓ ${col.column_name.padEnd(20)} ${type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Verificar campos que precisamos adicionar
    const columnNames = result.rows.map(r => r.column_name.toLowerCase());
    const camposFaltantes = [];
    
    if (!columnNames.includes('bradesco')) camposFaltantes.push('bradesco');
    if (!columnNames.includes('venc_ant')) camposFaltantes.push('venc_ant');
    if (!columnNames.includes('nro_banco')) camposFaltantes.push('nro_banco');

    if (camposFaltantes.length > 0) {
      console.log('\n⚠️  Campos faltantes para remessa:');
      camposFaltantes.forEach(c => console.log(`  ❌ ${c}`));
    } else {
      console.log('\n✅ Todos os campos necessários estão presentes!');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStructure();
