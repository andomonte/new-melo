import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    // Procurar TODAS as tabelas que podem ter relação com compras/entradas
    const r1 = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (
          table_name LIKE '%item%'
          OR table_name LIKE '%compra%'
          OR table_name LIKE '%entrada%'
          OR table_name LIKE '%pedido%'
          OR table_name LIKE '%nf%'
        )
      ORDER BY table_name
    `);

    console.log('Tabelas encontradas:');
    r1.rows.forEach(row => console.log('  -', row.table_name));

    // Verificar se existe relação com entradas_estoque
    console.log('\n=== Verificando tabelas que referenciam entradas_estoque ===');

    const r2 = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'entradas_estoque'
    `);

    if (r2.rows.length > 0) {
      console.log('Tabelas que referenciam entradas_estoque:');
      r2.rows.forEach(row => console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`));
    } else {
      console.log('Nenhuma tabela referencia entradas_estoque via FK');
    }

    // Procurar por tabela com coluna entrada_id ou similar
    console.log('\n=== Tabelas com coluna entrada_id ou similar ===');
    const r3 = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name LIKE '%entrada%'
      ORDER BY table_name
    `);
    r3.rows.forEach(row => console.log(`  ${row.table_name}.${row.column_name}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
