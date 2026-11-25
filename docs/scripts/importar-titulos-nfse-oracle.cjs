/**
 * Importa do Oracle (Delphi) os TÍTULOS A RECEBER das notas de serviço que faltam no Postgres.
 *
 * A migração do Contas a Receber trouxe, de 2022 a 2024, só os títulos em aberto; os já recebidos
 * dessas notas ficaram de fora. Sem eles, a tela Notas de Serviço mostra a nota "sem título" e
 * o recebido zerado.
 *
 *   Oracle GERAL.DBRECEB  (tipo 'S', cod_fat de nota ATIVA em DBFATURA_NFS2) → <schema>.dbreceb
 *   Oracle GERAL.DBFRECEB (baixas desses títulos)                           → <schema>.dbfreceb
 *
 * Só insere o que não existe (pelo cod_receb / cod_freceb): não altera nada que já está no PG,
 * e pode rodar de novo, por exemplo contra o Oracle de produção.
 *
 * Uso (na raiz do projeto):
 *   node docs/scripts/importar-titulos-nfse-oracle.cjs              → prévia (desfaz no fim)
 *   node docs/scripts/importar-titulos-nfse-oracle.cjs --aplicar    → grava
 *   opções: --schema=db_manaus (padrão)   --oracle-lib=C:/oracle/instantclient/instantclient_23_4
 * Conexões: DATABASE_URL2 (Oracle) e DATABASE_URL (Postgres).
 */
require('dotenv').config();
const oracledb = require('oracledb');
const { Pool } = require('pg');

const arg = (nome, padrao) => {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.split('=').slice(1).join('=') : padrao;
};
const APLICAR = process.argv.includes('--aplicar');
const SCHEMA = arg('schema', 'db_manaus');
const ORACLE_LIB = arg('oracle-lib', 'C:/oracle/instantclient/instantclient_23_4');
if (!/^db_[a-z_]+$/.test(SCHEMA)) throw new Error(`schema inválido: ${SCHEMA}`);

// Oracle DATE chega como Date na meia-noite LOCAL: para colunas date usa os componentes locais
const dataISO = (d) => {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

async function colunasPg(db, tabela) {
  return (await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [SCHEMA, tabela])).rows;
}

/** Insere as linhas do Oracle nas colunas comuns; devolve quantas entraram. */
async function inserir(db, tabela, pk, linhas, cols) {
  const comuns = cols.filter((c) => linhas.length && Object.prototype.hasOwnProperty.call(linhas[0], c.column_name.toUpperCase()));
  let n = 0;
  for (const l of linhas) {
    const valores = comuns.map((c) => {
      const v = l[c.column_name.toUpperCase()];
      if (v == null) return null;
      if (c.data_type === 'date') return dataISO(v);
      if (typeof v === 'string') return v.trimEnd();
      return v;
    });
    const r = await db.query(
      `INSERT INTO ${tabela} (${comuns.map((c) => `"${c.column_name}"`).join(',')})
       VALUES (${comuns.map((_, i) => `$${i + 1}`).join(',')})
       ON CONFLICT DO NOTHING`, valores);
    n += r.rowCount;
  }
  return { n, colunas: comuns.length, ignoradas: cols.length - comuns.length };
}

async function main() {
  oracledb.initOracleClient({ libDir: ORACLE_LIB });
  const u = new URL(String(process.env.DATABASE_URL2).replace(/^oracle:/, 'http:'));
  const ora = await oracledb.getConnection({
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    connectString: `${u.hostname}:${u.port}${u.pathname}`,
  });
  const q = async (sql) => (await ora.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchArraySize: 2000 })).rows;
  const banco = (await q(`SELECT sys_context('USERENV','DB_NAME') db FROM dual`))[0].DB;
  console.log(`Oracle: ${banco} → Postgres ${SCHEMA} ${APLICAR ? '(GRAVANDO)' : '(prévia — desfaz no fim)'}`);

  const titulosOra = await q(
    `SELECT r.* FROM GERAL.DBRECEB r
      WHERE r.tipo = 'S'
        AND EXISTS (SELECT 1 FROM GERAL.DBFATURA_NFS2 n WHERE n.codfat = r.cod_fat AND n.cancel = 'N')
      ORDER BY r.cod_receb`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`SET LOCAL search_path TO ${SCHEMA}`);

    const existentes = new Set((await db.query(
      `SELECT cod_receb FROM dbreceb WHERE cod_receb = ANY($1)`, [titulosOra.map((t) => t.COD_RECEB)])).rows.map((r) => r.cod_receb));
    const faltam = titulosOra.filter((t) => !existentes.has(t.COD_RECEB));
    console.log(`Títulos de notas de serviço ativas no Oracle: ${titulosOra.length} · já no PG: ${existentes.size} · faltam: ${faltam.length}`);
    if (!faltam.length) { await db.query('ROLLBACK'); return; }

    const porAno = {};
    faltam.forEach((t) => { const a = new Date(t.DT_EMISSAO).getFullYear(); porAno[a] = (porAno[a] || 0) + 1; });
    console.log('  por ano de emissão:', porAno,
      `· recebidos ${faltam.filter((t) => t.REC === 'S').length} · cancelados ${faltam.filter((t) => t.CANCEL === 'S').length}`,
      `· valor ${faltam.reduce((s, t) => s + Number(t.VALOR_PGTO || 0), 0).toFixed(2)}`);

    // baixas (DBFRECEB) desses títulos, em lotes por causa do limite de 1000 itens no IN
    const cods = faltam.map((t) => t.COD_RECEB);
    let baixas = [];
    for (let i = 0; i < cods.length; i += 900) {
      const lote = cods.slice(i, i + 900).map((c) => `'${String(c).replace(/'/g, '')}'`).join(',');
      baixas = baixas.concat(await q(`SELECT * FROM GERAL.DBFRECEB WHERE cod_receb IN (${lote}) ORDER BY cod_freceb`));
    }

    // dbfreceb não tem chave única no PG; cod_freceb é a sequência DENTRO do título (001, 002...):
    // a baixa é identificada pelo par (cod_receb, cod_freceb)
    const baixasPg = new Set((await db.query(
      `SELECT cod_receb || '|' || cod_freceb AS k FROM dbfreceb WHERE cod_receb = ANY($1)`, [cods])).rows.map((r) => r.k));
    baixas = baixas.filter((b) => !baixasPg.has(`${b.COD_RECEB}|${b.COD_FRECEB}`));

    const rt = await inserir(db, 'dbreceb', 'cod_receb', faltam, await colunasPg(db, 'dbreceb'));
    const rb = await inserir(db, 'dbfreceb', 'cod_freceb', baixas, await colunasPg(db, 'dbfreceb'));
    console.log(`dbreceb:  ${rt.n} inseridos (${rt.colunas} colunas)`);
    console.log(`dbfreceb: ${rb.n} baixas inseridas (${baixasPg.size} já existiam)`);

    // conferência: notas ativas sem título depois da importação
    const semTitulo = (await db.query(
      `SELECT count(*)::int n FROM nfs_nota n WHERE n.cancel <> 'S'
          AND NOT EXISTS (SELECT 1 FROM dbreceb r WHERE r.tipo = 'S' AND r.cod_fat = n.codfat)`)).rows[0].n;
    console.log(`Notas ativas ainda sem título: ${semTitulo}`);

    await db.query(APLICAR ? 'COMMIT' : 'ROLLBACK');
    console.log(APLICAR ? 'Gravado.' : 'Prévia: nada foi gravado (use --aplicar).');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    db.release();
    await pool.end();
    await ora.close();
  }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
