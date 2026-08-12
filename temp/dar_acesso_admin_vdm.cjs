const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  // 1. Ver perfis existentes
  console.log('=== PERFIS EXISTENTES ===');
  const perfis = await client.query(`
    SELECT DISTINCT login_perfil_name FROM db_manaus.tb_login_access_perfil ORDER BY login_perfil_name
  `);
  perfis.rows.forEach(r => console.log(r));

  // 2. Ver o que o admin já tem
  console.log('\n=== FUNÇÕES DO ADMIN ===');
  const adminFuncs = await client.query(`
    SELECT ap.id_functions, f.sigla, f.descricao
    FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE ap.login_perfil_name = 'administrador'
    ORDER BY ap.id_functions
  `);
  adminFuncs.rows.forEach(r => console.log(r));

  // 3. Dar acesso VDM (id 22), BPV (id 20), PVO (id 21) ao admin
  const novasFuncoes = [20, 21, 22]; // BPV, PVO, VDM
  for (const idFunc of novasFuncoes) {
    const exists = await client.query(
      `SELECT 1 FROM db_manaus.tb_login_access_perfil WHERE login_perfil_name = 'administrador' AND id_functions = $1`,
      [idFunc]
    );
    if (exists.rows.length > 0) {
      console.log(`⚠️  id_functions=${idFunc} já atribuída ao admin`);
      continue;
    }
    await client.query(
      `INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions) VALUES ('administrador', $1)`,
      [idFunc]
    );
    const func = await client.query(`SELECT sigla FROM db_manaus.tb_login_functions WHERE id_functions = $1`, [idFunc]);
    console.log(`✅ ${func.rows[0]?.sigla} (id ${idFunc}) atribuída ao perfil administrador`);
  }

  // 4. Confirmar
  console.log('\n=== FUNÇÕES DO ADMIN ATUALIZADAS ===');
  const adminFuncs2 = await client.query(`
    SELECT ap.id_functions, f.sigla, f.descricao
    FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE ap.login_perfil_name = 'administrador'
    ORDER BY ap.id_functions
  `);
  adminFuncs2.rows.forEach(r => console.log(r));

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
