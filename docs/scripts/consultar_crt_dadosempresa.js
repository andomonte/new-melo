import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarCRT() {
  try {
    console.log('Consultando campos relacionados a CRT/Regime Tributário na tabela dadosempresa...\n');

    // Consultar colunas que podem conter CRT ou regime tributário
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dadosempresa'
        AND (
          column_name ILIKE '%crt%' 
          OR column_name ILIKE '%regime%'
          OR column_name ILIKE '%tribut%'
          OR column_name ILIKE '%fiscal%'
        )
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log(`✅ Campos encontrados (${result.rows.length}):`);
      console.log('='.repeat(80));
      result.rows.forEach((row, index) => {
        const maxLength = row.character_maximum_length ? ` (${row.character_maximum_length})` : '';
        console.log(`${index + 1}. ${row.column_name} - ${row.data_type}${maxLength}`);
      });
    } else {
      console.log('❌ Nenhum campo relacionado a CRT/Regime Tributário encontrado');
      console.log('   Será necessário adicionar um campo para armazenar o CRT da empresa');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\nConsultando todas as colunas de dadosempresa:');
    console.log('='.repeat(80));

    const allColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dadosempresa'
      ORDER BY ordinal_position;
    `);

    console.log(`\nTotal de colunas: ${allColumns.rows.length}\n`);
    allColumns.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.column_name} (${row.data_type})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\nConsultando dados de exemplo:');
    console.log('='.repeat(80));

    const sample = await pool.query(`
      SELECT 
        cgc,
        nomecontribuinte,
        inscricaoestadual
      FROM db_manaus.dadosempresa 
      LIMIT 3;
    `);

    console.log(`\nPrimeiros ${sample.rows.length} registros:`);
    sample.rows.forEach((row, index) => {
      console.log(`\nEmpresa ${index + 1}:`);
      console.log(`  CNPJ: ${row.cgc}`);
      console.log(`  Nome: ${row.nomecontribuinte}`);
      console.log(`  IE: ${row.inscricaoestadual || '(não informado)'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 INFORMAÇÕES SOBRE CRT (Código de Regime Tributário):');
    console.log('='.repeat(80));
    console.log('\nValores possíveis:');
    console.log('  1 = Simples Nacional');
    console.log('  2 = Simples Nacional - excesso de sublimite de receita bruta');
    console.log('  3 = Regime Normal');
    console.log('\n⚠️  O CRT deve corresponder ao cadastro da empresa na SEFAZ!');
    console.log('    Caso contrário, a nota será rejeitada.\n');

  } catch (error) {
    console.error('Erro ao consultar dadosempresa:', error);
    console.error('Detalhes:', error.message);
  } finally {
    await pool.end();
  }
}

consultarCRT();
