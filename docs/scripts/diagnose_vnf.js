// Diagnostic script to reproduce vNF and component sums
// Run with: node scripts/diagnose_vnf.js

const payload = /* the payload will be inserted here */ {
};

// To avoid very long insertion via patch, we'll require the payload from a temporary file if exists
const fs = require('fs');
let dataPayload = payload;
const tmpPath = 'scripts/diagnose_payload.json';
if (fs.existsSync(tmpPath)) {
  try { dataPayload = JSON.parse(fs.readFileSync(tmpPath,'utf8')); } catch(e){/* ignore */}
}

// If external payload is missing or invalid, provide a fallback payload for debugging
const defaultPayload = {
  dbclien: { codcli: '00117', nome: 'ATALIBA COM DE PCS E REP VEIC LTDA EPP' },
  dbvenda: { codvenda: '002439869', total: '5984.30', vlrfrete: '0.00', vlrseg: '0.00', vlrdesc: '15.70', vlracresc: '0.00' },
  dbitvenda: [
    { codprod: '414070', qtd: '10', prunit: '300.00', totalicms: '90.00', totalipi: '60.00', valorpis: '20.00', valorcofins: '50.00', valor_fcp: '10.00', totalproduto: '3000.00' },
    { codprod: '422098', qtd: '10', prunit: '260.00', totalicms: '70.00', totalipi: '40.00', valorpis: '10.00', valorcofins: '40.00', valor_fcp: '10.00', totalproduto: '2600.00' }
  ]
};

if (!Array.isArray(dataPayload?.dbitvenda)) {
  console.warn('Warning: external payload missing or invalid. Using built-in fallback payload for diagnostic.');
  dataPayload = defaultPayload;
}

function parseFloatSafe(v){
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '.'));
  return isNaN(n)?0:n;
}

function normalize(payload){
  const { dbclien, dbvenda, dbitvenda, dbfatura } = payload;

  if (!Array.isArray(dbitvenda)) throw new Error('dbitvenda must be array');

  const produtos = dbitvenda.map((item, index)=>{
    const qtde = Number(item.qtd ?? 1);
    const preco = Number(item.prunit ?? 0);
    const vProd = +(qtde * preco);
    const vICMS = parseFloatSafe(item.totalicms);
    const vIPI = parseFloatSafe(item.totalipi);
    const vPIS = parseFloatSafe(item.valorpis);
    const vCOFINS = parseFloatSafe(item.valorcofins);
    const vFCP = parseFloatSafe(item.valor_fcp);
    return {
      index,
      codprod: item.codprod,
      qtde, preco, vProd,
      icms: { vICMS },
      ipi: { vIPI },
      pis: { vPIS },
      cofins: { vCOFINS },
      fcp: { vFCP }
    };
  });

  const totalProdutos = +produtos.reduce((a,p)=>a + p.vProd, 0);
  const totalICMS = +produtos.reduce((a,p)=>a + p.icms.vICMS, 0);
  const totalIPI = +produtos.reduce((a,p)=>a + p.ipi.vIPI, 0);
  const totalPIS = +produtos.reduce((a,p)=>a + p.pis.vPIS, 0);
  const totalCOFINS = +produtos.reduce((a,p)=>a + p.cofins.vCOFINS, 0);
  const totalFCP = +produtos.reduce((a,p)=>a + p.fcp.vFCP, 0);

  const frete = parseFloatSafe(dbfatura?.vlrfrete ?? dbvenda?.vlrfrete);
  const seguro = parseFloatSafe(dbfatura?.vlrseg ?? dbvenda?.vlrseg);
  const descontoFatura = parseFloatSafe(dbfatura?.vlrdesc ?? dbvenda?.vlrdesc);
  const acrescimoFatura = parseFloatSafe(dbfatura?.vlracresc ?? dbvenda?.vlracresc);

  const descontoTotal = descontoFatura; // items discounts are zero in payload
  const acrescimoTotal = acrescimoFatura;

  const totalImpostos = totalICMS + totalIPI + totalPIS + totalCOFINS + totalFCP;

  const totalNF = totalProdutos + frete + seguro + acrescimoTotal - descontoTotal + totalImpostos;

  const vProdCalc = +totalProdutos.toFixed(2);
  const vFreteCalc = +frete;
  const vSegCalc = +seguro;
  const vDescCalc = +descontoTotal;
  const vIPICalc = +totalIPI;
  const vPISCalc = +totalPIS;
  const vCOFINSCalc = +totalCOFINS;
  const vICMSCalc = +totalICMS;
  const vFCPCalc = +totalFCP;
  const vOutroCalc = +acrescimoTotal;

  const calculatedVNF_includingICMS = +(vProdCalc + vFreteCalc + vSegCalc + vOutroCalc - vDescCalc + vIPICalc + vPISCalc + vCOFINSCalc + vICMSCalc + vFCPCalc).toFixed(2);
  const calculatedVNF_excludingICMS = +(vProdCalc + vFreteCalc + vSegCalc + vOutroCalc - vDescCalc + vIPICalc + vPISCalc + vCOFINSCalc + vFCPCalc).toFixed(2);

  return {
    produtos, totalProdutos, totalICMS, totalIPI, totalPIS, totalCOFINS, totalFCP,
    frete, seguro, descontoTotal, acrescimoTotal, totalImpostos, totalNF,
    calculatedVNF_includingICMS, calculatedVNF_excludingICMS
  };
}

try{
  const res = normalize(dataPayload);
  console.log('--- Totals ---');
  console.log('totalProdutos:', res.totalProdutos.toFixed(2));
  console.log('totalICMS:', res.totalICMS.toFixed(2));
  console.log('totalIPI:', res.totalIPI.toFixed(2));
  console.log('totalPIS:', res.totalPIS.toFixed(2));
  console.log('totalCOFINS:', res.totalCOFINS.toFixed(2));
  console.log('totalFCP:', res.totalFCP.toFixed(2));
  console.log('frete:', res.frete.toFixed(2));
  console.log('seguro:', res.seguro.toFixed(2));
  console.log('descontoTotal:', res.descontoTotal.toFixed(2));
  console.log('acrescimoTotal:', res.acrescimoTotal.toFixed(2));
  console.log('totalImpostos:', res.totalImpostos.toFixed(2));
  console.log('totalNF (normalizarPayload):', res.totalNF.toFixed(2));
  console.log('calculatedVNF_includingICMS:', res.calculatedVNF_includingICMS.toFixed(2));
  console.log('calculatedVNF_excludingICMS:', res.calculatedVNF_excludingICMS.toFixed(2));

  // Compare differences
  console.log('\n--- Differences ---');
  console.log('totalNF - calc_includingICMS =', (res.totalNF - res.calculatedVNF_includingICMS).toFixed(2));
  console.log('totalNF - calc_excludingICMS =', (res.totalNF - res.calculatedVNF_excludingICMS).toFixed(2));

  // Show per item small table of vProd and taxes
  console.log('\n--- Per-item sample (index, vProd, vICMS, vIPI, vPIS, vCOFINS) ---');
  res.produtos.forEach(p=>{
    console.log(p.index, p.vProd.toFixed(2), p.icms.vICMS.toFixed(2), p.ipi.vIPI.toFixed(2), p.pis.vPIS.toFixed(2), p.cofins.vCOFINS.toFixed(2));
  });

} catch (err) {
  console.error('Error running diagnostic:', err);
}
