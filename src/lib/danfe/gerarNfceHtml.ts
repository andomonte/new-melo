// src/lib/danfe/gerarNfceHtml.ts
//
// Gerador da DANFE NFC-e (mod. 65 / consumidor) em HTML — layout fiel ao MELO.
// Recebe os MESMOS dados que gerarPreviewCupomFiscal (fatura, produtos, venda,
// dadosEmpresa, dadosNFe) e devolve HTML pronto para <iframe srcdoc> ou puppeteer.
// O jsPDF (gerarPDFCupomFiscal) segue INTACTO como fallback.

type Any = Record<string, any>;

const getValue = (v: any, d = ''): string =>
  v !== null && v !== undefined && v !== '' ? String(v) : String(d);
const num = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const formatValue = (v: any): string =>
  num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercent = formatValue;
const esc = (s: any): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nbsp = (s: string) => (s && s.trim() ? esc(s) : '&nbsp;');
const chaveEmGrupos = (chave: string): string =>
  (getValue(chave).replace(/\D/g, '').match(/.{1,4}/g) || []).join(' ') || getValue(chave);

export interface NfceHtmlOpts {
  logoSrc?: string;
  qrCodeDataUrl?: string; // data:image/png;... do QR (gerado no cliente)
  marcaDagua?: string;
  homologacao?: boolean; // ambiente de homologação → força "SEM VALOR FISCAL"
}

const HOMOLOG_NOME = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

export function gerarNfceHtml(
  fatura: Any,
  produtos: Any[],
  venda: Any,
  dadosEmpresa: Any,
  dadosNFe?: Any,
  opts: NfceHtmlOpts = {},
): string {
  fatura = fatura || {};
  venda = venda || {};
  dadosEmpresa = dadosEmpresa || {};
  dadosNFe = dadosNFe || {};
  const itens = Array.isArray(produtos) ? produtos : [];
  const logoSrc = opts.logoSrc || '/images/logoPdf.png';

  const emitNome = getValue(dadosEmpresa.nomecontribuinte || dadosEmpresa.nomefantasia, 'EMITENTE');
  const emitEnd = `${getValue(dadosEmpresa.logradouro)}${dadosEmpresa.numero ? ', No.' + getValue(dadosEmpresa.numero) : ''}`;
  const emitCep = `CEP: ${getValue(dadosEmpresa.cep)} ${getValue(dadosEmpresa.municipio)} (${getValue(dadosEmpresa.uf)})`;
  const emitFone = dadosEmpresa.telefone ? `FONE: ${getValue(dadosEmpresa.telefone)}` : '';
  const emitIE = getValue(dadosEmpresa.inscricaoestadual);
  const emitCnpj = getValue(dadosEmpresa.cgc);

  const numeroNota = getValue(dadosNFe.numeroNFe || fatura.nroform, '0').padStart(6, '0');
  const serie = getValue(dadosNFe.serieNFe || fatura.serie, '1');
  const chave = getValue(dadosNFe.chaveAcesso);
  const protocolo = getValue(dadosNFe.protocolo, 'SEM VALIDADE');

  const dataEmissao = (() => {
    const d = fatura.data ? new Date(fatura.data) : new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  })();

  const totalItem = (p: Any) => num(p.total_item ?? p.totalproduto ?? num(p.qtd) * num(p.prunit));
  const totalIBS = itens.reduce((a, p) => a + (num(p.aliquota_ibs ?? p.aliq_ibs ?? 0.1) / 100) * totalItem(p), 0);
  const totalCBS = itens.reduce((a, p) => a + (num(p.aliquota_cbs ?? p.aliq_cbs ?? 0.9) / 100) * totalItem(p), 0);
  const aliqIBSExib = num(fatura.aliquota_ibs ?? (itens[0] as Any)?.aliquota_ibs ?? 0.1);
  const aliqCBSExib = num(fatura.aliquota_cbs ?? (itens[0] as Any)?.aliquota_cbs ?? 0.9);

  const totalProd = num(fatura.totalprod);
  const desconto = num(fatura.desconto ?? fatura.vlrdesc);
  const valorTotalNota = (() => {
    const calc = totalProd + num(fatura.valor_icms) + num(fatura.vlrfrete) + num(fatura.vlrseg) + num(fatura.vlrdesp) - desconto;
    return calc > 0 ? calc : num(fatura.totalnf);
  })();
  const formaPagamento = getValue(fatura.forma_pagamento || fatura.formapg || 'OUTROS');
  const tribAprox = getValue(fatura.vlr_trib_aprox || fatura.tributos || '0,00');

  const linhas = itens
    .map((p) => {
      const descricao = getValue(p.descr || p.dbprod?.descr || p.descricao || `PRODUTO ${p.codprod}`);
      const ref = getValue(p.ref || p.referencia || p.dbprod?.ref);
      const cod = (() => {
        const raw = String(p.codprod || '');
        return /^\d+$/.test(raw) ? raw.padStart(9, '0') : raw || 'SEM_CODIGO';
      })();
      const cst = `${getValue(p.origem ?? p.origemcom ?? '0')}${getValue(p.cst ?? p.csticms ?? '00')}`;
      const cfop = getValue(fatura.cfop2 || p.cfop || '5405');
      const un = getValue(p.unimed || p.dbprod?.unimed || 'UN');
      const vtot = totalItem(p);
      const aliqIbs = num(p.aliquota_ibs ?? p.aliq_ibs ?? 0.1);
      const aliqCbs = num(p.aliquota_cbs ?? p.aliq_cbs ?? 0.9);
      const aliqIcms = num(p.aliquota_icms ?? p.aliq_icms);
      const descCell = ref ? `<b>${esc(ref)}</b><br>${esc(descricao)}` : esc(descricao);
      return (
        `<tr><td class="l">${esc(cod)}</td><td class="l">${descCell}</td>` +
        `<td class="c">${esc(getValue(p.ncm, 'N/A'))}</td><td class="c">${esc(cst)}</td><td class="c">${esc(cfop)}</td>` +
        `<td class="c">${esc(un)}</td><td class="r">${formatValue(p.qtd)}</td><td class="r">${formatValue(p.prunit)}</td>` +
        `<td class="r">${formatValue(vtot)}</td><td class="r">${formatValue(p.baseicms)}</td><td class="r">${formatValue(p.totalicms)}</td>` +
        `<td class="r">${formatPercent(aliqIcms)}</td><td class="r">${formatPercent(aliqIbs)}</td><td class="r">${formatPercent(aliqCbs)}</td>` +
        `<td class="r">${formatValue((aliqIbs / 100) * vtot)}</td><td class="r">${formatValue((aliqCbs / 100) * vtot)}</td></tr>`
      );
    })
    .join('');

  const obsIBSCBS =
    `VALORES REFERENTES AO IBS (${formatPercent(aliqIBSExib)}%) E CBS (${formatPercent(aliqCBSExib)}%) CALCULADOS PARA FINS DE ` +
    `TRANSIÇÃO E APRENDIZADO, CONFORME LEI COMPLEMENTAR Nº 214/2025. ESTES VALORES NÃO COMPÕEM O TOTAL DA OPERAÇÃO NESTE PERÍODO.`;
  const infComplement =
    `Venda: ${esc(getValue(venda.nrovenda))} | Vendedor: ${esc(getValue(fatura.nomevendedor))} | Obs: ${esc(getValue(venda.obs))}<br>` +
    obsIBSCBS;

  const nomeDest = opts.homologacao ? HOMOLOG_NOME : getValue(fatura.nomefant);
  const marcaDagua =
    opts.marcaDagua ??
    (opts.homologacao
      ? 'SEM VALOR FISCAL'
      : protocolo === 'SEM VALIDADE' || !protocolo
        ? 'SEM VALIDADE'
        : '');
  const marcaHtml = marcaDagua ? `<div class="marca"><span>${esc(marcaDagua)}</span></div>` : '';
  const qr = opts.qrCodeDataUrl ? `<img src="${esc(opts.qrCodeDataUrl)}" alt="QR">` : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE NFC-e ${esc(numeroNota)}</title>
<style>
  @page { size: A4 landscape; margin: 4mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 6.2pt; background:#fff; }
  .danfe { width: 289mm; min-height: 200mm; border: 0.6mm solid #000; display: flex; margin: 0 auto; position: relative; }
  .marca { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:50; overflow:hidden; }
  .marca span { font-size:64pt; font-weight:700; color:rgba(90,90,90,0.16); transform:rotate(-32deg); white-space:nowrap; letter-spacing:6pt; }
  .canhoto { width: 9mm; border-right: 0.4mm solid #000; display: flex; flex-direction: column; }
  .canhoto .cel { border-bottom: 0.4mm solid #000; position: relative; } .canhoto .cel:last-child { border-bottom: none; }
  .canhoto .cel span { position: absolute; inset: 0; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 5pt; line-height: 1.1; padding: 1mm 0.5mm; }
  .canhoto .cel.recibo { flex: 3.2; } .canhoto .cel.data { flex: 1.1; } .canhoto .cel.assin { flex: 2.6; }
  .nfnum { width: 8mm; border-right: 0.4mm solid #000; position: relative; }
  .nfnum .rot { position: absolute; inset: 0; writing-mode: vertical-rl; transform: rotate(180deg); display: flex; align-items: center; justify-content: center; gap: 3mm; font-weight: 700; text-align: center; }
  .nfnum .rot .lab { font-size: 6.5pt; } .nfnum .rot .val { font-size: 10pt; letter-spacing: 0.3pt; }
  .corpo { flex: 1; display: flex; flex-direction: column; }
  .sec { display: flex; border-top: 0.4mm solid #000; } .sec:first-child { border-top: none; }
  .sec .rotlbl { width: 4mm; border-right: 0.4mm solid #000; position: relative; flex: none; }
  .sec .rotlbl span { position: absolute; inset: 0; writing-mode: vertical-rl; transform: rotate(180deg); display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: 700; text-align: center; letter-spacing: 0.2pt; }
  .sec .body { flex: 1; }
  .row { display: flex; }
  .row > .cell { border-left: 0.3mm solid #000; padding: 0.4mm 1mm 1mm; min-height: 6.6mm; position: relative; }
  .row > .cell:first-child { border-left: none; } .row + .row { border-top: 0.3mm solid #000; }
  .k { font-size: 4.6pt; line-height: 1; white-space: nowrap; }
  .v { font-size: 7pt; font-weight: 700; line-height: 1.1; margin-top: 0.4mm; } .v.big { font-size: 9pt; }
  .r { text-align: right; } .c { text-align: center; } .grow { flex: 1; }
  .header { display: flex; align-items: stretch; }
  .header .emit { flex: 2.6; display: flex; gap: 2mm; padding: 1.5mm; align-items: center; }
  .header .emit img { height: 13mm; } .header .emit .dados { font-size: 6.5pt; line-height: 1.25; }
  .header .emit .dados .ttl { font-weight: 700; font-size: 7pt; }
  .header .danfe-box { flex: 2.1; border-left: 0.4mm solid #000; padding: 1mm; text-align: center; display: flex; flex-direction: column; }
  .header .danfe-box .t1 { font-weight: 700; font-size: 11pt; } .header .danfe-box .t2 { font-size: 5.6pt; line-height: 1.1; }
  .header .danfe-box .np { font-size: 5.8pt; font-style: italic; margin: 0.6mm 0; }
  .header .danfe-box .nsf { display: flex; justify-content: space-around; margin-top: auto; font-size: 6pt; } .header .danfe-box .nsf b { font-size: 8pt; display:block; }
  .header .qr { width: 26mm; border-left: 0.4mm solid #000; padding: 1mm; display: flex; align-items: center; justify-content: center; }
  .header .qr img { width: 100%; height: auto; }
  .msgfiscal { text-align: center; padding: 1.5mm; font-size: 6pt; line-height: 1.5; }
  .msgfiscal .tt { font-weight: 700; font-size: 7pt; margin-bottom: 0.6mm; } .msgfiscal .chv { font-weight: 700; font-size: 7pt; letter-spacing: 0.3pt; }
  .prod { flex: 1; display: flex; flex-direction: column; }
  table.itens { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.itens th, table.itens td { border: 0.3mm solid #000; font-size: 5.6pt; padding: 0.3mm 0.6mm; overflow: hidden; }
  table.itens thead th { font-weight: 700; text-align: center; font-size: 5pt; line-height: 1.05; }
  table.itens td { height: 3.6mm; vertical-align: top; }
  table.itens td.l { text-align: left; } table.itens td.r { text-align: right; } table.itens td.c { text-align: center; }
  .prod .fill { flex: 1; border: 0.3mm solid #000; border-top: none; }
  .prod .fill .cols { display: flex; height: 100%; } .prod .fill .cols span { border-right: 0.3mm solid #000; } .prod .fill .cols span:last-child { border-right: none; }
  col.c-cod { width: 17mm; } col.c-ncm { width: 12mm; } col.c-cst { width: 6mm; } col.c-cfop { width: 7mm; }
  col.c-un { width: 6mm; } col.c-qtd { width: 8mm; } col.c-vu { width: 13mm; } col.c-vt { width: 14mm; }
  col.c-bic { width: 12mm; } col.c-vic { width: 12mm; } col.c-aic { width: 9mm; }
  col.c-pibs { width: 8mm; } col.c-pcbs { width: 8mm; } col.c-vibs { width: 9mm; } col.c-vcbs { width: 9mm; }
  .foot .compl { display: flex; }
  .foot .compl .ic { flex: 1; border-right: 0.4mm solid #000; padding: 1mm; min-height: 16mm; }
  .foot .compl .qi { width: 45mm; padding: 1mm; display:flex; flex-direction:column; }
  .foot .compl .qi .qtd { text-align:right; font-weight:700; font-size:9pt; } .foot .compl .qi .rf { margin-top:auto; }
  .foot .compl .k { font-size: 5pt; font-weight: 700; } .foot .compl .msg { font-size: 5.4pt; line-height: 1.25; margin-top: 0.6mm; }
</style></head><body>
<div class="danfe">
  ${marcaHtml}
  <div class="canhoto">
    <div class="cel recibo"><span>RECEBEMOS DE ${esc(emitNome)} OS PRODUTOS CONSTANTES NA NOTA FISCAL NOTIFICADA AO LADO.</span></div>
    <div class="cel data"><span>DATA DE RECEBIMENTO</span></div>
    <div class="cel assin"><span>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></div>
  </div>
  <div class="nfnum"><div class="rot"><span class="lab">NOTA FISCAL Nº</span><span class="val">${esc(numeroNota)}</span></div></div>
  <div class="corpo">
    <div class="header">
      <div class="emit">
        <img src="${esc(logoSrc)}" alt="Logo">
        <div class="dados"><div class="ttl">Identificação do Emitente</div>${esc(emitEnd)}<br>${esc(emitCep)}<br>${esc(emitFone)}</div>
      </div>
      <div class="danfe-box">
        <div class="t1">DANFE NFC-e</div>
        <div class="t2">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA PARA<br>CONSUMIDOR FINAL</div>
        <div class="np">Não permite aproveitamento de crédito de ICMS</div>
        <div class="nsf"><span>Nº<b>${esc(numeroNota)}</b></span><span>SÉRIE<b>${esc(serie)}</b></span><span>FOLHA<b>1/1</b></span></div>
      </div>
      <div class="qr">${qr}</div>
    </div>
    <div class="sec">
      <div class="rotlbl"><span>CONSUMIDOR</span></div>
      <div class="body">
        <div class="row">
          <div class="cell grow"><div class="k">NATUREZA DA OPERAÇÃO</div><div class="v">${nbsp(getValue(fatura.natureza))}</div></div>
          <div class="cell" style="flex:0.5"><div class="k">PROTOCOLO DE AUTORIZAÇÃO</div><div class="v r">${esc(protocolo)}${dadosNFe.dataEmissao ? ' ' + dataEmissao : ''}</div></div>
        </div>
        <div class="row">
          <div class="cell grow"><div class="k">INSCRIÇÃO ESTADUAL</div><div class="v">${nbsp(emitIE)}</div></div>
          <div class="cell grow"><div class="k">INSC. EST. DA SUBST. TRIBUTÁRIO</div><div class="v">&nbsp;</div></div>
          <div class="cell grow"><div class="k">CNPJ</div><div class="v">${nbsp(emitCnpj)}</div></div>
        </div>
        <div class="row">
          <div class="cell grow"><div class="k">NOME</div><div class="v">${nbsp(nomeDest)}</div></div>
          <div class="cell" style="flex:0.5"><div class="k">CPF/CNPJ</div><div class="v">${nbsp(getValue(fatura.cpfcgc))}</div></div>
          <div class="cell" style="flex:0.4"><div class="k">DATA DA EMISSÃO</div><div class="v r">${esc(dataEmissao)}</div></div>
        </div>
        <div class="row">
          <div class="cell grow"><div class="k">ENDEREÇO</div><div class="v">${nbsp(getValue(fatura.ender) + (fatura.numero ? ', ' + getValue(fatura.numero) : ''))}</div></div>
          <div class="cell" style="flex:0.5"><div class="k">BAIRRO</div><div class="v">${nbsp(getValue(fatura.bairro))}</div></div>
          <div class="cell" style="flex:0.25"><div class="k">CEP</div><div class="v">${nbsp(getValue(fatura.cep))}</div></div>
          <div class="cell" style="flex:0.3"><div class="k">DATA DE SAÍDA</div><div class="v">&nbsp;</div></div>
        </div>
        <div class="row">
          <div class="cell" style="flex:0.5"><div class="k">MUNICÍPIO</div><div class="v">${nbsp(getValue(fatura.cidade))}</div></div>
          <div class="cell" style="flex:0.3"><div class="k">FONE</div><div class="v">${nbsp(getValue(fatura.fone))}</div></div>
          <div class="cell" style="flex:0.12"><div class="k">UF</div><div class="v c">${nbsp(getValue(fatura.uf))}</div></div>
          <div class="cell" style="flex:0.3"><div class="k">HORA DE SAÍDA</div><div class="v">&nbsp;</div></div>
        </div>
      </div>
    </div>
    <div class="sec">
      <div class="rotlbl"><span>DUP</span></div>
      <div class="body"><div class="row"><div class="cell grow"><div class="k">FATURA / DUPLICATA</div><div class="v">A VISTA</div></div></div></div>
    </div>
    <div class="sec">
      <div class="rotlbl"><span>MENS. FISCAL</span></div>
      <div class="body"><div class="msgfiscal">
        <div class="tt">ÁREA DE MENSAGEM FISCAL</div>
        Número ${esc(numeroNota)} Série ${esc(serie)} Emissão ${esc(dataEmissao)} - Via do Consumidor<br>
        Consulte pela Chave de Acesso em http://sistemas.sefaz.am.gov.br/nfceweb/formConsulta.do<br>
        CHAVE DE ACESSO<br><span class="chv">${esc(chaveEmGrupos(chave))}</span>
      </div></div>
    </div>
    <div class="sec">
      <div class="rotlbl"><span>TOTAIS</span></div>
      <div class="body">
        <div class="row"><div class="cell grow"><div class="k">FORMA DE PAGAMENTO</div><div class="v">${esc(formaPagamento)}&nbsp;&nbsp;&nbsp;${formatValue(valorTotalNota)}</div></div></div>
        <div class="row">
          <div class="cell grow"><div class="k">TRIBUTOS TOTAIS INCIDENTES (Lei Federal 12.741/2012)</div><div class="v r">${esc(tribAprox)}</div></div>
          <div class="cell grow"><div class="k">DESCONTO</div><div class="v r">${formatValue(desconto)}</div></div>
          <div class="cell grow"><div class="k">VALOR TOTAL DOS PRODUTOS</div><div class="v r">${formatValue(totalProd)}</div></div>
          <div class="cell grow" style="background:#eee"><div class="k">VALOR DA NOTA</div><div class="v r big">${formatValue(valorTotalNota)}</div></div>
        </div>
      </div>
    </div>
    <div class="sec" style="flex:1">
      <div class="rotlbl"><span>DADOS DOS PRODUTOS/SERVIÇOS</span></div>
      <div class="body prod">
        <table class="itens">
          <colgroup><col class="c-cod"><col class="c-desc"><col class="c-ncm"><col class="c-cst"><col class="c-cfop"><col class="c-un"><col class="c-qtd"><col class="c-vu"><col class="c-vt"><col class="c-bic"><col class="c-vic"><col class="c-aic"><col class="c-pibs"><col class="c-pcbs"><col class="c-vibs"><col class="c-vcbs"></colgroup>
          <thead><tr><th>CÓD. PRODUTO</th><th>DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th><th>NCM</th><th>CST</th><th>CFOP</th><th>UND</th><th>QTD</th><th>V. UNITÁRIO</th><th>V. TOTAL</th><th>BS. ICMS</th><th>V. ICMS</th><th>ALIQ. ICMS</th><th>%IBS</th><th>%CBS</th><th>V.IBS</th><th>V.CBS</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <div class="fill"><div class="cols">
          <span style="width:17mm"></span><span style="flex:1"></span><span style="width:12mm"></span><span style="width:6mm"></span><span style="width:7mm"></span><span style="width:6mm"></span><span style="width:8mm"></span><span style="width:13mm"></span><span style="width:14mm"></span><span style="width:12mm"></span><span style="width:12mm"></span><span style="width:9mm"></span><span style="width:8mm"></span><span style="width:8mm"></span><span style="width:9mm"></span><span style="width:9mm"></span>
        </div></div>
      </div>
    </div>
    <div class="sec foot">
      <div class="rotlbl"><span>INF. ADICIONAIS</span></div>
      <div class="body">
        <div class="compl">
          <div class="ic"><div class="k">INFORMAÇÕES COMPLEMENTARES</div><div class="msg">${infComplement}</div></div>
          <div class="qi"><div class="k">QUANTIDADE DE ITENS</div><div class="qtd">${itens.length}</div><div class="rf"><div class="k">RESERVADO AO FISCO</div></div></div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}
