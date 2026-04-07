// Verificar sequences disponíveis no banco
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarSequences() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Consultando sequences disponíveis...\n');

    const query = `
      SELECT 
        schemaname,
        sequencename
      FROM pg_sequences
      WHERE schemaname IN ('public', 'db_manaus')
      ORDER BY sequencename;
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma sequence encontrada no schema public');
    } else {
      console.log(`✅ Encontradas ${result.rows.length} sequences:\n`);
      
      result.rows.forEach((row) => {
        console.log(`   📊 ${row.schemaname}.${row.sequencename}`);
      });
      
      console.log('\n🔍 Buscando valor atual das sequences relacionadas a receb/docbanco:\n');
      
      const seqReceb = result.rows.filter(r => 
        r.sequencename.toLowerCase().includes('receb') ||
        r.sequencename.toLowerCase().includes('doc')
      );
      
      for (const seq of seqReceb) {
        const seqName = `${seq.schemaname}.${seq.sequencename}`;
        const lastVal = await pool.query(`SELECT last_value FROM ${seqName}`);
        console.log(`   ${seqName}: ${lastVal.rows[0].last_value}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarSequences();
