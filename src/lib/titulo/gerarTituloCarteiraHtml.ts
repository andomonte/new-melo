// src/lib/titulo/gerarTituloCarteiraHtml.ts
//
// Gera o HTML do "Título em Carteira" da MELO — fiel ao modelo impresso
// (Documentos diversos/CARTEIRA MELO). Duas partes: "Recibo do Cliente" (topo) e
// "Ficha de Compensação" (base), separadas por linha tracejada, com código de barras.
//
// Mapeamento validado contra dbreceb (título 102002795):
//   Nosso Número = dbreceb.cod_receb · Número Docto = nro_doc · Vencimento = dt_venc
//   Valor Documento = valor_pgto · Sacado = dbclien(codcli) · forma_fat='4'/banco='9'
//   Valor de Mora (1 dia, 8% a.m.) = round(valor_pgto * 8/3000, 2)  [conf. modelo 474,46→1,27]

import { readFileSync } from 'fs';
import path from 'path';

export interface TituloCarteiraData {
  nossoNumero: string; // cod_receb
  numeroDocto: string; // nro_doc
  vencimento: string; // ISO ou yyyy-mm-dd
  valorDocumento: number;
  dataDocumento?: string | null; // dt_emissao
  dataProcessamento?: string | null;
  sacadoCodigo: string; // codcli
  sacadoNome: string;
  sacadoEndereco?: string; // logradouro, bairro, cidade-UF, CEP
}

// ---- Constantes MELO (fixas do modelo) ----
const MELO = {
  razao: 'MELO DISTRIBUIDORA DE PEÇAS LTDA.',
  razaoCurta: 'MELO DISTRIBUIDORA DE PECAS LTDA',
  cnpj: '04.618.302/0001-89',
  slogan: 'SEU DISTRIBUIDOR 100% ATACADO',
  localPagamento: 'Pagável somente na Melo Distribuidora de Peças LTDA.',
  cip: '775',
  carteira: '09',
  moeda: 'R$',
  agenciaCodCedente: '000-0',
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
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

/** Valor de Mora do dia (8% a.m. → dia = valor * 8/3000). */
export function valorMoraDia(valor: number): number {
  return Math.round((Number(valor) || 0) * (8 / 3000) * 100) / 100;
}

function bloco(t: TituloCarteiraData): string {
  const mora = valorMoraDia(t.valorDocumento);
  const sacadoLinha2 = t.sacadoEndereco ? `<div class="sac-end">${t.sacadoEndereco}</div>` : '';
  return `
  <div class="titulo">
    <!-- ===================== RECIBO DO CLIENTE ===================== -->
    <div class="recibo">
      <div class="topo">
        <div class="topo-esq">
          <div class="razao">${MELO.razao}</div>
          <div class="tt"><b>Título em Carteira</b><span class="agc">${MELO.agenciaCodCedente}</span></div>
        </div>
        <div class="topo-dir">
          <div class="slogan">${MELO.slogan}</div>
          <div class="recibo-cli">RECIBO DO CLIENTE</div>
        </div>
      </div>
      <div class="rot">Nome do Cliente</div>
      <div class="cli-nome">(${t.sacadoCodigo}) ${t.sacadoNome}</div>
      ${sacadoLinha2}
      <div class="recibo-linha">
        <span><span class="rot-inline">Número Docto.:</span> <b>${t.numeroDocto}</b></span>
        <span><span class="rot-inline">Data do Vencto:</span> <b>${dataBR(t.vencimento)}</b></span>
        <span><span class="rot-inline">Valor Documento:</span> <b>${brl(t.valorDocumento)}</b></span>
        <span class="autent">Autenticação Mecânica (no verso)</span>
      </div>
    </div>

    <div class="tracejado"></div>

    <!-- ===================== FICHA DE COMPENSAÇÃO ===================== -->
    <div class="ficha-head">
      <div class="tt"><b>Título em Carteira</b><span class="agc">${MELO.agenciaCodCedente}</span></div>
      <div class="nn">${t.nossoNumero}</div>
    </div>

    <table class="ficha">
      <tr>
        <td class="c" colspan="5"><span class="r">Local de Pagamento</span>${MELO.localPagamento}</td>
        <td class="c"><span class="r">Vencimento</span><div class="v-dir">${dataBR(t.vencimento)}</div></td>
      </tr>
      <tr>
        <td class="c" colspan="5"><span class="r">Beneficiário</span><b>${MELO.razaoCurta}</b> &nbsp;&nbsp; CNPJ: ${MELO.cnpj}</td>
        <td class="c"><span class="r">Agência / Cód.Cedente</span></td>
      </tr>
      <tr>
        <td class="c"><span class="r">Data do Documento</span>${dataBR(t.dataDocumento)}</td>
        <td class="c"><span class="r">Número Docto</span>${t.numeroDocto}</td>
        <td class="c"><span class="r">Espécie Docto</span></td>
        <td class="c"><span class="r">Aceite</span></td>
        <td class="c"><span class="r">Data Processamento</span>${dataBR(t.dataProcessamento || t.dataDocumento)}</td>
        <td class="c"><span class="r">Cart./Nosso Número</span></td>
      </tr>
      <tr>
        <td class="c"><span class="r">Uso do Banco</span></td>
        <td class="c"><span class="r">CIP</span>${MELO.cip}</td>
        <td class="c"><span class="r">Carteira</span>${MELO.carteira}</td>
        <td class="c"><span class="r">Moeda</span>${MELO.moeda}</td>
        <td class="c"><span class="r">Quantidade</span></td>
        <td class="c"><span class="r">Valor de Mora</span>${brl(mora)}</td>
      </tr>
      <tr>
        <td class="c instr" colspan="5" rowspan="5">
          <span class="r">Instruções</span>
          <div class="instr-linha"><b>:: Dados Bancários SANTANDER</b></div>
          <div class="instr-linha">:: Agência: 1403 Conta Corrente: 13002332-4&nbsp;&nbsp;Chave PIX: CNPJ:04.618.302/00001-89</div>
          <div class="instr-linha">::</div>
          <div class="instr-linha"><b>:: Dados Bancários BRADESCO</b></div>
          <div class="instr-linha">:: Agência: 2368 Conta Corrente: 338-7&nbsp;&nbsp;&nbsp;&nbsp;Chave PIX: AGENCIA E CONTA</div>
          <div class="instr-linha">:: Pagamento deve ser realizado somente na MELO DISTRIBUIDORA DE PEÇAS Ltda.</div>
        </td>
        <td class="c val"><span class="r">(+) Valor do Docto</span><div class="v-dir"><b>${brl(t.valorDocumento)}</b></div></td>
      </tr>
      <tr><td class="c val"><span class="r">(-) Desconto</span><div class="v-dir">0,00</div></td></tr>
      <tr><td class="c val"><span class="r">(-) Outras Deduções</span></td></tr>
      <tr><td class="c val"><span class="r">(+) Mora / Multa</span></td></tr>
      <tr><td class="c val"><span class="r">(+) Outros Acréscimos</span></td></tr>
      <tr>
        <td class="c" colspan="5" style="border-top:1px solid #000;"><span class="r">Sacado</span><b>(${t.sacadoCodigo}) ${t.sacadoNome}</b>${t.sacadoEndereco ? `<div class="sac-end2">${t.sacadoEndereco}</div>` : ''}</td>
        <td class="c val" style="border-top:1px solid #000;"><span class="r">(=) Valor Cobrado</span></td>
      </tr>
    </table>

    <div class="rodape">
      <div class="sacador"><span class="r">Sacador / Avalista</span></div>
      <div class="autent-ficha">Autenticação Mecânica / Ficha de Compensação</div>
    </div>
    <div class="barwrap"><svg class="barcode" data-valor="${t.nossoNumero}"></svg></div>
    <div class="tracejado"></div>
  </div>`;
}

/** Gera o HTML completo (1+ títulos). Cada título ocupa seu bloco; usar page-break entre eles. */
export function gerarTituloCarteiraHtml(titulos: TituloCarteiraData[]): string {
  const blocos = titulos.map(bloco).join('\n<div class="quebra"></div>\n');
  const barcodeScript = jsBarcodeSrc()
    ? `<script>${jsBarcodeSrc()}</script>
<script>try{document.querySelectorAll('svg.barcode').forEach(function(el){JsBarcode(el,el.getAttribute('data-valor'),{format:'CODE128',displayValue:false,margin:0,height:45,width:1.6});});}catch(e){}</script>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; margin:0; padding:6mm; font-size:10px; }
  .titulo { width:100%; }
  .quebra { page-break-after: always; }
  .topo { display:flex; justify-content:space-between; align-items:flex-start; }
  .razao { font-size:15px; font-weight:bold; }
  .tt { font-size:15px; display:flex; align-items:center; gap:8px; margin-top:2px; }
  .tt .agc { border-left:2px solid #000; border-right:2px solid #000; padding:0 8px; font-weight:bold; }
  .topo-dir { text-align:right; }
  .slogan { font-size:13px; font-weight:bold; }
  .recibo-cli { font-size:13px; font-weight:bold; border-bottom:2px solid #000; display:inline-block; padding-bottom:2px; }
  .rot { font-size:8px; margin-top:4px; }
  .cli-nome { font-weight:bold; font-size:11px; }
  .sac-end { font-size:10px; }
  .recibo-linha { display:flex; gap:22px; align-items:baseline; margin-top:6px; }
  .rot-inline { font-size:8px; }
  .recibo-linha .autent { margin-left:auto; font-size:8px; }
  .tracejado { border-top:1px dashed #000; margin:8px 0; }
  .ficha-head { display:flex; justify-content:space-between; align-items:flex-end; }
  .nn { font-weight:bold; font-size:13px; }
  table.ficha { width:100%; border-collapse:collapse; margin-top:2px; }
  table.ficha td { border:1px solid #000; vertical-align:top; padding:2px 4px; height:26px; }
  .r { display:block; font-size:7.5px; color:#000; line-height:1.1; }
  .v-dir { text-align:right; font-size:12px; padding-right:2px; }
  td.val { text-align:left; }
  td.val .v-dir { font-size:12px; }
  .instr .instr-linha { font-size:10px; line-height:1.5; }
  .sac-end2 { font-weight:normal; font-size:10px; }
  .rodape { display:flex; justify-content:space-between; align-items:flex-end; margin-top:2px; }
  .sacador { flex:1; border-top:1px solid #000; padding-top:1px; margin-right:20px; }
  .autent-ficha { font-size:8px; }
  .barwrap { text-align:right; margin-top:4px; }
  svg.barcode { height:45px; }
</style></head><body>
${blocos}
${barcodeScript}
</body></html>`;
}
