const { Pool } = require('pg');

async function main() {
  const pgPool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false, connectionTimeoutMillis: 10000,
  });
  const pgClient = await pgPool.connect();

  // 1. Adicionar filial MANAUS
  const existsFilial = await pgClient.query(
    `SELECT 1 FROM db_manaus.tb_login_filiais WHERE login_user_login = 'ROBSON.S'`
  );
  if (existsFilial.rows.length === 0) {
    await pgClient.query(
      `INSERT INTO db_manaus.tb_login_filiais (login_user_login, nome_filial, codigo_filial) VALUES ('ROBSON.S', 'MANAUS', 1)`
    );
    console.log('✅ Filial MANAUS atribuída');
  } else {
    console.log('⚠️ Filial já existe');
  }

  // 2. Ver armazéns disponíveis
  const armazens = await pgClient.query(`SELECT arm_id, arm_descricao FROM db_manaus.cad_armazem ORDER BY arm_id`);
  console.log('\nArmazéns disponíveis:');
  armazens.rows.forEach(r => console.log(`  ${r.arm_id} - ${r.arm_descricao}`));

  // 3. Ver quais armazéns KARLA tem (como referência)
  const karlaArm = await pgClient.query(
    `SELECT id_armazem, login_perfil_name, codigo_filial FROM db_manaus.tb_login_armazem_user WHERE login_user_login = 'KARLA'`
  );
  console.log('\nArmazéns da KARLA:', karlaArm.rows);

  // 4. Dar os mesmos armazéns ao ROBSON.S (com perfil VENDAS)
  for (const arm of karlaArm.rows) {
    const existsArm = await pgClient.query(
      `SELECT 1 FROM db_manaus.tb_login_armazem_user WHERE login_user_login = 'ROBSON.S' AND id_armazem = $1`,
      [arm.id_armazem]
    );
    if (existsArm.rows.length === 0) {
      await pgClient.query(
        `INSERT INTO db_manaus.tb_login_armazem_user (id_armazem, login_user_login, login_perfil_name, codigo_filial)
         VALUES ($1, 'ROBSON.S', 'VENDAS', $2)`,
        [arm.id_armazem, arm.codigo_filial]
      );
      console.log(`✅ Armazém ${arm.id_armazem} atribuído`);
    }
  }

  // 5. Confirmar
  console.log('\n=== CONFIGURAÇÃO FINAL ROBSON.S ===');
  const filiais = await pgClient.query(`SELECT * FROM db_manaus.tb_login_filiais WHERE login_user_login = 'ROBSON.S'`);
  console.log('Filiais:', filiais.rows);
  const arms = await pgClient.query(`SELECT * FROM db_manaus.tb_login_armazem_user WHERE login_user_login = 'ROBSON.S'`);
  console.log('Armazéns:', arms.rows);

  console.log('\n📋 Login: ROBSON.S | Senha: 999999 | Perfil: VENDAS | Filial: MANAUS');

  pgClient.release();
  await pgPool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
