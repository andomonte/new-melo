const { Pool } = require('pg');

const pool = new Pool({
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
});

async function addFields() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO db_manaus');

    // Check if fields already exist
    const checkResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbnfe_ent'
      AND column_name IN ('processando_por', 'processando_desde', 'processando_nome')
    `);

    const existingFields = checkResult.rows.map(r => r.column_name);
    console.log('Campos existentes:', existingFields);

    // Add processando_por if not exists
    if (!existingFields.includes('processando_por')) {
      await client.query(`
        ALTER TABLE dbnfe_ent ADD COLUMN processando_por VARCHAR(10) DEFAULT NULL
      `);
      console.log('Campo processando_por adicionado');
    } else {
      console.log('Campo processando_por ja existe');
    }

    // Add processando_desde if not exists
    if (!existingFields.includes('processando_desde')) {
      await client.query(`
        ALTER TABLE dbnfe_ent ADD COLUMN processando_desde TIMESTAMP DEFAULT NULL
      `);
      console.log('Campo processando_desde adicionado');
    } else {
      console.log('Campo processando_desde ja existe');
    }

    // Add processando_nome if not exists (para mostrar nome do usuario)
    if (!existingFields.includes('processando_nome')) {
      await client.query(`
        ALTER TABLE dbnfe_ent ADD COLUMN processando_nome VARCHAR(100) DEFAULT NULL
      `);
      console.log('Campo processando_nome adicionado');
    } else {
      console.log('Campo processando_nome ja existe');
    }

    // Add index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dbnfe_ent_processando ON dbnfe_ent(processando_por) WHERE processando_por IS NOT NULL
    `);
    console.log('Indice criado/verificado');

    console.log('\nCampos adicionados com sucesso!');

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addFields();
