const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres', ssl: false, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();

  // Ver todos os perfis que têm VDM
  console.log('=== PERFIS COM VDM (id 22) ===');
  const r = await client.query(`SELECT login_perfil_name FROM db_manaus.tb_login_access_perfil WHERE id_functions = 22`);
  r.rows.forEach(r => console.log(r));

  // Ver todos os perfis e suas funções de venda
  console.log('\n=== TODOS PERFIS E FUNÇÕES DE VENDA ===');
  const r2 = await client.query(`
    SELECT ap.login_perfil_name, f.sigla, f.descricao
    FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE f.sigla IN ('VDM','BPV','MPV','EV','RIV','TMO','PVO','DBV')
    ORDER BY ap.login_perfil_name, f.sigla
  `);
  r2.rows.forEach(r => console.log(`${r.login_perfil_name} → ${r.sigla}`));

  client.release(); await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
