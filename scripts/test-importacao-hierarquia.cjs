/**
 * Teste da hierarquia Fornecedor → Adição → Item (DIe 2607671190).
 * Compila o helper real (importacaoHierarquia.ts) com tsc, lê o xml_original do
 * banco (dev), parseia com @xmldom e valida as regras.
 *
 * Rodar:  node scripts/test-importacao-hierarquia.cjs
 */
require('dotenv/config');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { DOMParser } = require('@xmldom/xmldom');

// 1) Compila o helper real para JS (CommonJS) num diretório temporário.
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imphier-'));
execSync(
  `npx tsc src/lib/compras/importacaoHierarquia.ts --outDir "${outDir}" ` +
  `--module commonjs --target es2019 --skipLibCheck --esModuleInterop`,
  { stdio: 'inherit' },
);
const helper = require(path.join(outDir, 'importacaoHierarquia.js'));

const txt = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
const money = (raw) => parseInt(raw || '0', 10) / 100;

function parseAdicoes(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const ads = [];
  const adEls = doc.getElementsByTagName('adicao');
  for (let i = 0; i < adEls.length; i++) {
    const ad = adEls[i];
    const numAdicao = parseInt(txt(ad, 'numAdicao') || '0', 10);
    const nomeFornecedor = txt(ad, 'nomeFornecedor');
    const itEls = ad.getElementsByTagName('itemAdicao');
    const itens = [];
    for (let j = 0; j < itEls.length; j++) {
      const it = itEls[j];
      itens.push({ numItem: parseInt(txt(it, 'numItem') || '0', 10), numAdicao, ncm: txt(it, 'cdNcmItem') });
    }
    ads.push({
      numAdicao, nomeFornecedor, ncm: itens[0]?.ncm,
      vlFob: money(txt(ad, 'vlFob')), vlFrete: money(txt(ad, 'vlFrete')),
      vlPisCofins: money(txt(ad, 'vlPisCofins')), vlIcms: money(txt(ad, 'vlIcms')), itens,
    });
  }
  return ads;
}

let falhas = 0;
const check = (nome, cond, detalhe = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!cond) falhas++;
};

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  try {
    const r = await pool.query(`SELECT xml_original FROM dbent_importacao WHERE nro_di='2607671190' ORDER BY id DESC LIMIT 1`);
    const xml = r.rows[0]?.xml_original;
    if (!xml) { console.log('SKIP: DIe 2607671190 não está no banco.'); return; }

    const adicoes = parseAdicoes(xml);
    const forns = helper.montarHierarquia(adicoes);
    const ordem = helper.ordemItensNota(forns);
    const principal = helper.fornecedorPrincipal(forns, 'ADICAO_001');
    const totalItens = adicoes.reduce((s, a) => s + a.itens.length, 0);
    const primeiro = ordem[0], ultimo = ordem[ordem.length - 1];

    console.log('\n=== DIe 2607671190 ===');
    check('8 fornecedores', forns.length === 8, `obtido ${forns.length}`);
    check('25 adições', adicoes.length === 25, `obtido ${adicoes.length}`);
    check('252 itens', totalItens === 252, `obtido ${totalItens}`);
    check('principal = YUHUAN JINLI', /YUHUAN JINLI/.test(principal?.nome || ''), principal?.nome || '-');
    check('item 1 = adição 001 / seq 001', primeiro?.numAdicao === 1 && primeiro?.numItem === 1, `ad ${primeiro?.numAdicao}/seq ${primeiro?.numItem}`);
    check('último = adição 025 / seq 002', ultimo?.numAdicao === 25 && ultimo?.numItem === 2, `ad ${ultimo?.numAdicao}/seq ${ultimo?.numItem}`);

    // Matching de nome (prefixo normalizado)
    check('nome DIe casa com cadastro (prefixo)',
      helper.nomesCombinam('YUHUAN JINLI AUTO PARTS CO.,LT', 'YUHUAN JINLI AUTO PARTS CO. LTD') &&
      !helper.nomesCombinam('YUHUAN JINLI AUTO PARTS CO.,LT', 'YUHUAN HONGZE AUTOMOBILE PUMP CO., LTD'));

    // Vínculo fornecedor → cliente (cadastro tipo X) resolvido contra o banco real
    const cliRes = await pool.query(`SELECT codcli, nome, nomefant, codpais, cpfcgc FROM dbclien WHERE tipo='X'`);
    const candidatos = cliRes.rows.map((r) => ({
      codCliente: String(r.codcli), nome: r.nome || '', nomeFant: r.nomefant || null,
      codPais: r.codpais ?? null, idEstrangeiro: r.cpfcgc ?? null,
    }));
    const aprRes = await pool.query(`SELECT nome_norm, cod_cliente FROM dbent_importacao_fornecedor_cliente`);
    const aprendidos = new Map(aprRes.rows.map((r) => [r.nome_norm, String(r.cod_cliente)]));

    const vinculoPrincipal = helper.resolverFornecedorCliente(principal.nome, candidatos, aprendidos);
    check('principal resolve cod_cliente = 36535',
      vinculoPrincipal.codCliente === '36535',
      `${vinculoPrincipal.status} → ${vinculoPrincipal.codCliente || '-'}`);

    console.log('\nFornecedores (1ª adição → vínculo):');
    forns.forEach((f) => {
      const v = helper.resolverFornecedorCliente(f.nome, candidatos, aprendidos);
      const av = helper.avisosDestinatarioExterior(v.cliente);
      console.log(
        `  ${String(f.primeiraAdicao).padStart(2, '0')}  ${f.nome.padEnd(42)} ` +
        `${(v.codCliente || '----').padStart(6)} [${v.status}]` +
        `${av.length ? '  ⚠ ' + av.join('; ') : ''}`,
      );
    });
  } catch (e) { console.error('ERRO:', e.message); falhas++; }
  finally { await pool.end(); try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {} }
  console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
})();
