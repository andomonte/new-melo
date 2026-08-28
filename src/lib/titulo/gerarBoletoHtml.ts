// src/lib/titulo/gerarBoletoHtml.ts
//
// Gera o HTML do BOLETO bancário da MELO (Bradesco 237 / Santander 033) — fiel aos
// modelos impressos (Documentos diversos/BOLETO BRADESCO|SANTANDER MELO). Duas partes:
// "Recibo do Cliente" (topo) + "Ficha de Compensação" (base), com linha digitável e
// código de barras Interleaved 2of5 (padrão febraban, 44 dígitos).
//
// Este módulo é APENAS o LAYOUT: recebe os campos já calculados (linha digitável,
// código de barras, nosso número, agência/cedente, carteira) — o cálculo febraban
// (lib/boleto) é responsabilidade do chamador (endpoint), por banco.

import { readFileSync } from 'fs';
import path from 'path';

export interface BoletoData {
  bancoNome: string; // "Bradesco" | "Banco Santander"
  bancoCodigoDisplay: string; // "237-2" | "033"
  linhaDigitavel: string; // "23792.36801 90000.077348 ..."
  codigoBarras: string; // 44 dígitos (para o barcode ITF)
  nossoNumero: string; // "09 / 00000773464-9" | "0306667 3"
  agenciaCedente: string; // "2368-0 / 0000338-7" | "1403 / 0009560"
  carteira: string; // "09" | "COBRANCA SIMPLES - RCR"
  cip?: string;
  localPagamento: string; // "Pagável em qualquer agência ... agências do Bradesco."
  numeroDocto: string;
  especieDocto?: string; // "DM"
  aceite?: string; // "N"
  vencimento: string;
  valorDocumento: number;
  dataEmissao?: string | null;
  dataProcessamento?: string | null;
  moraDia: number; // valor da mora por dia (R$)
  // Sacado
  sacadoCodigo: string;
  sacadoNome: string;
  sacadoCnpj?: string;
  sacadoEndereco?: string;
  parcela?: string; // "1/5" — nº da parcela / total de parcelas
}

const MELO = {
  razao: 'MELO DISTRIBUIDORA DE PEÇAS LTDA.',
  razaoCurta: 'MELO DISTRIBUIDORA DE PECAS LTDA',
  cnpj: '04.618.302/0001-89',
  slogan: 'SEU DISTRIBUIDOR 100% ATACADO',
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
const dataBR = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

function instrucoesPadrao(moraDia: number): string {
  const linhas = [
    ':: Senhor(a) caixa, não receber em CHEQUES.',
    ':: Senhor(a) caixa, não receber valor menor que "valor do documento".',
    ':: Senhor(a) caixa, não dispensar mora e multa após a data de vencimento.',
    `:: Após o vencimento cobrar mora de R$ ${brl(moraDia)} por dia de atraso.`,
    ':: Título sujeito a protesto à partir de 11 dias após vencimento.',
    ':: Pagamento não realizado na Rede Bancária será cobrada tarifa de R$ 7.00.',
  ];
  return linhas.map((l) => `<div class="instr-linha">${l}</div>`).join('');
}

function bloco(b: BoletoData): string {
  const sacadoLinha = `(${b.sacadoCodigo}) ${b.sacadoNome}${b.sacadoCnpj ? ` - CNPJ ${b.sacadoCnpj}` : ''}`;
  const end = b.sacadoEndereco ? `<div class="end">${b.sacadoEndereco}</div>` : '';
  return `
  <div class="boleto">
    <!-- ===================== RECIBO DO CLIENTE ===================== -->
    <div class="topo">
      <div class="banco-linha">
        <span class="banco">${b.bancoNome}</span><span class="agc">${b.bancoCodigoDisplay}</span>
      </div>
      <div class="topo-dir">
        <div class="razao-top">${MELO.razao}</div>
        <div class="slogan">${MELO.slogan}</div>
      </div>
    </div>
    <div class="recibo-cli-lbl">RECIBO DO CLIENTE</div>
    <div class="rot">Nome do Cliente</div>
    <div class="cli-nome">${sacadoLinha}</div>
    ${end}
    <div class="recibo-linha">
      <span><span class="r-in">Número Docto.:</span> <b>${b.numeroDocto}</b></span>
      ${b.parcela ? `<span><span class="r-in">Parcela:</span> <b>${b.parcela}</b></span>` : ''}
      <span><span class="r-in">Data do Vencto:</span> <b>${dataBR(b.vencimento)}</b></span>
      <span><span class="r-in">Valor Documento:</span> <b>${brl(b.valorDocumento)}</b></span>
      <span class="nn"><span class="r-in">Nosso Número:</span> <b>${b.nossoNumero}</b></span>
    </div>
    <div class="autent-r">Autenticação Mecânica (no verso)</div>

    <div class="tracejado"></div>

    <!-- ===================== FICHA DE COMPENSAÇÃO ===================== -->
    <div class="ficha-head">
      <div class="banco-linha"><span class="banco">${b.bancoNome}</span><span class="agc">${b.bancoCodigoDisplay}</span></div>
      <div class="linha-dig">${b.linhaDigitavel}</div>
    </div>

    <table class="ficha">
      <tr>
        <td class="c" colspan="5"><span class="r">Local de Pagamento</span>${b.localPagamento}</td>
        <td class="c"><span class="r">Vencimento</span><div class="v-dir">${dataBR(b.vencimento)}</div></td>
      </tr>
      <tr>
        <td class="c" colspan="5"><span class="r">Cedente</span><b>${MELO.razaoCurta}</b> &nbsp;&nbsp; CNPJ: ${MELO.cnpj}</td>
        <td class="c"><span class="r">Agência / Cód.Cedente</span><div class="v-dir">${b.agenciaCedente}</div></td>
      </tr>
      <tr>
        <td class="c"><span class="r">Data de Emissão</span>${dataBR(b.dataEmissao)}</td>
        <td class="c"><span class="r">Número Docto</span>${b.numeroDocto}${b.parcela ? ` · Parc. ${b.parcela}` : ''}</td>
        <td class="c"><span class="r">Espécie Docto</span>${b.especieDocto ?? 'DM'}</td>
        <td class="c"><span class="r">Aceite</span>${b.aceite ?? 'N'}</td>
        <td class="c"><span class="r">Data Processamento</span>${dataBR(b.dataProcessamento || b.dataEmissao)}</td>
        <td class="c"><span class="r">Nosso Número</span><div class="v-dir">${b.nossoNumero}</div></td>
      </tr>
      <tr>
        <td class="c"><span class="r">Uso do Banco</span></td>
        <td class="c"><span class="r">CIP</span>${b.cip ?? ''}</td>
        <td class="c"><span class="r">Carteira</span>${b.carteira}</td>
        <td class="c"><span class="r">Moeda</span>R$</td>
        <td class="c"><span class="r">Quantidade</span></td>
        <td class="c"><span class="r">Valor de Mora</span><div class="v-dir">${brl(b.moraDia)}</div></td>
      </tr>
      <tr>
        <td class="c instr" colspan="5" rowspan="4">
          <span class="r">Instruções(Todas informações deste bloqueto são de exclusiva responsabilidade do cedente)</span>
          ${instrucoesPadrao(b.moraDia)}
        </td>
        <td class="c val"><span class="r">(=) Valor do Docto</span><div class="v-dir"><b>${brl(b.valorDocumento)}</b></div></td>
      </tr>
      <tr><td class="c val"><span class="r">(-) Desconto/Abatimento</span><div class="v-dir">0,00</div></td></tr>
      <tr><td class="c val"><span class="r">(+) Mora / Multa</span></td></tr>
      <tr><td class="c val"><span class="r">(=) Valor Cobrado</span></td></tr>
      <tr>
        <td class="c" colspan="5" style="border-top:1px solid #000;"><span class="r">Sacado</span><b>${sacadoLinha}</b>${b.sacadoEndereco ? `<div class="end2">${b.sacadoEndereco}</div>` : ''}</td>
        <td class="c" style="border-top:1px solid #000;"></td>
      </tr>
    </table>

    <div class="rodape">
      <div class="sacador"><span class="r">Sacador / Avalista</span></div>
      <div class="autent-ficha">Autenticação Mecânica / Ficha de Compensação</div>
    </div>
    <div class="barwrap"><svg class="barcode itf" data-valor="${b.codigoBarras}"></svg></div>
    <div class="tracejado"></div>
  </div>`;
}

export function gerarBoletoHtml(boletos: BoletoData[]): string {
  const blocos = boletos.map(bloco).join('\n<div class="quebra"></div>\n');
  const barcodeScript = jsBarcodeSrc()
    ? `<script>${jsBarcodeSrc()}</script>
<script>try{document.querySelectorAll('svg.barcode.itf').forEach(function(el){JsBarcode(el,el.getAttribute('data-valor'),{format:'ITF',displayValue:false,margin:0,height:50,width:1.1});});}catch(e){}</script>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; margin:0; padding:6mm; font-size:10px; }
  .boleto { width:100%; }
  .quebra { page-break-after: always; }
  .topo { display:flex; justify-content:space-between; align-items:flex-start; }
  .banco-linha { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:bold; border-bottom:2px solid #000; padding-bottom:1px; }
  .banco-linha .agc { border-left:2px solid #000; border-right:2px solid #000; padding:0 10px; }
  .topo-dir { text-align:right; }
  .razao-top { font-weight:bold; font-size:12px; }
  .slogan { font-weight:bold; font-size:12px; }
  .recibo-cli-lbl { text-align:right; font-weight:bold; font-size:12px; border-bottom:2px solid #000; display:inline-block; float:right; }
  .rot { font-size:8px; margin-top:4px; clear:both; }
  .cli-nome { font-weight:bold; font-size:11px; }
  .end, .end2 { font-size:10px; font-weight:normal; }
  .recibo-linha { display:flex; gap:20px; align-items:baseline; margin-top:4px; flex-wrap:wrap; }
  .recibo-linha .nn { margin-left:auto; }
  .r-in { font-size:8px; }
  .autent-r { text-align:right; font-size:8px; }
  .tracejado { border-top:1px dashed #000; margin:8px 0; }
  .ficha-head { display:flex; justify-content:space-between; align-items:flex-end; }
  .linha-dig { font-weight:bold; font-size:13px; }
  table.ficha { width:100%; border-collapse:collapse; margin-top:2px; }
  table.ficha td { border:1px solid #000; vertical-align:top; padding:2px 4px; height:24px; }
  .r { display:block; font-size:7.5px; line-height:1.1; }
  .v-dir { text-align:right; font-size:12px; padding-right:2px; }
  td.val { text-align:left; }
  .instr .instr-linha { font-size:10px; line-height:1.45; }
  .rodape { display:flex; justify-content:space-between; align-items:flex-end; margin-top:2px; }
  .sacador { flex:1; border-top:1px solid #000; padding-top:1px; margin-right:20px; }
  .autent-ficha { font-size:8px; }
  .barwrap { margin-top:6px; }
  svg.barcode { height:50px; }
</style></head><body>
${blocos}
${barcodeScript}
</body></html>`;
}
