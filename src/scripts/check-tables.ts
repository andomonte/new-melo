import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();
  try {
    // Buscar tabelas que parecem ser de clientes
    const r = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name ILIKE '%cli%' OR table_name ILIKE '%client%')
      ORDER BY table_name
      LIMIT 20
    `);
    console.log('Tabelas de clientes encontradas:');
    r.rows.forEach(row => console.log('  -', row.table_name));

    // Verificar estrutura do dbprod para ver se tem cliente
    const r2 = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (column_name ILIKE '%codcli%' OR column_name ILIKE '%cliente%')
      LIMIT 30
    `);
    console.log('\nColunas com codcli/cliente:');
    r2.rows.forEach(row => console.log('  -', row.table_name + '.' + row.column_name));

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
