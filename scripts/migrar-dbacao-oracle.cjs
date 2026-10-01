// Carrega o histórico do dbacao do Oracle para um schema do Postgres.
//
// Para que serve: relatórios que deduzem informação do registro de auditoria —
// hoje o "Títulos Diário à Vista" (ramo Auto Peças/Ferramentas), que descobre
// quem emitiu a fatura pelo dbacao (tabela DBFATURA, ação INCLUIR).
//
// Uso:
//   node scripts/migrar-dbacao-oracle.cjs                      (padrão: 24 meses, DBFATURA/INCLUIR, db_manaus)
//   node scripts/migrar-dbacao-oracle.cjs --meses=24 --tabela=DBFATURA --acao=INCLUIR
//   node scripts/migrar-dbacao-oracle.cjs --tabela=DBVENDA --acao=                  (todas as ações da tabela)
//   node scripts/migrar-dbacao-oracle.cjs --dry-run                                 (só conta, não grava)
//
// Idempotente: apaga a mesma fatia (tabela + ação + janela de datas) no destino
// antes de inserir, então rodar de novo não duplica.
//
// cod_acao no Postgres é GENERATED ALWAYS AS IDENTITY — o Oracle não tem esse
// campo, e a identidade do destino gera os códigos. Não há risco de colisão.

const oracledb = require('oracledb');
const { Client } = require('pg');
require('dotenv').config();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }),
);

const MESES = Number(args.meses || 24);
const TABELA = args.tabela === undefined ? 'DBFATURA' : String(args.tabela || '');
const ACAO = args.acao === undefined ? 'INCLUIR' : String(args.acao || '');
const SCHEMA = String(args.schema || 'db_manaus');
const DRY = !!args['dry-run'];
const LOTE = Number(args.lote || 2000);

const ORACLE = {
  user: 'GERAL',
  password: '123',
  connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br',
};

for (const dir of ['C:/oracle/instantclient/instantclient_23_4', 'C:/instantclient_12_2']) {
  try { oracledb.initOracleClient({ libDir: dir }); break; } catch { /* tenta o próximo */ }
}

const filtros = (prefixo = '') => {
  const partes = [`${prefixo}data >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES})`];
  if (TABELA) partes.push(`${prefixo}tabela = '${TABELA}'`);
  if (ACAO) partes.push(`${prefixo}acao = '${ACAO}'`);
  return partes.join(' AND ');
};

(async () => {
  console.log(`origem : Oracle GERAL.DBACAO`);
  console.log(`destino: ${SCHEMA}.dbacao`);
  console.log(`fatia  : últimos ${MESES} meses` +
    (TABELA ? ` | tabela=${TABELA}` : ' | todas as tabelas') +
    (ACAO ? ` | acao=${ACAO}` : ' | todas as ações'));

  const ora = await oracledb.getConnection(ORACLE);
  const { rows: [[total]] } = await ora.execute(
    `SELECT COUNT(*) FROM GERAL.DBACAO WHERE ${filtros()}`,
  );
  console.log(`linhas na origem: ${total.toLocaleString('pt-BR')}`);

  if (DRY) { console.log('\n--dry-run: nada gravado.'); await ora.close(); return; }
  if (!total) { console.log('nada a migrar.'); await ora.close(); return; }

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query(`SET search_path TO ${SCHEMA}, public`);

  // Idempotência: limpa a mesma fatia antes de carregar.
  const cond = [`data >= (CURRENT_DATE - INTERVAL '${MESES} months')`];
  const paramsDel = [];
  if (TABELA) { paramsDel.push(TABELA); cond.push(`tabela = $${paramsDel.length}`); }
  if (ACAO) { paramsDel.push(ACAO); cond.push(`acao = $${paramsDel.length}`); }
  const del = await pg.query(`DELETE FROM dbacao WHERE ${cond.join(' AND ')}`, paramsDel);
  if (del.rowCount) console.log(`removidas ${del.rowCount.toLocaleString('pt-BR')} linha(s) da carga anterior`);

  const cursor = await ora.execute(
    `SELECT codusr, acao, tabela, obs, data FROM GERAL.DBACAO WHERE ${filtros()} ORDER BY data`,
    [],
    { resultSet: true, fetchArraySize: LOTE },
  );
  const rs = cursor.resultSet;

  let gravadas = 0;
  const t0 = Date.now();
  for (;;) {
    const linhas = await rs.getRows(LOTE);
    if (!linhas.length) break;

    const valores = [];
    const params = [];
    linhas.forEach((l, i) => {
      const b = i * 5;
      valores.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      params.push(l[0], l[1], l[2], l[3], l[4]);
    });
    await pg.query(
      `INSERT INTO dbacao (codusr, acao, tabela, obs, data) VALUES ${valores.join(',')}`,
      params,
    );
    gravadas += linhas.length;
    const pct = ((gravadas / total) * 100).toFixed(1);
    process.stdout.write(`\r  ${gravadas.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} (${pct}%)`);
  }
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nconcluído: ${gravadas.toLocaleString('pt-BR')} linha(s) em ${seg}s`);

  const conf = await pg.query(
    `SELECT COUNT(*) n, MIN(data)::date de, MAX(data)::date ate FROM dbacao WHERE ${cond.join(' AND ')}`,
    paramsDel,
  );
  console.log(`no destino: ${conf.rows[0].n} linha(s), de ${conf.rows[0].de} a ${conf.rows[0].ate}`);

  await rs.close();
  await ora.close();
  await pg.end();
})().catch((e) => { console.error('\nFALHOU:', e.message); process.exit(1); });
