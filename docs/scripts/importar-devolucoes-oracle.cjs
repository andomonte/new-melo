/**
 * Importa o histórico de devoluções do Oracle (Delphi) para o PG — db_manaus.
 *   FAT_DEVOLUCAO → fat_devolucao (dev_origem='ORACLE')
 *   FAT_IT_DEVOLUCAO → fat_it_devolucao
 *   FAT_DEVOLUCAO_REGISTRO → fat_devolucao_registro
 *   CAD_CLIENTE_CREDOR → cad_cliente_credor (só os pares cujo cliente existe no PG)
 *
 * O Oracle é de Manaus (CNPJ 04618302000189; todos os dev_id começam com 1).
 * Idempotente: cabeçalho e itens são atualizados se já existirem; os registros da
 * devolução são regravados. Devoluções criadas no web (dev_id com prefixo 9) não são tocadas.
 *
 * Uso: node docs/scripts/importar-devolucoes-oracle.cjs [--dry]
 * Requer migration 102 aplicada; DATABASE_URL e DATABASE_URL2 (Oracle) no .env.
 */
require('dotenv').config();
const oracledb = require('oracledb');
const { Pool } = require('pg');

const SCHEMA = 'db_manaus';
const LOTE = 2000;
const DRY = process.argv.includes('--dry');

oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_DIR || 'C:/oracle/instantclient/instantclient_23_4' });
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

function conexaoOracle() {
  const u = new URL(process.env.DATABASE_URL2.replace(/^oracle:/, 'http:'));
  return oracledb.getConnection({
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    connectString: `${u.hostname}:${u.port}${u.pathname}`,
  });
}

/** INSERT em lote com ON CONFLICT; colunas em minúsculas = chaves do objeto do Oracle. */
async function inserirLote(pg, tabela, colunas, linhas, conflito) {
  const lote = Math.min(LOTE, Math.floor(60000 / colunas.length));
  for (let i = 0; i < linhas.length; i += lote) {
    const parte = linhas.slice(i, i + lote);
    const params = [];
    const values = parte.map((ln) => `(${colunas.map((c) => { params.push(ln[c.toUpperCase()] ?? null); return `$${params.length}`; }).join(',')})`);
    await pg.query(`INSERT INTO ${SCHEMA}.${tabela} (${colunas.join(',')}) VALUES ${values.join(',')} ${conflito}`, params);
  }
}

(async () => {
  const ora = await conexaoOracle();
  const pg = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = await pg.connect();
  try {
    const cabCols = ['dev_id', 'dev_osuser', 'dev_ip', 'dev_host', 'dev_program', 'dev_data', 'dev_user', 'dev_codusr',
      'dev_nomeusr', 'dev_tipodoc', 'dev_coddoc', 'dev_cfop', 'dev_coddest', 'dev_codfat', 'dev_cancel', 'dev_arm_id',
      'dev_pedido', 'dev_obs', 'dev_transp', 'dev_codmsg', 'dev_frete', 'dev_nomeusr_cancel', 'dev_codnfe_ent',
      'dev_insc07', 'dev_destino', 'dev_procedente', 'dev_status', 'dev_quantidade', 'dev_especie', 'dev_marca',
      'dev_numero', 'dev_pesobruto', 'dev_pesoliquido', 'dev_valorfrete', 'dev_totalprod', 'dev_totalnf'];
    const sel = cabCols.map((c) => (c === 'dev_data' ? `TO_CHAR(DEV_DATA,'YYYY-MM-DD HH24:MI:SS') AS DEV_DATA` : c.toUpperCase())).join(',');
    const cab = (await ora.execute(`SELECT ${sel} FROM FAT_DEVOLUCAO`, [], { fetchArraySize: 5000 })).rows;
    const itCols = ['itd_dev_id', 'itd_id', 'itd_codreq', 'itd_codvenda', 'itd_codint', 'itd_codprod', 'itd_arm_id',
      'itd_quant_original', 'itd_quant_disponivel', 'itd_quant_devolvida', 'itd_percentual', 'itd_totalipi',
      'itd_codvenda2', 'itd_codint2', 'itd_nrequis', 'itd_nritem'];
    const itens = (await ora.execute(`SELECT ${itCols.join(',').toUpperCase()} FROM FAT_IT_DEVOLUCAO`, [], { fetchArraySize: 10000 })).rows;
    const reg = (await ora.execute(`SELECT DER_DEV_ID, DER_DOCUMENTO, DER_CODIGO FROM FAT_DEVOLUCAO_REGISTRO`, [], { fetchArraySize: 10000 })).rows;
    const ccc = (await ora.execute(`SELECT CLC_CODCLI, CLC_CODCREDOR FROM CAD_CLIENTE_CREDOR`)).rows;
    console.log(`Oracle: ${cab.length} devoluções, ${itens.length} itens, ${reg.length} registros, ${ccc.length} cliente×credor`);
    if (DRY) return;

    await db.query('BEGIN');
    for (const c of cab) c.DEV_ORIGEM = 'ORACLE';
    await inserirLote(db, 'fat_devolucao', [...cabCols, 'dev_origem'], cab,
      `ON CONFLICT (dev_id) DO UPDATE SET ${cabCols.filter((c) => c !== 'dev_id').map((c) => `${c}=EXCLUDED.${c}`).join(',')}
       WHERE ${SCHEMA}.fat_devolucao.dev_origem = 'ORACLE'`);
    await inserirLote(db, 'fat_it_devolucao', itCols, itens,
      `ON CONFLICT (itd_dev_id, itd_id) DO UPDATE SET ${itCols.slice(2).map((c) => `${c}=EXCLUDED.${c}`).join(',')}`);

    await db.query(`DELETE FROM ${SCHEMA}.fat_devolucao_registro r
                     USING ${SCHEMA}.fat_devolucao d
                     WHERE d.dev_id = r.der_dev_id AND d.dev_origem = 'ORACLE'`);
    await inserirLote(db, 'fat_devolucao_registro', ['der_dev_id', 'der_documento', 'der_codigo'], reg, '');

    // cliente × credor: só os que faltam e cujo cliente existe no PG (FK para dbclien)
    const antes = Number((await db.query(`SELECT count(*) n FROM ${SCHEMA}.cad_cliente_credor`)).rows[0].n);
    await db.query(`CREATE TEMP TABLE tmp_ccc (codcli varchar(10), codcredor varchar(10)) ON COMMIT DROP`);
    for (let i = 0; i < ccc.length; i += LOTE) {
      const parte = ccc.slice(i, i + LOTE);
      const params = [];
      await db.query(`INSERT INTO tmp_ccc VALUES ${parte.map((r) => { params.push(r.CLC_CODCLI, r.CLC_CODCREDOR); return `($${params.length - 1},$${params.length})`; }).join(',')}`, params);
    }
    await db.query(`INSERT INTO ${SCHEMA}.cad_cliente_credor (clc_codcli, clc_codcredor)
                    SELECT DISTINCT t.codcli, t.codcredor FROM tmp_ccc t
                     WHERE EXISTS (SELECT 1 FROM ${SCHEMA}.dbclien c WHERE c.codcli = t.codcli)
                       AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.cad_cliente_credor x
                                        WHERE x.clc_codcli = t.codcli AND x.clc_codcredor = t.codcredor)`);
    const depois = Number((await db.query(`SELECT count(*) n FROM ${SCHEMA}.cad_cliente_credor`)).rows[0].n);
    await db.query('COMMIT');

    const conf = (await db.query(`SELECT (SELECT count(*) FROM ${SCHEMA}.fat_devolucao WHERE dev_origem='ORACLE') cab,
                                         (SELECT count(*) FROM ${SCHEMA}.fat_it_devolucao WHERE itd_dev_id < 90000000000) itens,
                                         (SELECT count(*) FROM ${SCHEMA}.fat_devolucao_registro) reg`)).rows[0];
    console.log(`PG ${SCHEMA}: ${conf.cab} devoluções, ${conf.itens} itens, ${conf.reg} registros; cliente×credor ${antes} → ${depois}`);
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('ERRO — nada gravado:', e.message);
    process.exitCode = 1;
  } finally {
    db.release();
    await pg.end();
    await ora.close();
  }
})();
