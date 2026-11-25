/**
 * Importa do Oracle (Delphi) as Notas Fiscais de Serviço PRESTADAS e o cadastro de serviços.
 * Etapa 1 da NFS-e (ver migration 093_nfs_notas_servico.sql).
 *
 *   Oracle GERAL.CAD_SERVICO_NFS                       → <schema>.dbservico_nfs
 *   Oracle GERAL.DBFATURA_NFS2 + DBPRODFAT_NFS2        → <schema>.nfs_nota (origem DELPHI) + nfs_nota_servico
 *   Oracle GERAL.DBFATURA_NFS  + DBPRODFAT_NFS         → idem, só as que não estão na NFS2 (origem DELPHI_ANTIGA)
 *
 * Os títulos continuam em dbreceb (tipo 'S', cod_fat = codfat) — o script só informa quantos casam.
 * Pode rodar de novo: atualiza o que veio do Delphi e não mexe em nota lançada pela web.
 *
 * Uso (na raiz do projeto):
 *   node docs/scripts/importar-nfse-oracle.cjs                 → prévia (desfaz no fim)
 *   node docs/scripts/importar-nfse-oracle.cjs --aplicar       → grava
 *   opções: --schema=db_manaus (padrão)   --oracle-lib=C:/oracle/instantclient/instantclient_23_4
 * Conexões: DATABASE_URL2 (Oracle, oracle://usuario:senha@host:porta/servico) e DATABASE_URL (Postgres).
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

// Oracle DATE chega como Date na meia-noite LOCAL: usa os componentes locais (sem fuso)
const dataISO = (d) => {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const txt = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);
const senId = (v) => (v == null ? null : String(v).trim().padStart(9, '0'));

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

  const servicos = await q(`SELECT * FROM GERAL.CAD_SERVICO_NFS ORDER BY sen_id`);
  const notas2 = await q(`SELECT * FROM GERAL.DBFATURA_NFS2 ORDER BY codfat`);
  const itens2 = await q(`SELECT * FROM GERAL.DBPRODFAT_NFS2 ORDER BY codfat`);
  const antigas = await q(`SELECT n.* FROM GERAL.DBFATURA_NFS n
                            WHERE NOT EXISTS (SELECT 1 FROM GERAL.DBFATURA_NFS2 n2 WHERE n2.codfat = n.codfat)
                            ORDER BY n.codfat`);
  const itensAntigos = await q(`SELECT p.* FROM GERAL.DBPRODFAT_NFS p
                                 WHERE NOT EXISTS (SELECT 1 FROM GERAL.DBFATURA_NFS2 n2 WHERE n2.codfat = p.codfat)`);
  await ora.close();
  console.log(`lidos: ${servicos.length} serviços, ${notas2.length} notas (NFS2), ${antigas.length} antigas só na NFS`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pg = await pool.connect();
  try {
    await pg.query('BEGIN');
    await pg.query(`SET LOCAL search_path TO ${SCHEMA}`);

    // 1. cadastro de serviços
    let nServ = 0;
    for (const s of servicos) {
      await pg.query(
        `INSERT INTO dbservico_nfs (sen_id, sen_codigo, sen_cnae, sen_codunico, sen_atividade, sen_issqn, sen_codgpc, sen_excluido)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (sen_id) DO UPDATE SET sen_codigo = EXCLUDED.sen_codigo, sen_cnae = EXCLUDED.sen_cnae,
           sen_codunico = EXCLUDED.sen_codunico, sen_atividade = EXCLUDED.sen_atividade, sen_issqn = EXCLUDED.sen_issqn,
           sen_codgpc = EXCLUDED.sen_codgpc, sen_excluido = EXCLUDED.sen_excluido`,
        [senId(s.SEN_ID), txt(s.SEN_CODIGO, 5), txt(s.SEN_CNAE, 9) || '', txt(s.SEN_CODUNICO, 20) || senId(s.SEN_ID),
         txt(s.SEN_ATIVIDADE, 150) || '(SEM DESCRIÇÃO)', num(s.SEN_ISSQN), txt(s.SEN_CODGPC, 4), num(s.SEN_EXCLUIDO)]);
      nServ++;
    }

    // 2. notas — só sobrescreve o que veio do Delphi (nota lançada na web fica)
    const gravarNota = async (n, origem) => {
      const r = await pg.query(
        `INSERT INTO nfs_nota (codfat, nroform, verificacao, codcli, dtemissao, competencia, data, totalnfs, totalfat,
            frmfat, tipofat, cod_conta, valor_servico, valor_desconto, valor_deducoes, issqn_basecalculo, issqn_aliquota,
            issqn_retido, issqn_valor, pis_valor, cofins_valor, ir_valor, inss_valor, csll_valor, outros_valor,
            aliquota_pis, aliquota_cofins, aliquota_ir, aliquota_inss, aliquota_csll, cst_pis, cst_cofins, obs, tipo,
            cancel, origem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
                 $29,$30,$31,$32,$33,$34,$35,$36)
         ON CONFLICT (codfat) DO UPDATE SET
            nroform = EXCLUDED.nroform, verificacao = EXCLUDED.verificacao, codcli = EXCLUDED.codcli,
            dtemissao = EXCLUDED.dtemissao, competencia = EXCLUDED.competencia, data = EXCLUDED.data,
            totalnfs = EXCLUDED.totalnfs, totalfat = EXCLUDED.totalfat, frmfat = EXCLUDED.frmfat,
            tipofat = EXCLUDED.tipofat, cod_conta = EXCLUDED.cod_conta, valor_servico = EXCLUDED.valor_servico,
            valor_desconto = EXCLUDED.valor_desconto, valor_deducoes = EXCLUDED.valor_deducoes,
            issqn_basecalculo = EXCLUDED.issqn_basecalculo, issqn_aliquota = EXCLUDED.issqn_aliquota,
            issqn_retido = EXCLUDED.issqn_retido, issqn_valor = EXCLUDED.issqn_valor, pis_valor = EXCLUDED.pis_valor,
            cofins_valor = EXCLUDED.cofins_valor, ir_valor = EXCLUDED.ir_valor, inss_valor = EXCLUDED.inss_valor,
            csll_valor = EXCLUDED.csll_valor, outros_valor = EXCLUDED.outros_valor,
            aliquota_pis = EXCLUDED.aliquota_pis, aliquota_cofins = EXCLUDED.aliquota_cofins,
            aliquota_ir = EXCLUDED.aliquota_ir, aliquota_inss = EXCLUDED.aliquota_inss,
            aliquota_csll = EXCLUDED.aliquota_csll, cst_pis = EXCLUDED.cst_pis, cst_cofins = EXCLUDED.cst_cofins,
            obs = EXCLUDED.obs, tipo = EXCLUDED.tipo, cancel = EXCLUDED.cancel, atualizado_em = now()
          WHERE nfs_nota.origem IN ('DELPHI','DELPHI_ANTIGA')
         RETURNING codfat`,
        [txt(n.CODFAT, 8), txt(n.NROFORM, 15), txt(n.VERIFICACAO, 50), txt(n.CODCLI, 10), dataISO(n.DTEMISSAO || n.DATA),
         txt(n.COMPETENCIA, 7), dataISO(n.DATA), num(n.TOTALNFS), num(n.TOTALFAT), txt(n.FRMFAT, 1), txt(n.TIPOFAT, 1),
         txt(n.COD_CONTA, 4), num(n.VALOR_SERVICO ?? n.TOTALNFS), num(n.VALOR_DESCONTO), num(n.VALOR_DEDUCOES),
         num(n.ISSQN_BASECALCULO), num(n.ISSQN_ALIQUOTA), txt(n.ISSQN_RETIDO, 1) || 'N', num(n.ISSQN_VALOR),
         num(n.PIS_VALOR), num(n.COFINS_VALOR), num(n.IR_VALOR), num(n.INSS_VALOR), num(n.CSLL_VALOR),
         num(n.OUTROS_VALOR), num(n.ALIQUOTA_PIS), num(n.ALIQUOTA_COFINS), num(n.ALIQUOTA_IR), num(n.ALIQUOTA_INSS),
         num(n.ALIQUOTA_CSLL), txt(n.CST_PIS, 2), txt(n.CST_COFINS, 2), txt(n.OBS, 255),
         n.TIPO == null ? null : Number(n.TIPO), txt(n.CANCEL, 1) || 'N', origem]);
      return r.rowCount > 0; // false = nota da web com o mesmo código: não mexe
    };
    const itensPorFat = (lista) => lista.reduce((m, i) => {
      const k = String(i.CODFAT).trim();
      (m[k] = m[k] || []).push(i);
      return m;
    }, {});
    const gravarItens = async (codfat, itens) => {
      await pg.query(`DELETE FROM nfs_nota_servico WHERE codfat = $1`, [codfat]);
      for (const i of itens || []) {
        await pg.query(
          `INSERT INTO nfs_nota_servico (codfat, sen_id, descr, qtde, prunit, tiposeq) VALUES ($1,$2,$3,$4,$5,$6)`,
          [codfat, senId(i.SEN_ID), txt(i.DESCR, 2000), i.QTDE == null ? 1 : Number(i.QTDE), num(i.PRUNIT),
           i.TIPOSEQ == null ? null : Number(i.TIPOSEQ)]);
      }
    };

    let nNotas = 0, puladas = 0;
    const mapa2 = itensPorFat(itens2);
    for (const n of notas2) {
      if (await gravarNota(n, 'DELPHI')) { await gravarItens(String(n.CODFAT).trim(), mapa2[String(n.CODFAT).trim()]); nNotas++; }
      else puladas++;
    }
    const mapaA = itensPorFat(itensAntigos);
    let nAntigas = 0;
    for (const n of antigas) {
      if (await gravarNota(n, 'DELPHI_ANTIGA')) { await gravarItens(String(n.CODFAT).trim(), mapaA[String(n.CODFAT).trim()]); nAntigas++; }
      else puladas++;
    }

    // 3. conferência
    const conf = (await pg.query(`
      SELECT count(*)::int notas,
             count(*) FILTER (WHERE cancel = 'N')::int ativas,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM dbreceb r WHERE r.tipo = 'S' AND r.cod_fat = n.codfat))::int com_titulo,
             count(*) FILTER (WHERE cancel = 'N' AND NOT EXISTS (SELECT 1 FROM dbreceb r WHERE r.tipo = 'S' AND r.cod_fat = n.codfat))::int ativas_sem_titulo,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM dbclien c WHERE c.codcli = n.codcli))::int sem_cliente,
             min(dtemissao)::text de, max(dtemissao)::text ate,
             sum(totalnfs) FILTER (WHERE cancel = 'N')::numeric(15,2) total_ativas
        FROM nfs_nota n WHERE origem IN ('DELPHI','DELPHI_ANTIGA')`)).rows[0];
    const servSemCad = (await pg.query(`
      SELECT count(*)::int n FROM nfs_nota_servico i
       WHERE i.sen_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbservico_nfs s WHERE s.sen_id = i.sen_id)`)).rows[0].n;
    console.log(`gravados: ${nServ} serviços, ${nNotas} notas, ${nAntigas} antigas${puladas ? `, ${puladas} puladas (já lançadas na web)` : ''}`);
    console.log('conferência:', conf, '| serviços de nota sem cadastro:', servSemCad);

    await pg.query(APLICAR ? 'COMMIT' : 'ROLLBACK');
    console.log(APLICAR ? 'GRAVADO.' : 'Prévia desfeita. Rode com --aplicar para gravar.');
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    pg.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
