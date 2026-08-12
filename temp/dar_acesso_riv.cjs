const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres', ssl: false, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  const exists = await client.query(`SELECT 1 FROM db_manaus.tb_login_access_perfil WHERE login_perfil_name = 'ADMINISTRAÇÃO' AND id_functions = 11`);
  if (exists.rows.length > 0) { console.log('⚠️ RIV já atribuída'); }
  else {
    await client.query(`INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions) VALUES ('ADMINISTRAÇÃO', 11)`);
    console.log('✅ RIV atribuída ao perfil ADMINISTRAÇÃO');
  }
  client.release(); await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
