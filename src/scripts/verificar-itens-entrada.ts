import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    // Procurar tabelas de itens de entrada
    const r1 = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%item%entrada%' OR table_name LIKE '%entrada%item%' OR table_name LIKE 'itens_%')
      ORDER BY table_name
    `);

    console.log('Tabelas de itens encontradas:');
    r1.rows.forEach(row => console.log('  -', row.table_name));

    // Verificar se existe itens_entrada_estoque ou similar
    const r2 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'itens_entrada_estoque'
      ORDER BY ordinal_position
    `);

    if (r2.rows.length > 0) {
      console.log('\n=== COLUNAS de itens_entrada_estoque ===');
      r2.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));

      // Exemplo de dados
      const r3 = await client.query(`
        SELECT * FROM itens_entrada_estoque LIMIT 2
      `);
      console.log('\n=== EXEMPLO DE DADOS ===');
      r3.rows.forEach((row, i) => console.log(`Registro ${i + 1}:`, JSON.stringify(row, null, 2)));
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
