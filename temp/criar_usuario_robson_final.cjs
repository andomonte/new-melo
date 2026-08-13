const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // Verificar se já existe
  const exists = await pgClient.query(`SELECT login_user_login FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON.S'`);
  if (exists.rows.length > 0) {
    console.log('⚠️ ROBSON.S já existe no PG');
    pgClient.release(); await pgPool.end();
    return;
  }

  // Hash da senha (999999 do Oracle)
  const senhaHash = await bcrypt.hash('999999', 10);

  // Criar usuário — perfil VENDAS (equivalente ao que ele tem no Oracle)
  await pgClient.query(`
    INSERT INTO db_manaus.tb_login_user
      (login_user_login, login_user_password, login_user_name, login_perfil_name, login_group_name, codusr, stusr, bloqueado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, ['ROBSON.S', senhaHash, 'ROBSON.S', 'VENDAS', 'VENDAS', 473, 'N', 'N']);
  console.log('✅ Usuário ROBSON.S criado no PG');

  // Dar funções equivalentes ao que ele tem no Oracle
  // Oracle: VEN_NV=S, VEN_DEM=S, VEN_DESB=S, FAT_NV=S, etc
  // Mapear para siglas do Next.js:
  // EV (Escolher Vendedor) - ele é vendedor
  // VDM (Não gerar demanda) - VEN_DEM=S
  // DBV (Desbloquear venda) - VEN_DESB=S
  // CRIAR_VENDAS - VEN_NV=S
  const funcoesParaUsuario = [1, 6, 18, 22]; // EV, CRIAR_VENDAS, DBV, VDM

  for (const idFunc of funcoesParaUsuario) {
    const existsFunc = await pgClient.query(
      `SELECT 1 FROM db_manaus.tb_login_access_user WHERE login_user_login = 'ROBSON.S' AND id_functions = $1`, [idFunc]
    );
    if (existsFunc.rows.length === 0) {
      await pgClient.query(
        `INSERT INTO db_manaus.tb_login_access_user (login_user_login, id_functions) VALUES ('ROBSON.S', $1)`, [idFunc]
      );
      const func = await pgClient.query(`SELECT sigla FROM db_manaus.tb_login_functions WHERE id_functions = $1`, [idFunc]);
      console.log(`  ✅ Função ${func.rows[0]?.sigla} (id ${idFunc}) atribuída`);
    }
  }

  // Confirmar
  console.log('\n=== USUÁRIO CRIADO ===');
  const user = await pgClient.query(`SELECT * FROM db_manaus.tb_login_user WHERE login_user_login = 'ROBSON.S'`);
  console.log(user.rows[0]);

  console.log('\n=== FUNÇÕES DO USUÁRIO ===');
  const funcs = await pgClient.query(`
    SELECT f.sigla, f.descricao FROM db_manaus.tb_login_access_user au
    JOIN db_manaus.tb_login_functions f ON f.id_functions = au.id_functions
    WHERE au.login_user_login = 'ROBSON.S' ORDER BY f.sigla
  `);
  funcs.rows.forEach(r => console.log(`  ${r.sigla} - ${r.descricao}`));

  console.log('\n=== FUNÇÕES DO PERFIL VENDAS (herdadas) ===');
  const perfilFuncs = await pgClient.query(`
    SELECT f.sigla, f.descricao FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE ap.login_perfil_name = 'VENDAS' ORDER BY f.sigla
  `);
  perfilFuncs.rows.forEach(r => console.log(`  ${r.sigla} - ${r.descricao}`));

  console.log('\n📋 Login: ROBSON.S | Senha: 999999 | Perfil: VENDAS');

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
