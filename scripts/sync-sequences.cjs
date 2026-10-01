/**
 * sync-sequences.cjs — Sincroniza as sequences do Postgres com o MAX da coluna dona.
 *
 * POR QUÊ: quando dados são carregados com o valor da PK explícito (ex.: migração
 * Oracle→PG), a sequence NÃO avança. Aí o próximo nextval() gera um valor que já
 * existe → erro 23505 (duplicate key) ao criar qualquer registro novo.
 * RODAR ESTE SCRIPT SEMPRE APÓS UMA CARGA/MIGRAÇÃO DE DADOS.
 *
 * USO:
 *   DATABASE_URL="postgres://..." node scripts/sync-sequences.cjs                 # DRY-RUN (só mostra)
 *   DATABASE_URL="postgres://..." node scripts/sync-sequences.cjs --apply         # aplica os setval
 *   SEQ_SCHEMAS="db_manaus,db_rondonia" node scripts/sync-sequences.cjs --apply   # schemas específicos
 *
 * Seguro: só faz setval PRA FRENTE (nunca reduz uma sequence). is_called=true → próximo = MAX+1.
 */
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const CONN = process.env.DATABASE_URL;
if (!CONN) { console.error('Defina DATABASE_URL no ambiente.'); process.exit(1); }
const SCHEMAS = (process.env.SEQ_SCHEMAS || 'db_manaus,db_rondonia,db_roraima')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Sequences code-driven que perderam o vínculo OWNED BY (nome não bate com a coluna).
// Adicione aqui se aparecerem novas "sem coluna vinculada" no relatório.
const MAP_EXPLICITO = {
  dbarmazem_id_armazem_seq: ['dbarmazem', 'id_armazem'],
  dbacao_cod_acao_seq: ['dbacao', 'cod_acao'],
  dbclien_contatos_codcon_seq: ['dbclien_contatos', 'codcon'],
  dbclien_creditotmp_id_seq: ['dbclien_creditotmp', 'id'],
  dbclien_email_codclimail_seq: ['dbclien_email', 'codclimail'],
  dbitem_inventario_id_item_seq: ['dbitem_inventario', 'id_item'],
  seq_cod_receb: ['dbreceb', 'cod_receb'],
  seq_dbprod_codprod: ['dbprod', 'codprod'],
};

(async () => {
  const c = new Client({ connectionString: CONN, connectionTimeoutMillis: 15000, keepAlive: true });
  await c.connect();
  await c.query('SET statement_timeout=120000');
  const q = async (s, p) => (await c.query(s, p)).rows;

  let atras = 0, fix = 0, semDono = 0;
  for (const sc of SCHEMAS) {
    console.log(`\n================ ${sc} ================`);
    const seqs = (await q(
      `SELECT c.relname AS seq FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind='S' AND n.nspname=$1 ORDER BY 1`, [sc])).map((r) => r.seq);
    const owned = {};
    (await q(
      `SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
         FROM pg_depend d
         JOIN pg_class s ON s.oid=d.objid AND s.relkind='S'
         JOIN pg_class t ON t.oid=d.refobjid
         JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
         JOIN pg_namespace n ON n.oid=s.relnamespace
        WHERE d.deptype='a' AND n.nspname=$1`, [sc])).forEach((r) => { owned[r.seq] = [r.tbl, r.col]; });

    for (const seq of seqs) {
      let m = owned[seq] || MAP_EXPLICITO[seq];
      if (!m) {
        const g = seq.match(/^seq_(.+)_([a-z0-9]+)$/i); // padrão seq_<tabela>_<coluna>
        if (g && (await q(`SELECT to_regclass($1) AS r`, [`${sc}.${g[1]}`]))[0].r) m = [g[1], g[2]];
      }
      if (!m) { console.log(`  ${seq}: (sem coluna vinculada — adicione em MAP_EXPLICITO)`); semDono++; continue; }
      const [tbl, col] = m;
      if (!(await q(`SELECT to_regclass($1) AS r`, [`${sc}.${tbl}`]))[0].r) continue;
      const last = Number((await q(`SELECT last_value FROM ${sc}."${seq}"`))[0].last_value);
      const maxRow = (await q(
        `SELECT COALESCE(MAX((${col})::bigint),0) AS m FROM ${sc}.${tbl} WHERE (${col})::text ~ '^[0-9]+$'`
      ).catch(() => [{ m: null }]))[0];
      if (maxRow.m === null) continue; // coluna não-numérica
      const maxN = Number(maxRow.m);
      if (last < maxN) {
        atras++;
        console.log(`  ⚠️ ${seq} -> ${tbl}.${col}: seq=${last} MAX=${maxN} ATRÁS`);
        if (APPLY) { await q(`SELECT setval('${sc}."${seq}"', $1, true)`, [String(maxN)]); fix++; console.log(`       -> setval ${maxN}`); }
      }
    }
  }
  console.log(`\n===== atrasadas=${atras} corrigidas=${fix} sem_dono=${semDono} (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
