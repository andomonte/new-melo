const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

function toNumber(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function main() {
  const argPath = process.argv[2];
  const xmlPath = argPath ? path.resolve(argPath) : path.resolve(__dirname, 'diagnose_output.xml');
  if (!argPath) console.log('Nenhum caminho informado. Usando scripts/diagnose_output.xml como fallback.');
  if (!fs.existsSync(xmlPath)) {
    console.error('Arquivo XML não encontrado em', xmlPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(xmlPath, 'utf8');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  const parsed = await parser.parseStringPromise(xml);

  const infNFe = parsed.NFe && parsed.NFe.infNFe ? parsed.NFe.infNFe : null;
  if (!infNFe) {
    console.error('XML não contém NFe.infNFe');
    process.exit(1);
  }

  const det = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []);

  let sum_vProd = 0;
  let sum_vICMS = 0;
  let sum_vIPI = 0;
  let sum_vPIS = 0;
  let sum_vCOFINS = 0;
  let sum_vFCP = 0;

  det.forEach((d, idx) => {
    const prod = d.prod || {};
    const imposto = d.imposto || {};
    const vProd = toNumber(prod.vProd);
    sum_vProd += vProd;

    // ICMS path: imposto.ICMS.ICMS00.vICMS (or other tags)
    let vICMS = 0;
    try {
      const ICMS = imposto.ICMS || {};
      const ICMSKey = Object.keys(ICMS).find(k => k.startsWith('ICMS'));
      if (ICMSKey) {
        vICMS = toNumber(ICMS[ICMSKey].vICMS);
      }
    } catch (e) { vICMS = 0; }
    sum_vICMS += vICMS;

    // IPI
    let vIPI = 0;
    try {
      vIPI = toNumber(imposto.IPI && imposto.IPI.IPITrib && imposto.IPI.IPITrib.vIPI);
    } catch (e) { vIPI = 0; }
    sum_vIPI += vIPI;

    // PIS
    let vPIS = 0;
    try {
      vPIS = toNumber(imposto.PIS && imposto.PIS.PISAliq && imposto.PIS.PISAliq.vPIS);
    } catch (e) { vPIS = 0; }
    sum_vPIS += vPIS;

    // COFINS
    let vCOFINS = 0;
    try {
      vCOFINS = toNumber(imposto.COFINS && imposto.COFINS.COFINSAliq && imposto.COFINS.COFINSAliq.vCOFINS);
    } catch (e) { vCOFINS = 0; }
    sum_vCOFINS += vCOFINS;

    // FCP (se existir no imposto ou fcp)
    try {
      const fcp = imposto.fcp;
      if (fcp && fcp.vFCP) sum_vFCP += toNumber(fcp.vFCP);
    } catch (e) {}
  });

  // Totais declarados
  const ICMSTot = infNFe.total && infNFe.total.ICMSTot ? infNFe.total.ICMSTot : {};
  const declared = {
    vProd: round2(toNumber(ICMSTot.vProd)),
    vFrete: round2(toNumber(ICMSTot.vFrete)),
    vSeg: round2(toNumber(ICMSTot.vSeg)),
    vDesc: round2(toNumber(ICMSTot.vDesc)),
    vII: round2(toNumber(ICMSTot.vII)),
    vIPI: round2(toNumber(ICMSTot.vIPI)),
    vIPIDevol: round2(toNumber(ICMSTot.vIPIDevol)),
    vPIS: round2(toNumber(ICMSTot.vPIS)),
    vCOFINS: round2(toNumber(ICMSTot.vCOFINS)),
    vOutro: round2(toNumber(ICMSTot.vOutro)),
    vICMS: round2(toNumber(ICMSTot.vICMS)),
    vNF: round2(toNumber(ICMSTot.vNF)),
  };

  const recomputed = {
    vProd: round2(sum_vProd),
    vICMS: round2(sum_vICMS),
    vIPI: round2(sum_vIPI),
    vPIS: round2(sum_vPIS),
    vCOFINS: round2(sum_vCOFINS),
    vFCP: round2(sum_vFCP),
  };

  // Recompute vNF with the same formula used in gerarXml
  const recomputed_vNF = round2(
    recomputed.vProd + toNumber(ICMSTot.vFrete) + toNumber(ICMSTot.vSeg) + toNumber(ICMSTot.vOutro) - toNumber(ICMSTot.vDesc) + toNumber(ICMSTot.vII) + recomputed.vIPI + toNumber(ICMSTot.vIPIDevol) + recomputed.vPIS + recomputed.vCOFINS + recomputed.vICMS
  );

  console.log('--- Validação de Totais do XML ---');
  console.log('Declarado em <total.ICMSTot>:');
  console.table(declared);

  console.log('Recomputado a partir dos itens (soma de det):');
  console.table(recomputed);

  console.log('vNF declarado:', declared.vNF.toFixed(2));
  console.log('vNF recomputado:', recomputed_vNF.toFixed(2));

  const diff = Math.abs(declared.vNF - recomputed_vNF);
  if (diff > 0.009) {
    console.error('\nERRO: há diferença entre vNF declarado e recomputado de', diff.toFixed(4));
    console.error('Possíveis causas: arredondamento por item, inclusão/exclusão de ICMS ou FCP, ou valores usados na assinatura diferentes dos do XML gerado.');
    process.exitCode = 2;
  } else {
    console.log('\nOK: vNF bate com o recomputado (diferença <= 0.01)');
  }

  // Also check pag.detPag.vPag equals vNF
  const vPag = toNumber(infNFe.pag && infNFe.pag.detPag && infNFe.pag.detPag.vPag);
  if (Math.abs(vPag - declared.vNF) > 0.009) {
    console.error('ERRO: pag.detPag.vPag difere de total.ICMSTot.vNF -> vPag:', vPag, 'vNF:', declared.vNF);
    process.exitCode = 3;
  } else {
    console.log('OK: pag.detPag.vPag == total.ICMSTot.vNF');
  }
}

main().catch(err => {
  console.error('Erro ao validar:', err && err.stack ? err.stack : err);
  process.exit(1);
});
