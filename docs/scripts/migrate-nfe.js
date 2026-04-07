#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  let client;
  try {
    client = await pool.connect();
    
    const migrationPath = path.join(__dirname, '../prisma/migrations/add_nfe_workflow_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executando migração das tabelas NFe...');
    await client.query(sql);
    console.log('✅ Migração executada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration();