/**
 * Migração DBPEND: Oracle → PostgreSQL (db_manaus)
 *
 * Copia todos os 39.601 registros da tabela DBPEND do Oracle
 * para a tabela db_manaus.dbpend no PostgreSQL.
 *
 * A tabela no PG já existe com estrutura: codvenda(varchar9), codprod(varchar50), qtd(numeric)
 */
const oracledb = require('oracledb');
const { Pool } = require('pg');

const BATCH_SIZE = 1000;

async function main() {
  // --- Oracle ---
  try {
    oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient\\instantclient_23_4' });
  } catch (e) {
    if (!e.message.includes('already')) throw e;
  }

  const oraConn = await oracledb.getConnection({
    user: 'GERAL',
    password: '123',
    connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
  });

  // --- PostgreSQL ---
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 15000,
  });
  const pgClient = await pgPool.connect();

  try {
    // 1. Contar registros no Oracle
    const countResult = await oraConn.execute('SELECT COUNT(*) FROM DBPEND');
    const totalOracle = countResult.rows[0][0];
    console.log(`Oracle DBPEND: ${totalOracle} registros`);

    // 2. Verificar PG atual
    const pgCount = await pgClient.query('SELECT COUNT(*) FROM db_manaus.dbpend');
    console.log(`PostgreSQL dbpend antes: ${pgCount.rows[0].count} registros`);

    if (parseInt(pgCount.rows[0].count) > 0) {
      console.log('⚠️  Tabela PG já tem dados. Limpando antes de migrar...');
      await pgClient.query('DELETE FROM db_manaus.dbpend');
    }

    // 3. Buscar todos do Oracle
    console.log('Buscando dados do Oracle...');
    const oraResult = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    const data = await oraConn.execute(
      'SELECT CODVENDA, CODPROD, NVL(QTD, 0) AS QTD FROM DBPEND ORDER BY CODVENDA',
      [],
      { resultSet: false, fetchArraySize: 5000 }
    );

    const rows = data.rows;
    console.log(`Lidos ${rows.length} registros do Oracle`);

    // 4. Inserir em lotes no PostgreSQL
    let inserted = 0;
    await pgClient.query('BEGIN');

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((row, idx) => {
        const offset = idx * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(row[0], row[1], row[2]);
      });

      await pgClient.query(
        `INSERT INTO db_manaus.dbpend (codvenda, codprod, qtd) VALUES ${placeholders.join(', ')}`,
        values
      );

      inserted += batch.length;
      process.stdout.write(`\r  Inseridos: ${inserted}/${rows.length}`);
    }

    await pgClient.query('COMMIT');
    console.log(`\n✅ Migração concluída: ${inserted} registros inseridos no PostgreSQL`);

    // 5. Validação final
    const pgCountFinal = await pgClient.query('SELECT COUNT(*) FROM db_manaus.dbpend');
    console.log(`PostgreSQL dbpend depois: ${pgCountFinal.rows[0].count} registros`);

    if (parseInt(pgCountFinal.rows[0].count) === totalOracle) {
      console.log('✅ Contagem confere: Oracle e PostgreSQL iguais');
    } else {
      console.log(`⚠️  Divergência: Oracle=${totalOracle}, PG=${pgCountFinal.rows[0].count}`);
    }

    // 6. Amostra de verificação
    const sample = await pgClient.query(`
      SELECT p.codvenda, v.data, p.codprod, p.qtd
      FROM db_manaus.dbpend p
      LEFT JOIN db_manaus.dbvenda v ON v.codvenda = p.codvenda
      ORDER BY v.data DESC NULLS LAST
      LIMIT 5
    `);
    console.log('\nÚltimas 5 pendências migradas:');
    sample.rows.forEach(r => console.log(`  ${r.codvenda} | ${r.data ? new Date(r.data).toISOString().split('T')[0] : 'sem data'} | ${r.codprod} | qtd: ${r.qtd}`));

  } catch (err) {
    await pgClient.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    pgClient.release();
    await pgPool.end();
    await oraConn.close();
  }
}

main().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
