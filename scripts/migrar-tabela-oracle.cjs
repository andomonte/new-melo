// Copia uma janela de dados de uma tabela do Oracle para o mesmo nome de tabela
// num schema do Postgres — para popular a base de teste com histórico real.
//
// Só copia as colunas que existem nos DOIS lados (as bases divergiram ao longo
// do tempo), e só a janela de datas pedida. Idempotente: apaga a mesma janela no
// destino antes de inserir.
//
// Uso:
//   node scripts/migrar-tabela-oracle.cjs --tabela=dbfatura --coluna-data=data --meses=24
//   node scripts/migrar-tabela-oracle.cjs --tabela=dbfatura --coluna-data=data --meses=24 --dry-run
//   node scripts/migrar-tabela-oracle.cjs --tabela=dbfatura --coluna-data=data --meses=24 --schema=db_manaus
//   node scripts/migrar-tabela-oracle.cjs --tabela=dbusuario --destino=dbusuario_delphi --sem-data
//
// Conflito de chave: por padrão o que já existe no destino é PRESERVADO
// (ON CONFLICT DO NOTHING na PK) — as linhas criadas pelo próprio web ficam
// intactas e só entra o que falta. Use --substituir para o contrário (apaga a
// janela antes de carregar). Rode --dry-run primeiro.

const oracledb = require('oracledb');
const { Client } = require('pg');
require('dotenv').config();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }),
);

const TABELA = String(args.tabela || '').toLowerCase();
// Quando o destino tem outro nome (ex.: DBUSUARIO -> dbusuario_delphi, que é
// espelho de leitura e não pode se misturar com a tabela em uso).
const DESTINO = String(args.destino || args.tabela || '').toLowerCase();
const COLUNA_DATA = String(args['coluna-data'] || 'data').toLowerCase();
const MESES = Number(args.meses || 24);
const SCHEMA = String(args.schema || 'db_manaus');
const DRY = !!args['dry-run'];
const SUBSTITUIR = !!args.substituir;
// Tabelas de apoio (vendedor, conta, transportadora...) não têm data: vêm
// inteiras, só o que falta.
const SEM_DATA = !!args['sem-data'];
const LOTE = Number(args.lote || 1000);

if (!TABELA) {
  console.error('Informe --tabela=<nome>. Ex.: --tabela=dbfatura --coluna-data=data --meses=24');
  process.exit(1);
}

const ORACLE = {
  user: 'GERAL',
  password: '123',
  connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br',
};

for (const dir of ['C:/oracle/instantclient/instantclient_23_4', 'C:/instantclient_12_2']) {
  try { oracledb.initOracleClient({ libDir: dir }); break; } catch { /* tenta o próximo */ }
}

(async () => {
  const ora = await oracledb.getConnection(ORACLE);
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query(`SET search_path TO ${SCHEMA}, public`);

  // Colunas dos dois lados → usa só a interseção.
  const { rows: colsOra } = await ora.execute(
    `SELECT LOWER(column_name) FROM all_tab_columns WHERE owner='GERAL' AND table_name=:t`,
    [TABELA.toUpperCase()],
  );
  const setOra = new Set(colsOra.map((r) => r[0]));
  const { rows: colsPg } = await pg.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
    [SCHEMA, DESTINO],
  );
  if (!colsPg.length) throw new Error(`${SCHEMA}.${DESTINO} não existe no Postgres`);

  const comuns = colsPg.map((r) => r.column_name).filter((c) => setOra.has(c.toLowerCase()));
  const soPg = colsPg.map((r) => r.column_name).filter((c) => !setOra.has(c.toLowerCase()));
  const soOra = [...setOra].filter((c) => !colsPg.some((r) => r.column_name.toLowerCase() === c));

  console.log(`tabela : ${TABELA}` + (DESTINO !== TABELA ? ` -> ${DESTINO}` : '') +
    `  (Oracle ${setOra.size} colunas | Postgres ${colsPg.length})`);
  console.log(`comuns : ${comuns.length}`);
  if (soPg.length) console.log(`só no Postgres (ficam nulas): ${soPg.join(', ')}`);
  if (soOra.length) console.log(`só no Oracle (ignoradas)   : ${soOra.join(', ')}`);
  if (!SEM_DATA && !setOra.has(COLUNA_DATA)) {
    throw new Error(`coluna de data "${COLUNA_DATA}" não existe no Oracle (use --sem-data para a tabela inteira)`);
  }

  const whereOra = SEM_DATA ? '1=1' : `${COLUNA_DATA} >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES})`;
  const wherePg = SEM_DATA ? '1=1' : `${COLUNA_DATA} >= (CURRENT_DATE - INTERVAL '${MESES} months')`;

  const { rows: [[total]] } = await ora.execute(
    `SELECT COUNT(*) FROM GERAL.${TABELA} WHERE ${whereOra}`,
  );
  const atual = await pg.query(`SELECT COUNT(*) n FROM ${DESTINO} WHERE ${wherePg}`);
  console.log(`janela : ${SEM_DATA ? 'tabela inteira' : `últimos ${MESES} meses`}`);
  console.log(`origem : ${Number(total).toLocaleString('pt-BR')} linha(s)`);
  console.log(`destino: ${Number(atual.rows[0].n).toLocaleString('pt-BR')} linha(s) na mesma janela` +
    (SUBSTITUIR ? ' (SERÃO APAGADAS — --substituir)' : ' (preservadas; só entra o que falta)'));

  // Chave primária do destino: é por ela que o conflito é resolvido.
  const { rows: pk } = await pg.query(
    `SELECT a.attname FROM pg_constraint c
       JOIN pg_class r ON r.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = r.relnamespace
       JOIN unnest(c.conkey) k(attnum) ON TRUE
       JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = k.attnum
     WHERE n.nspname = $1 AND r.relname = $2 AND c.contype = 'p'`,
    [SCHEMA, DESTINO],
  );
  const chave = pk.map((r) => `"${r.attname}"`).join(', ');
  if (!SUBSTITUIR && !chave) {
    throw new Error(`${DESTINO} não tem chave primária — rode com --substituir.`);
  }
  if (chave) console.log(`chave  : ${chave}`);

  if (DRY) { console.log('\n--dry-run: nada gravado.'); await ora.close(); await pg.end(); return; }
  if (!total) { console.log('nada a migrar.'); await ora.close(); await pg.end(); return; }

  if (SUBSTITUIR) {
    const del = await pg.query(`DELETE FROM ${DESTINO} WHERE ${wherePg}`);
    if (del.rowCount) console.log(`removidas ${del.rowCount.toLocaleString('pt-BR')} linha(s) da janela`);
  }

  const listaOra = comuns.map((c) => `"${c.toUpperCase()}"`).join(', ');
  const cursor = await ora.execute(
    `SELECT ${listaOra} FROM GERAL.${TABELA} WHERE ${whereOra}` +
      (SEM_DATA ? '' : ` ORDER BY ${COLUNA_DATA}`),
    [],
    { resultSet: true, fetchArraySize: LOTE },
  );
  const rs = cursor.resultSet;
  const listaPg = comuns.map((c) => `"${c}"`).join(', ');

  let gravadas = 0;
  let lidas = 0;
  const t0 = Date.now();
  // O protocolo do Postgres só aceita 65.535 parâmetros por comando, então o
  // tamanho do INSERT depende da largura da tabela (com 75 colunas, 1.000
  // linhas dariam 75.000 e o contador estoura silenciosamente).
  const POR_INSERT = Math.max(1, Math.floor(60000 / comuns.length));

  for (;;) {
    const linhas = await rs.getRows(LOTE);
    if (!linhas.length) break;

    for (let ini = 0; ini < linhas.length; ini += POR_INSERT) {
      const fatia = linhas.slice(ini, ini + POR_INSERT);
      const valores = [];
      const params = [];
      fatia.forEach((l, i) => {
        const base = i * comuns.length;
        valores.push('(' + comuns.map((_, j) => `$${base + j + 1}`).join(',') + ')');
        params.push(...l);
      });
      const ins = await pg.query(
        `INSERT INTO ${DESTINO} (${listaPg}) VALUES ${valores.join(',')}` +
        (SUBSTITUIR || !chave ? '' : ` ON CONFLICT (${chave}) DO NOTHING`),
        params,
      );
      gravadas += ins.rowCount ?? fatia.length;
    }
    lidas += linhas.length;
    process.stdout.write(`
  lidas ${lidas.toLocaleString('pt-BR')} / ${Number(total).toLocaleString('pt-BR')} — inseridas ${gravadas.toLocaleString('pt-BR')}`);
  }
  console.log(`\nconcluído: ${gravadas.toLocaleString('pt-BR')} linha(s) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const conf = await pg.query(
    SEM_DATA
      ? `SELECT COUNT(*) n FROM ${DESTINO}`
      : `SELECT COUNT(*) n, MIN(${COLUNA_DATA})::date de, MAX(${COLUNA_DATA})::date ate FROM ${DESTINO} WHERE ${wherePg}`,
  );
  console.log(`no destino: ${conf.rows[0].n} linha(s)` +
    (SEM_DATA ? '' : `, de ${conf.rows[0].de} a ${conf.rows[0].ate}`));

  await rs.close();
  await ora.close();
  await pg.end();
})().catch((e) => { console.error('\nFALHOU:', e.message); process.exit(1); });
