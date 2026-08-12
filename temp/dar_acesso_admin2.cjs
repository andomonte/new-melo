const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  // Dar acesso BPV, PVO, VDM ao perfil ADMINISTRAÇÃO
  const novasFuncoes = [20, 21, 22];
  const perfil = 'ADMINISTRAÇÃO';

  for (const idFunc of novasFuncoes) {
    const exists = await client.query(
      `SELECT 1 FROM db_manaus.tb_login_access_perfil WHERE login_perfil_name = $1 AND id_functions = $2`,
      [perfil, idFunc]
    );
    if (exists.rows.length > 0) {
      console.log(`⚠️  id_functions=${idFunc} já atribuída a ${perfil}`);
      continue;
    }
    await client.query(
      `INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions) VALUES ($1, $2)`,
      [perfil, idFunc]
    );
    const func = await client.query(`SELECT sigla FROM db_manaus.tb_login_functions WHERE id_functions = $1`, [idFunc]);
    console.log(`✅ ${func.rows[0]?.sigla} (id ${idFunc}) atribuída ao perfil ${perfil}`);
  }

  // Limpar o insert errado com 'administrador' (que não existe como perfil)
  await client.query(`DELETE FROM db_manaus.tb_login_access_perfil WHERE login_perfil_name = 'administrador'`);
  console.log('🧹 Limpou registros do perfil "administrador" inexistente');

  // Confirmar
  console.log(`\n=== FUNÇÕES DE ${perfil} ===`);
  const funcs = await client.query(`
    SELECT ap.id_functions, f.sigla, f.descricao
    FROM db_manaus.tb_login_access_perfil ap
    JOIN db_manaus.tb_login_functions f ON f.id_functions = ap.id_functions
    WHERE ap.login_perfil_name = $1
    ORDER BY ap.id_functions
  `, [perfil]);
  funcs.rows.forEach(r => console.log(r));

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
