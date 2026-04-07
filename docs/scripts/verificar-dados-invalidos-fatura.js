const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verificarDadosInvalidos() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando registros com dados inválidos...\n');
    
    // Verificar registros problemáticos
    const problematicos = await client.query(`
      SELECT codfat, codcli, nroform, selo, data
      FROM db_manaus.dbfatura 
      WHERE codfat LIKE '%,%' 
         OR nroform LIKE '%,%' 
         OR selo LIKE '%,%'
         OR codfat !~ '^[0-9]+$'
         OR (nroform IS NOT NULL AND nroform !~ '^[0-9]+$')
         OR (selo IS NOT NULL AND selo !~ '^[0-9]+$')
      LIMIT 10
    `);
    
    if (problematicos.rows.length > 0) {
      console.log('❌ Registros problemáticos encontrados:');
      console.table(problematicos.rows);
    } else {
      console.log('✅ Nenhum registro problemático encontrado!');
    }
    
    // Contar quantos problemáticos existem
    const contagem = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE codfat LIKE '%,%' OR codfat !~ '^[0-9]+$') as codfat_invalidos,
        COUNT(*) FILTER (WHERE nroform LIKE '%,%' OR (nroform IS NOT NULL AND nroform !~ '^[0-9]+$')) as nroform_invalidos,
        COUNT(*) FILTER (WHERE selo LIKE '%,%' OR (selo IS NOT NULL AND selo !~ '^[0-9]+$')) as selo_invalidos,
        COUNT(*) as total_registros
      FROM db_manaus.dbfatura
    `);
    
    console.log('\n📊 Resumo:');
    console.log(`Total de registros: ${contagem.rows[0].total_registros}`);
    console.log(`Codfat inválidos: ${contagem.rows[0].codfat_invalidos}`);
    console.log(`Nroform inválidos: ${contagem.rows[0].nroform_invalidos}`);
    console.log(`Selo inválidos: ${contagem.rows[0].selo_invalidos}`);
    
    // Perguntar se deseja corrigir
    if (contagem.rows[0].codfat_invalidos > 0 || 
        contagem.rows[0].nroform_invalidos > 0 || 
        contagem.rows[0].selo_invalidos > 0) {
      console.log('\n⚠️  ATENÇÃO: Encontrados registros inválidos!');
      console.log('Para corrigir, descomente as queries UPDATE no arquivo limpar-dados-invalidos-fatura.sql');
      console.log('e execute-o manualmente ou ajuste este script.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarDadosInvalidos();
