require('dotenv').config();
const { Pool } = require('pg');

async function verificarColunas() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não encontrada no .env');
    console.log('💡 Tentando usar configuração padrão local...');
    
    // Configuração padrão para desenvolvimento local
    process.env.DATABASE_URL = 'postgresql://postgres:senha@localhost:5432/nome_banco';
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Verificando colunas codgp e agp na tabela dbfatura...\n');
    
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dbfatura' 
      AND column_name IN ('codgp', 'agp')
      ORDER BY column_name;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma das colunas (codgp, agp) foi encontrada na tabela dbfatura');
      
      // Tentar verificar se a tabela existe
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'dbfatura'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('❌ A tabela dbfatura não existe no banco');
      } else {
        console.log('✅ A tabela dbfatura existe, mas as colunas codgp/agp não foram encontradas');
        console.log('💡 Execute o script: scripts/setup_completo_agrupamento.sql');
      }
    } else {
      console.log('✅ Colunas encontradas:');
      result.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'NULL'})`);
      });
      
      // Verificar estatísticas apenas se as colunas existirem
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total_faturas,
          COUNT(codgp) as faturas_com_codgp,
          COUNT(CASE WHEN agp = 'S' THEN 1 END) as faturas_agrupadas
        FROM dbfatura;
      `);
      
      console.log('\n📊 Estatísticas:');
      console.log(`   Total de faturas: ${stats.rows[0].total_faturas}`);
      console.log(`   Faturas com codgp: ${stats.rows[0].faturas_com_codgp}`);
      console.log(`   Faturas agrupadas (agp=S): ${stats.rows[0].faturas_agrupadas}`);
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('   1. Verifique se o PostgreSQL está rodando');
    console.log('   2. Verifique as credenciais no arquivo .env');
    console.log('   3. Verifique se o banco de dados existe');
    process.exit(1);
  }
}

verificarColunas();
