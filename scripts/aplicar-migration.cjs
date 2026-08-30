// Aplica um arquivo de migrations/ no banco apontado por DATABASE_URL (.env).
//
//   node scripts/aplicar-migration.cjs migrations/048_financeiro_arquivos.sql
//   node scripts/aplicar-migration.cjs migrations/048_... db_rondonia   (só um schema)
//   node scripts/aplicar-migration.cjs migrations/048_... --dry-run     (roda e desfaz)
//
// O 2º argumento restringe o loop de schemas do DO block — útil para validar
// numa filial de teste antes de soltar em produção.
// --dry-run executa tudo dentro de uma transação e dá ROLLBACK no final: serve
// para conferir sintaxe e efeito sem gravar nada.

require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [arquivo, schema] = args.filter((a) => !a.startsWith('--'));

if (!arquivo) {
  console.error('Uso: node scripts/aplicar-migration.cjs <arquivo.sql> [schema] [--dry-run]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida (.env).');
  process.exit(1);
}

let sql = fs.readFileSync(arquivo, 'utf8');

if (schema) {
  const original = sql;
  sql = sql.replace(
    "WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\\_%'",
    `WHERE table_name = 'tb_telas' AND table_schema = '${schema}'`,
  );
  if (sql === original) {
    console.error(
      'Esta migration não tem o loop de schemas esperado — rode sem o argumento de schema.',
    );
    process.exit(1);
  }
  console.log(`>>> restrito ao schema ${schema}`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

(async () => {
  const client = await pool.connect();
  client.on('notice', (m) => console.log('  ' + m.message));

  try {
    if (dryRun) await client.query('BEGIN');
    await client.query(sql);

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n>>> DRY-RUN: rodou sem erros e foi desfeito (nada gravado).');
    } else {
      console.log('\nOK — migration aplicada.');
    }
  } catch (erro) {
    if (dryRun) await client.query('ROLLBACK').catch(() => {});
    console.error('\nERRO:', erro.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
