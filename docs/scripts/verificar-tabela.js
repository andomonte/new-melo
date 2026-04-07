// Script para verificar estrutura da tabela dadosempresa
// Execute: node scripts/verificar-tabela.js

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarTabela() {
  console.log('🔍 Verificando estrutura da tabela dadosempresa...');
  
  try {
    // Conectar ao banco
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    
    try {
      // 1️⃣ Verificar se a tabela existe
      console.log('📋 Verificando se tabela dadosempresa existe...');
      const tabelaExiste = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'db_manaus' 
          AND table_name = 'dadosempresa'
      `);
      
      if (tabelaExiste.rows.length === 0) {
        console.log('❌ Tabela dadosempresa não encontrada no schema db_manaus');
        return;
      }
      
      console.log('✅ Tabela dadosempresa encontrada!');
      
      // 2️⃣ Listar todas as colunas
      console.log('\n📊 Colunas da tabela dadosempresa:');
      const colunas = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
          AND table_name = 'dadosempresa'
        ORDER BY ordinal_position
      `);
      
      console.table(colunas.rows);
      
      // 3️⃣ Verificar se colunas CSC existem
      console.log('\n🔐 Status das colunas CSC:');
      const colunasCSC = colunas.rows.filter(col => 
        col.column_name.includes('csc') || 
        col.column_name === 'codigoemp' ||
        col.column_name === 'id'
      );
      
      if (colunasCSC.length > 0) {
        console.table(colunasCSC);
      } else {
        console.log('❌ Nenhuma coluna CSC encontrada');
      }
      
      // 4️⃣ Contar registros
      console.log('\n📈 Dados na tabela:');
      const count = await client.query('SELECT COUNT(*) as total FROM db_manaus.dadosempresa');
      console.log(`Total de registros: ${count.rows[0].total}`);
      
      // 5️⃣ Mostrar primeiros registros (só IDs)
      if (parseInt(count.rows[0].total) > 0) {
        console.log('\n📋 Primeiros registros (primeiras 3 colunas):');
        const primeiros = await client.query(`
          SELECT * FROM db_manaus.dadosempresa 
          LIMIT 3
        `);
        
        // Mostrar só as primeiras colunas para não poluir o terminal
        primeiros.rows.forEach((row, index) => {
          console.log(`Registro ${index + 1}:`, Object.keys(row).slice(0, 3).reduce((obj, key) => {
            obj[key] = row[key];
            return obj;
          }, {}));
        });
      }
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
    process.exit(1);
  }
}

// Executar
verificarTabela().then(() => {
  console.log('\n🎉 Verificação concluída!');
  process.exit(0);
});