import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function consultarDbvenda() {
  try {
    console.log('Consultando estrutura da tabela dbvenda...\n');

    // Consultar colunas da tabela dbvenda
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbvenda'
      ORDER BY ordinal_position;
    `);

    console.log(`Total de colunas em dbvenda: ${result.rows.length}\n`);
    console.log('Colunas da tabela db_manaus.dbvenda:');
    console.log('='.repeat(80));
    
    result.rows.forEach((row, index) => {
      const maxLength = row.character_maximum_length ? ` (${row.character_maximum_length})` : '';
      console.log(`${index + 1}. ${row.column_name} - ${row.data_type}${maxLength}`);
    });

    // Verificar se existem os campos cnpj_empresa e ie_empresa
    console.log('\n' + '='.repeat(80));
    console.log('\nVerificando campos cnpj_empresa e ie_empresa:');
    console.log('='.repeat(80));

    const camposEmpresa = result.rows.filter(row => 
      row.column_name === 'cnpj_empresa' || row.column_name === 'ie_empresa'
    );

    if (camposEmpresa.length > 0) {
      console.log('\n✅ Campos encontrados:');
      camposEmpresa.forEach(campo => {
        console.log(`   - ${campo.column_name} (${campo.data_type})`);
      });
    } else {
      console.log('\n❌ Campos cnpj_empresa e ie_empresa NÃO foram encontrados em dbvenda');
      console.log('   Esses campos precisam ser criados para referenciar a empresa correta.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\nConsultando alguns registros de exemplo:');
    console.log('='.repeat(80));

    const sample = await pool.query(`
      SELECT 
        codvenda, 
        data, 
        codcli, 
        total,
        cnpj_empresa,
        ie_empresa
      FROM db_manaus.dbvenda 
      LIMIT 5;
    `);

    console.log(`\nPrimeiros ${sample.rows.length} registros:`);
    sample.rows.forEach((row, index) => {
      console.log(`\nRegistro ${index + 1}:`);
      console.log(`  codvenda: ${row.codvenda}`);
      console.log(`  data: ${row.data}`);
      console.log(`  codcli: ${row.codcli}`);
      console.log(`  total: ${row.total}`);
      console.log(`  cnpj_empresa: ${row.cnpj_empresa || '(vazio)'}`);
      console.log(`  ie_empresa: ${row.ie_empresa || '(vazio)'}`);
    });

    // Verificar vendas com cnpj_empresa preenchido
    console.log('\n' + '='.repeat(80));
    console.log('\nVendas com cnpj_empresa preenchido:');
    console.log('='.repeat(80));

    const vendaComEmpresa = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(cnpj_empresa) as com_cnpj,
        COUNT(ie_empresa) as com_ie
      FROM db_manaus.dbvenda;
    `);

    if (vendaComEmpresa.rows.length > 0) {
      const stats = vendaComEmpresa.rows[0];
      console.log(`\n📊 Estatísticas:`);
      console.log(`   Total de vendas: ${stats.total}`);
      console.log(`   Com cnpj_empresa: ${stats.com_cnpj}`);
      console.log(`   Com ie_empresa: ${stats.com_ie}`);
    }

  } catch (error) {
    console.error('Erro ao consultar dbvenda:', error);
    console.error('Detalhes:', error.message);
  } finally {
    await pool.end();
  }
}

consultarDbvenda();
