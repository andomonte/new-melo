import oracledb from 'oracledb';

async function getProcSource(procName) {
  let connection;
  try {
    try { oracledb.initOracleClient(); } catch(e) { /* ignore */ }
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    const config = { user: 'GERAL', password: '123', connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br' };
    connection = await oracledb.getConnection(config);
    console.log(`Connected. Fetching source for: ${procName}...\n`);

    const result = await connection.execute(`
      SELECT LINE, TEXT
      FROM USER_SOURCE
      WHERE NAME = :name
      ORDER BY LINE
    `, [procName]);

    if (result.rows.length === 0) {
      console.log('No source found for', procName);
      return;
    }

    result.rows.forEach(row => {
      const ln = String(row.LINE).padStart(4, ' ');
      console.log(`${ln}: ${row.TEXT}`);
    });

  } catch (err) {
    console.error('Error fetching source:', err);
  } finally {
    if (connection) await connection.close();
  }
}

const proc = process.argv[2] || 'CONTASR_BAIXA';
getProcSource(proc).then(()=>process.exit(0)).catch(()=>process.exit(1));
