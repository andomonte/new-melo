import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();

  try {
    console.log('\n=== ESTRUTURA DA TABELA entrada_itens ===\n');

    const r1 = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'entrada_itens'
      ORDER BY ordinal_position
    `);

    console.log('Colunas:');
    r1.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Exemplo de dados
    console.log('\n=== EXEMPLO DE DADOS ===\n');
    const r2 = await client.query(`
      SELECT ei.*, ee.status as entrada_status, ee.data_entrada
      FROM entrada_itens ei
      JOIN entradas_estoque ee ON ei.entrada_id = ee.id
      LIMIT 3
    `);

    r2.rows.forEach((row, i) => {
      console.log(`Registro ${i + 1}:`, JSON.stringify(row, null, 2));
    });

    // Ver se tem previsão de chegada
    console.log('\n=== STATUS POSSÍVEIS ===\n');
    const r3 = await client.query(`
      SELECT DISTINCT status FROM entradas_estoque
    `);
    console.log('Status de entradas:', r3.rows.map(r => r.status).join(', '));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
