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
    console.log('\n=== ADICIONANDO CLIENTE', codcli, 'ÀS TABELAS DE KICKBACK ===\n');

    // 1. Adicionar na tabela cliente_kickback
    console.log('1. Adicionando na tabela cliente_kickback...');
    try {
      await client.query(`
        INSERT INTO cliente_kickback (codcli, class, status, g)
        VALUES ($1, 'A', 'A', 'S')
        ON CONFLICT (codcli) DO NOTHING
      `, [codcli]);
      console.log('   OK - Adicionado à cliente_kickback');
    } catch (e: any) {
      // Tenta inserção simples se ON CONFLICT não funcionar
      try {
        await client.query(`
          INSERT INTO cliente_kickback (codcli, class, status, g)
          VALUES ($1, 'A', 'A', 'S')
        `, [codcli]);
        console.log('   OK - Adicionado à cliente_kickback');
      } catch (e2: any) {
        if (e2.message.includes('duplicate') || e2.message.includes('already exists')) {
          console.log('   Já existe na tabela cliente_kickback');
        } else {
          console.log('   Erro:', e2.message);
        }
      }
    }

    // 2. Adicionar na tabela kickback (precisa de dados de faturamento fictício)
    console.log('\n2. Adicionando na tabela kickback...');
    try {
      await client.query(`
        INSERT INTO kickback (codfat, nroform, data, codcli, totalfat)
        VALUES ('TESTE001', '000001', NOW(), $1, 100.00)
        ON CONFLICT DO NOTHING
      `, [codcli]);
      console.log('   OK - Adicionado à kickback');
    } catch (e: any) {
      // Tenta inserção simples
      try {
        await client.query(`
          INSERT INTO kickback (codfat, nroform, data, codcli, totalfat)
          VALUES ('TESTE001', '000001', NOW(), $1, 100.00)
        `, [codcli]);
        console.log('   OK - Adicionado à kickback');
      } catch (e2: any) {
        if (e2.message.includes('duplicate') || e2.message.includes('already exists')) {
          console.log('   Já existe na tabela kickback');
        } else {
          console.log('   Erro:', e2.message);
        }
      }
    }

    // 3. Verificar
    console.log('\n3. Verificando...');

    const r1 = await client.query(
      `SELECT COUNT(*) as c FROM kickback WHERE codcli = $1`,
      [codcli]
    );
    console.log('   Tabela kickback:', r1.rows[0].c > 0 ? 'OK' : 'NÃO ENCONTRADO');

    const r2 = await client.query(
      `SELECT COUNT(*) as c FROM cliente_kickback WHERE codcli = $1`,
      [codcli]
    );
    console.log('   Tabela cliente_kickback:', r2.rows[0].c > 0 ? 'OK' : 'NÃO ENCONTRADO');

    // 4. Testar a query que a API usa
    console.log('\n4. Testando query da API...');
    const r3 = await client.query(`
      SELECT
        (
          EXISTS (SELECT 1 FROM kickback k WHERE k.codcli = $1)
          AND
          EXISTS (SELECT 1 FROM cliente_kickback ck WHERE ck.codcli = $1)
        ) AS kickback
    `, [codcli]);
    console.log('   Resultado kickback:', r3.rows[0].kickback ? 'TRUE ✓' : 'FALSE ✗');

    console.log('\n=== CONCLUÍDO ===');
    console.log('Agora selecione novamente o cliente 34902 na tela de venda');
    console.log('e busque o produto 119842 para testar o kickback.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
