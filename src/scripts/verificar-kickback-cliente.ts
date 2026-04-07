import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL_MANAUS || process.env.DATABASE_URL_DEFAULT;
const pool = new Pool({ connectionString: dbUrl, max: 2 });

async function main() {
  const client = await pool.connect();
  const codcli = '34902';

  try {
    console.log('\n=== VERIFICANDO KICKBACK DO CLIENTE', codcli, '===\n');

    // 1. Verificar campo kickback na tabela dbclien
    const r1 = await client.query(
      `SELECT codcli, nome, kickback FROM dbclien WHERE codcli = $1`,
      [codcli]
    );
    console.log('1. Campo kickback em dbclien:');
    if (r1.rows.length > 0) {
      console.log('   kickback =', r1.rows[0].kickback);
    } else {
      console.log('   Cliente não encontrado!');
    }

    // 2. Verificar tabela kickback
    console.log('\n2. Tabela kickback:');
    try {
      const r2 = await client.query(
        `SELECT * FROM kickback WHERE codcli = $1 LIMIT 1`,
        [codcli]
      );
      if (r2.rows.length > 0) {
        console.log('   Encontrado:', JSON.stringify(r2.rows[0]));
      } else {
        console.log('   Cliente NÃO está na tabela kickback');
      }
    } catch (e: any) {
      console.log('   Erro ao consultar tabela kickback:', e.message);
    }

    // 3. Verificar tabela cliente_kickback
    console.log('\n3. Tabela cliente_kickback:');
    try {
      const r3 = await client.query(
        `SELECT * FROM cliente_kickback WHERE codcli = $1 LIMIT 1`,
        [codcli]
      );
      if (r3.rows.length > 0) {
        console.log('   Encontrado:', JSON.stringify(r3.rows[0]));
      } else {
        console.log('   Cliente NÃO está na tabela cliente_kickback');
      }
    } catch (e: any) {
      console.log('   Erro ao consultar tabela cliente_kickback:', e.message);
    }

    // 4. Ver estrutura das tabelas
    console.log('\n4. Estrutura das tabelas de kickback:');

    try {
      const r4 = await client.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name IN ('kickback', 'cliente_kickback')
        ORDER BY table_name, ordinal_position
      `);
      console.log('\n   Colunas encontradas:');
      for (const row of r4.rows) {
        console.log(`   ${row.table_name}.${row.column_name} (${row.data_type})`);
      }
    } catch (e: any) {
      console.log('   Erro:', e.message);
    }

    // 5. Verificar se existem registros nessas tabelas
    console.log('\n5. Contagem de registros:');
    try {
      const count1 = await client.query(`SELECT COUNT(*) FROM kickback`);
      console.log('   Tabela kickback:', count1.rows[0].count, 'registros');
    } catch (e: any) {
      console.log('   Tabela kickback: ERRO -', e.message);
    }

    try {
      const count2 = await client.query(`SELECT COUNT(*) FROM cliente_kickback`);
      console.log('   Tabela cliente_kickback:', count2.rows[0].count, 'registros');
    } catch (e: any) {
      console.log('   Tabela cliente_kickback: ERRO -', e.message);
    }

    // 6. Exemplo de clientes nessas tabelas
    console.log('\n6. Exemplo de clientes com kickback (nas duas tabelas):');
    try {
      const r6 = await client.query(`
        SELECT DISTINCT k.codcli
        FROM kickback k
        WHERE EXISTS (SELECT 1 FROM cliente_kickback ck WHERE ck.codcli = k.codcli)
        LIMIT 5
      `);
      if (r6.rows.length > 0) {
        console.log('   Clientes:', r6.rows.map(r => r.codcli).join(', '));
      } else {
        console.log('   Nenhum cliente encontrado nas duas tabelas');
      }
    } catch (e: any) {
      console.log('   Erro:', e.message);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
