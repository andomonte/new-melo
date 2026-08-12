const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  // Pegar o próximo ID
  const maxId = await client.query(`SELECT COALESCE(MAX(id_functions), 0) + 1 as next_id FROM db_manaus.tb_login_functions`);
  let nextId = maxId.rows[0].next_id;

  const funcoesFaltantes = [
    { sigla: 'BPV', descricao: 'BLOQUEIO PREÇO VENDA', usadoEm: 'Vendas' },
    { sigla: 'PVO', descricao: 'PERMISSÃO VENDA OPERADOR', usadoEm: 'Vendas' },
    { sigla: 'VDM', descricao: 'OPTAR POR NÃO GERAR DEMANDA', usadoEm: 'Vendas' },
  ];

  for (const f of funcoesFaltantes) {
    // Verificar se já existe
    const exists = await client.query(
      `SELECT 1 FROM db_manaus.tb_login_functions WHERE sigla = $1`,
      [f.sigla]
    );
    if (exists.rows.length > 0) {
      console.log(`⚠️  ${f.sigla} já existe, pulando.`);
      continue;
    }

    await client.query(
      `INSERT INTO db_manaus.tb_login_functions (id_functions, descricao, codigo_filial, sigla, "usadoEm")
       VALUES ($1, $2, $1, $3, $4)`,
      [nextId, f.descricao, f.sigla, f.usadoEm]
    );
    console.log(`✅ Criada: ${f.sigla} — ${f.descricao} (id: ${nextId})`);
    nextId++;
  }

  // Confirmar
  console.log('\n=== FUNÇÕES ATUAIS ===');
  const all = await client.query(`SELECT id_functions, sigla, descricao, "usadoEm" FROM db_manaus.tb_login_functions ORDER BY id_functions`);
  all.rows.forEach(r => console.log(`  ${r.id_functions} | ${r.sigla} | ${r.descricao} | ${r.usadoEm}`));

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
