const { Pool } = require('pg');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Todos os usuários com filiais e armazéns
  console.log('=== TODOS OS USUÁRIOS ===');
  const users = await pgClient.query(`SELECT login_user_login, login_perfil_name, codusr FROM db_manaus.tb_login_user ORDER BY login_user_login`);

  for (const u of users.rows) {
    const filiais = await pgClient.query(`SELECT nome_filial, codigo_filial FROM db_manaus.tb_login_filiais WHERE login_user_login = $1`, [u.login_user_login]);
    const arms = await pgClient.query(`SELECT id_armazem, login_perfil_name, codigo_filial FROM db_manaus.tb_login_armazem_user WHERE login_user_login = $1`, [u.login_user_login]);

    console.log(`\n${u.login_user_login} | perfil: ${u.login_perfil_name} | codusr: ${u.codusr}`);
    console.log(`  Filiais: ${filiais.rows.map(f => `${f.nome_filial}(${f.codigo_filial})`).join(', ') || 'NENHUMA'}`);
    console.log(`  Armazéns: ${arms.rows.map(a => `${a.id_armazem}(perfil:${a.login_perfil_name},filial:${a.codigo_filial})`).join(', ') || 'NENHUM'}`);
  }

  // Ver tb_login_armazem_perfil (armazéns por perfil)
  console.log('\n=== ARMAZÉNS POR PERFIL ===');
  const armPerfil = await pgClient.query(`SELECT * FROM db_manaus.tb_login_armazem_perfil ORDER BY login_perfil_name, id_armazem`);
  armPerfil.rows.forEach(r => console.log(r));

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
