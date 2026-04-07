// Script para executar migração da tabela de histórico de NFe
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres'
});

const migrationSQL = `
-- Tabela para histórico de mudanças de status das NFes
CREATE TABLE IF NOT EXISTS dbnfe_ent_historico (
    id SERIAL PRIMARY KEY,
    codnfe_ent INTEGER NOT NULL,
    tipo_acao VARCHAR(50) NOT NULL,
    previous_status VARCHAR(1),
    new_status VARCHAR(1),
    user_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(200),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_historico_codnfe
    ON dbnfe_ent_historico(codnfe_ent);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_user
    ON dbnfe_ent_historico(user_id);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_tipo
    ON dbnfe_ent_historico(tipo_acao);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_created
    ON dbnfe_ent_historico(created_at);
`;

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Executando migração...');
    await client.query(migrationSQL);
    console.log('Migração executada com sucesso!');

    // Verificar se a tabela foi criada
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'dbnfe_ent_historico'
      ORDER BY ordinal_position
    `);

    console.log('\\nColunas da tabela dbnfe_ent_historico:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Erro na migração:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
