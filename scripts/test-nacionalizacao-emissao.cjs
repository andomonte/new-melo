/**
 * Teste da EMISSÃO da Nota de Nacionalização (Fase C) — DIe 2607671190 (id 52).
 * Simula o vínculo fornecedor→cliente (igual ao POST /fornecedores) e valida o
 * caminho de dados do endpoint preview-nacionalizacao: hierarquia persistida +
 * cod_cliente da fatura → ordem dos itens (det), fornecedor principal e cExportador.
 *
 * Rodar:  node scripts/test-nacionalizacao-emissao.cjs
 */
require('dotenv/config');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imphier-'));
execSync(
  `npx tsc src/lib/compras/importacaoHierarquia.ts --outDir "${outDir}" ` +
  `--module commonjs --target es2019 --skipLibCheck --esModuleInterop`,
  { stdio: 'inherit' },
);
const H = require(path.join(outDir, 'importacaoHierarquia.js'));

const ID = 52;
let falhas = 0;
const check = (nome, cond, det = '') => { console.log(`${cond ? '✓' : '✗'} ${nome}${det ? ' — ' + det : ''}`); if (!cond) falhas++; };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  try {
    // --- Simula o vínculo (o que o POST /fornecedores faz) ---
    const cliRes = await pool.query(`SELECT codcli, nome, nomefant, codpais, cpfcgc FROM dbclien WHERE tipo='X'`);
    const candidatos = cliRes.rows.map((r) => ({ codCliente: String(r.codcli), nome: r.nome || '', nomeFant: r.nomefant || null, codPais: r.codpais ?? null, idEstrangeiro: r.cpfcgc ?? null }));
    const aprRes = await pool.query(`SELECT nome_norm, cod_cliente FROM dbent_importacao_fornecedor_cliente`);
    const aprendidos = new Map(aprRes.rows.map((r) => [r.nome_norm, String(r.cod_cliente)]));

    const forn = await pool.query(`SELECT DISTINCT fornecedor_nome FROM dbent_importacao_entrada WHERE id_importacao=$1`, [ID]);
    for (const { fornecedor_nome } of forn.rows) {
      const v = H.resolverFornecedorCliente(fornecedor_nome, candidatos, aprendidos);
      if (v.codCliente) {
        await pool.query(
          `INSERT INTO dbent_importacao_fornecedor_cliente (nome_norm, cod_cliente, nome_die) VALUES ($1,$2,$3)
           ON CONFLICT (nome_norm) DO UPDATE SET cod_cliente=EXCLUDED.cod_cliente`,
          [H.chaveVinculo(fornecedor_nome), v.codCliente, fornecedor_nome],
        );
        await pool.query(`UPDATE dbent_importacao_entrada SET cod_cliente=$1 WHERE id_importacao=$2 AND fornecedor_nome=$3`, [v.codCliente, ID, fornecedor_nome]);
      }
    }

    // --- Mirror do endpoint: hierarquia persistida + cod_cliente da fatura ---
    const adRes = await pool.query(`SELECT numero_adicao, COALESCE(fornecedor_nome,'') fornecedor_nome, COALESCE(ncm,'') ncm, COALESCE(vl_fob,0) vl_fob FROM dbent_importacao_adicao WHERE id_importacao=$1 ORDER BY numero_adicao`, [ID]);
    const itRes = await pool.query(`SELECT id, numero_adicao, num_item, codprod FROM dbent_importacao_it_ent WHERE id_importacao=$1 AND codprod IS NOT NULL ORDER BY numero_adicao, num_item, id`, [ID]);
    const entRes = await pool.query(`SELECT COALESCE(fornecedor_nome,'') fornecedor_nome, cod_cliente FROM dbent_importacao_entrada WHERE id_importacao=$1`, [ID]);

    const codClientePorForn = new Map();
    entRes.rows.forEach((r) => { if (r.cod_cliente) codClientePorForn.set(r.fornecedor_nome, String(r.cod_cliente)); });
    const fornecedorPorAdicao = new Map();
    adRes.rows.forEach((a) => fornecedorPorAdicao.set(Number(a.numero_adicao), a.fornecedor_nome));

    const itensPorAdicao = new Map();
    itRes.rows.forEach((it) => { const n = Number(it.numero_adicao) || 0; if (!itensPorAdicao.has(n)) itensPorAdicao.set(n, []); itensPorAdicao.get(n).push(it); });
    const adicoesHier = adRes.rows.filter((a) => itensPorAdicao.has(Number(a.numero_adicao))).map((a) => {
      const n = Number(a.numero_adicao);
      return { numAdicao: n, nomeFornecedor: a.fornecedor_nome, ncm: a.ncm, vlFob: Number(a.vl_fob) || 0,
        itens: itensPorAdicao.get(n).map((it) => ({ numItem: Number(it.num_item) || 0, numAdicao: n, codprod: it.codprod })) };
    });

    const forns = H.montarHierarquia(adicoesHier);
    const ordem = H.ordemItensNota(forns);
    const principal = H.fornecedorPrincipal(forns, 'ADICAO_001');
    const codPrincipal = principal ? codClientePorForn.get(principal.nome) : null;

    console.log('\n=== Emissão (DIe 2607671190 / id 52) ===');
    check('8 fornecedores na hierarquia', forns.length === 8, `obtido ${forns.length}`);
    check('principal = YUHUAN JINLI', /YUHUAN JINLI/.test(principal?.nome || ''), principal?.nome || '-');
    check('principal cod_cliente (fatura) = 36535', codPrincipal === '36535', codPrincipal || '-');

    const primeiro = ordem[0];
    check('det nItem 1 = adição 001 / seq 001', primeiro?.numAdicao === 1 && primeiro?.numItem === 1, `ad ${primeiro?.numAdicao}/seq ${primeiro?.numItem}`);
    check('nItem sequencial 1..N', ordem.every((o, i) => o.nItem === i + 1), `N=${ordem.length}`);

    // Invariante da listagem: itens de um fornecedor são CONTÍGUOS no det, os
    // blocos seguem a 1ª adição crescente, e dentro do bloco (adição,seq) crescem.
    const primeiraDe = new Map(forns.map((f) => [f.nome, f.primeiraAdicao]));
    let ok = true, prevFirst = -1, curForn = null, prevA = -1, prevS = -1;
    const vistos = new Set();
    for (const o of ordem) {
      const forn = fornecedorPorAdicao.get(o.numAdicao);
      if (forn !== curForn) {
        if (vistos.has(forn)) { ok = false; }           // bloco não-contíguo
        const first = primeiraDe.get(forn);
        if (first < prevFirst) ok = false;               // ordem dos fornecedores
        prevFirst = first; vistos.add(forn); curForn = forn; prevA = -1; prevS = -1;
      }
      if (o.numAdicao < prevA || (o.numAdicao === prevA && o.numItem < prevS)) ok = false;
      prevA = o.numAdicao; prevS = o.numItem;
    }
    check('det = ordem da listagem (fornecedor→adição→seq)', ok);

    // cExportador por item = cod_cliente do fornecedor do item (todos preenchidos)
    const semExp = ordem.filter((o) => !codClientePorForn.get(fornecedorPorAdicao.get(o.numAdicao))).length;
    check('todo item tem cExportador (cliente do fornecedor)', semExp === 0, `sem vínculo: ${semExp}`);

    console.log(`\nitens na nota (det): ${ordem.length}`);
    console.log(`fornecedor principal: ${principal?.nome} → cExportador ${codPrincipal}`);
    console.log('\nfornecedor → adições:');
    forns.forEach((f) => console.log(`  ${String(f.primeiraAdicao).padStart(2, '0')} ${f.nome.padEnd(34)} [${f.adicoes.map((a) => a.numAdicao).join(',')}]`));
  } catch (e) { console.error('ERRO:', e.message); falhas++; }
  finally { await pool.end(); try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {} }
  console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
})();
