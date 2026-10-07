/**
 * Backfill (one-shot, dev): popula num_item nos itens e dbent_importacao_adicao
 * das DIs já importadas, a partir do xml_original (formato DIe SEFAZ-AM).
 *   - num_item: sequência dentro de (id_fatura, numero_adicao) por ordem de id.
 *   - _adicao : fornecedor + NCM + FOB/frete/PIS-COFINS/ICMS por adição.
 * Rodar: node scripts/backfill-importacao-adicao.cjs
 */
require('dotenv/config');
const { Pool } = require('pg');
const { DOMParser } = require('@xmldom/xmldom');

const txt = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
const money = (raw) => parseInt(raw || '0', 10) / 100;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  try {
    const dis = await pool.query(`SELECT id, nro_di, xml_original FROM dbent_importacao WHERE xml_original IS NOT NULL ORDER BY id`);
    console.log(`${dis.rowCount} DI(s) com xml_original`);

    for (const di of dis.rows) {
      // 1) num_item por (id_fatura, numero_adicao) na ordem de id
      await pool.query(`
        WITH seq AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY id_fatura, numero_adicao ORDER BY id) AS n
          FROM dbent_importacao_it_ent WHERE id_importacao = $1
        )
        UPDATE dbent_importacao_it_ent it SET num_item = seq.n
        FROM seq WHERE it.id = seq.id AND (it.num_item IS NULL)`, [di.id]);

      // 2) adições do XML (só formato DIe SEFAZ-AM: <InfDIe>)
      const doc = new DOMParser().parseFromString(di.xml_original, 'text/xml');
      if (!doc.getElementsByTagName('InfDIe')[0]) { console.log(`DI ${di.nro_di}: formato não-DIe, pulando adições`); continue; }
      const adEls = doc.getElementsByTagName('adicao');
      let nAd = 0;
      for (let i = 0; i < adEls.length; i++) {
        const ad = adEls[i];
        const numAd = parseInt(txt(ad, 'numAdicao') || '0', 10);
        const ncm = ad.getElementsByTagName('cdNcmItem')[0]?.textContent?.trim() || '';
        await pool.query(`
          INSERT INTO dbent_importacao_adicao (id_importacao, numero_adicao, fornecedor_nome, ncm, vl_fob, vl_frete, vl_pis_cofins, vl_icms)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id_importacao, numero_adicao) DO UPDATE SET
            fornecedor_nome=EXCLUDED.fornecedor_nome, ncm=EXCLUDED.ncm,
            vl_fob=EXCLUDED.vl_fob, vl_frete=EXCLUDED.vl_frete,
            vl_pis_cofins=EXCLUDED.vl_pis_cofins, vl_icms=EXCLUDED.vl_icms`,
          [di.id, numAd, txt(ad, 'nomeFornecedor'), ncm,
           money(txt(ad, 'vlFob')), money(txt(ad, 'vlFrete')),
           money(txt(ad, 'vlPisCofins')), money(txt(ad, 'vlIcms'))]);
        nAd++;
      }
      console.log(`DI ${di.nro_di} (id ${di.id}): ${nAd} adições`);
    }
    console.log('Backfill concluído.');
  } catch (e) { console.error('ERRO:', e.message); }
  finally { await pool.end(); }
})();
