import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();
  try {
    // Ver estrutura da tabela dbclien
    const r = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'dbclien'
      ORDER BY ordinal_position
    `);
    console.log('Colunas da tabela dbclien:');
    r.rows.forEach(row => console.log('  -', row.column_name, '(' + row.data_type + ')'));

    // Buscar um cliente exemplo
    const r2 = await client.query(`
      SELECT * FROM dbclien LIMIT 1
    `);
    if (r2.rows.length > 0) {
      console.log('\nExemplo de cliente:');
      console.log(JSON.stringify(r2.rows[0], null, 2));
    }

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
