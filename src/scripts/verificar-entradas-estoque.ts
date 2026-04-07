import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    console.log('\n=== ESTRUTURA DA TABELA entradas_estoque ===\n');

    // 1. Ver colunas da tabela
    const r1 = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'entradas_estoque'
      ORDER BY ordinal_position
    `);

    if (r1.rows.length === 0) {
      console.log('Tabela entradas_estoque NÃO encontrada!');

      // Procurar tabelas similares
      const r2 = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE '%entrada%' OR table_name LIKE '%estoque%' OR table_name LIKE '%compra%' OR table_name LIKE '%pedido%')
        ORDER BY table_name
      `);

      console.log('\nTabelas similares encontradas:');
      r2.rows.forEach(row => console.log('  -', row.table_name));
    } else {
      console.log('Colunas:');
      r1.rows.forEach(row => {
        console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });

      // 2. Ver exemplo de dados
      console.log('\n=== EXEMPLO DE DADOS ===\n');
      const r3 = await client.query(`
        SELECT * FROM entradas_estoque LIMIT 3
      `);

      if (r3.rows.length > 0) {
        r3.rows.forEach((row, i) => {
          console.log(`Registro ${i + 1}:`, JSON.stringify(row, null, 2));
        });
      } else {
        console.log('Tabela vazia');
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
