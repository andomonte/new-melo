// src/lib/titulo/gerarReciboHtml.ts
//
// Gera o HTML do RECIBO da MELO — fiel ao modelo impresso (Documentos diversos/
// RECIBO MELO). É a forma_fat='1' (recibo), documento interno da MELO (banco='9'),
// com cod_receb como número (igual carteira), + valor por extenso e assinatura.

import { readFileSync } from 'fs';
import path from 'path';

export interface ReciboData {
  numero: string; // cod_receb (canto superior direito)
  numeroDocto: string; // nro_doc (REFERENTE A)
  valor: number;
  dataEmissao?: string | null;
  clienteCodigo: string;
  clienteNome: string;
  clienteEndereco?: string;
  clienteCpfCnpj?: string;
}

// Cabeçalho fixo MELO (do modelo do recibo).
const MELO = {
  razao: 'MELO DISTRIBUIDORA DE PECAS LTDA',
  endereco: 'RUA TEFE, 487 - PC 14 JANEIRO',
  fone: 'FONE: (92)2121-4000  FAX: (92)2121-4099',
  cnpjIe: 'CNPJ: 04618302000189 - Insc. Est.: 041647815',
  email: 'E-MAIL: melopecas@melopecas.com.br',
  cidade: 'MANAUS',
};

let _jsbarcode: string | null = null;
function jsBarcodeSrc(): string {
  if (_jsbarcode != null) return _jsbarcode;
  try {
    _jsbarcode = readFileSync(
      path.resolve(process.cwd(), 'node_modules/jsbarcode/dist/JsBarcode.all.min.js'),
      'utf8',
    );
  } catch {
    _jsbarcode = '';
  }
  return _jsbarcode;
}

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
function dataExtenso(s?: string | null): string {
  if (!s) return MELO.cidade + ',';
  const d = new Date(s);
  if (isNaN(d.getTime())) return `${MELO.cidade},`;
  return `${MELO.cidade}, ${d.getUTCDate()} DE ${MESES[d.getUTCMonth()]} DE ${d.getUTCFullYear()}`;
}

// ---- Valor por extenso (pt-BR) ----
const UNID = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE'];
const DEZ_A_DEZENOVE = ['DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE'];
const DEZENAS = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA'];
const CENTENAS = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS'];

function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CEM';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNID[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} E ${UNID[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' E ');
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'ZERO';
  const milhoes = Math.floor(n / 1000000);
  const milhares = Math.floor((n % 1000000) / 1000);
  const centenas = n % 1000;
  const partes: string[] = [];
  if (milhoes > 0) partes.push(milhoes === 1 ? 'UM MILHÃO' : `${ate999(milhoes)} MILHÕES`);
  if (milhares > 0) partes.push(milhares === 1 ? 'MIL' : `${ate999(milhares)} MIL`);
  if (centenas > 0) partes.push(ate999(centenas));
  // Conector do ÚLTIMO grupo: "e" só se a última parcela for < 100 ou centena
  // redonda (ex.: "MIL E QUINHENTOS", "MIL E DOIS"); senão espaço ("MIL QUATROCENTOS
  // E DOIS"). As demais junções levam "E".
  if (partes.length <= 1) return partes.join(' E ');
  const ultimoValor = centenas > 0 ? centenas : milhares > 0 ? milhares : milhoes;
  const conector = ultimoValor < 100 || ultimoValor % 100 === 0 ? ' E ' : ' ';
  const cabeca = partes.slice(0, -1).join(' E ');
  return `${cabeca}${conector}${partes[partes.length - 1]}`;
}

/** Valor por extenso em reais/centavos (ex.: "TREZENTOS E NOVENTA E SEIS REAIS"). */
export function valorPorExtenso(valor: number): string {
  const v = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(v / 100);
  const centavos = v % 100;
  const partes: string[] = [];
  if (reais > 0) partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? 'REAL' : 'REAIS'}`);
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'CENTAVO' : 'CENTAVOS'}`);
  if (partes.length === 0) return 'ZERO REAIS';
  return partes.join(' E ');
}

function bloco(r: ReciboData): string {
  const cliente = `${r.clienteCodigo} - ${r.clienteNome}`;
  return `
  <div class="recibo">
    <div class="cabecalho">
      <div class="logo">MELO</div>
      <div class="empresa">
        <div class="razao">${MELO.razao}</div>
        <div>${MELO.endereco}</div>
        <div>${MELO.fone}</div>
        <div>${MELO.cnpjIe}</div>
        <div>${MELO.email}</div>
      </div>
      <div class="numero">${r.numero}</div>
    </div>

    <div class="titulo-linha">
      <span class="rec">RECIBO</span>
      <span class="valor">R$ ${brl(r.valor)}</span>
    </div>

    <div class="recebi">RECEBI(EMOS) DO(S) SR.(S), &nbsp;&nbsp; ${cliente}</div>
    <div class="qtd-lbl">A QUANTIDADE DE:</div>
    <div class="box extenso">* ${valorPorExtenso(r.valor)} *</div>

    <div class="ref">
      <div class="ref-lbl">REFERENTE A:</div>
      <div class="ref-doc">${r.numeroDocto}</div>
    </div>

    <div class="rodape">
      <div class="dados">
        <div>N O M E : ${cliente}</div>
        <div>ENDEREÇO: ${r.clienteEndereco || ''}</div>
        <div>CPF/CNPJ: ${r.clienteCpfCnpj || ''}</div>
      </div>
      <div class="data">${dataExtenso(r.dataEmissao)}</div>
    </div>

    <div class="assina-linha">
      <svg class="barcode" data-valor="${r.numero}"></svg>
      <div class="assinatura"><div class="linha-ass"></div>ASSINATURA</div>
    </div>
  </div>`;
}

export function gerarReciboHtml(recibos: ReciboData[]): string {
  const blocos = recibos.map(bloco).join('\n<div class="quebra"></div>\n');
  const barcodeScript = jsBarcodeSrc()
    ? `<script>${jsBarcodeSrc()}</script>
<script>try{document.querySelectorAll('svg.barcode').forEach(function(el){JsBarcode(el,el.getAttribute('data-valor'),{format:'CODE128',displayValue:false,margin:0,height:40,width:1.4});});}catch(e){}</script>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color:#000; margin:0; padding:8mm; font-size:12px; }
  .recibo { border:1.5px solid #000; border-radius:14px; padding:16px 22px; }
  .quebra { page-break-after: always; }
  .cabecalho { display:grid; grid-template-columns:130px 1fr 120px; align-items:start; gap:10px; }
  .logo { font-weight:bold; font-size:34px; letter-spacing:2px; }
  .empresa { text-align:center; font-size:11px; line-height:1.35; }
  .empresa .razao { font-weight:bold; text-decoration:underline; font-size:12px; }
  .numero { text-align:right; font-size:13px; }
  .titulo-linha { display:flex; justify-content:center; align-items:center; gap:120px; margin:18px 0 14px; }
  .titulo-linha .rec { font-weight:bold; letter-spacing:2px; }
  .titulo-linha .valor { font-weight:bold; }
  .recebi { margin-top:6px; }
  .qtd-lbl { margin-top:8px; }
  .box { border:1px solid #000; border-radius:8px; padding:8px 10px; margin-top:2px; min-height:34px; }
  .extenso { background:#f2f2f2; font-weight:bold; }
  .ref { border:1px solid #000; border-radius:8px; padding:8px 10px; margin-top:10px; min-height:70px; }
  .ref-lbl { }
  .ref-doc { margin-top:6px; padding-left:24px; }
  .rodape { display:flex; justify-content:space-between; align-items:flex-start; margin-top:14px; }
  .dados { line-height:1.5; }
  .data { text-align:right; padding-top:8px; }
  .assina-linha { display:flex; justify-content:space-between; align-items:flex-end; margin-top:14px; }
  svg.barcode { height:40px; }
  .assinatura { text-align:center; width:340px; }
  .assinatura .linha-ass { border-top:1px solid #000; margin-bottom:2px; }
</style></head><body>
${blocos}
${barcodeScript}
</body></html>`;
}
