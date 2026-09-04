/**
 * HTML do Comprovante de Pagamento (server-side) — mesmo layout da impressão do web,
 * para gerar o PDF (via renderHtmlToPdf) e anexar no email. Logo embutido como data URI.
 */
export interface ItemComprovanteHtml {
  ita_nro_doc?: string | null;
  valor_original?: number | null;
  ita_valor_juros?: number | null;
  taxa_admin?: number | null;
  ita_valor_total?: number | null;
  ita_valor?: number | null;
  ita_valo_areceber?: number | null;
}
export interface FormaHtml {
  nome?: string | null;
  valor?: number | null;
}
export interface ComprovanteHtmlData {
  aut_id: string;
  aut_data: string;
  aut_autenticacao?: string | null;
  aut_cancel?: number | null;
  aut_codconta?: string | null;
  codcli?: string | number | null;
  nome_cliente?: string | null;
  itens: ItemComprovanteHtml[];
  formas: FormaHtml[];
}

const num = (n: any) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

export function gerarComprovanteHtml(d: ComprovanteHtmlData, logoDataUri: string): string {
  const totalRecebido = (d.itens || []).reduce((s, i) => s + Number(i.ita_valor || 0), 0);

  const linhas = (d.itens || [])
    .map((i, idx) => {
      const original = i.valor_original != null ? i.valor_original : i.ita_valo_areceber;
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${i.ita_nro_doc || '-'}</td>
        <td class="r">${num(original)}</td>
        <td class="r">${num(i.ita_valor_juros)}</td>
        <td class="r">${num(i.taxa_admin)}</td>
        <td class="r">${num(i.ita_valor_total)}</td>
        <td class="r">${num(i.ita_valor_total)}</td>
        <td class="r">${num(i.ita_valor)}</td>
      </tr>`;
    })
    .join('');

  const linhasFormas = (d.formas || []).length
    ? d.formas
        .map((f) => `<tr><td>${(f.nome || '-').toUpperCase()}</td><td class="r">${num(f.valor)}</td></tr>`)
        .join('')
    : `<tr><td colspan="2" style="color:#888">—</td></tr>`;

  const impressoEm = new Date().toLocaleString('pt-BR');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante ${d.aut_id}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:18px;margin:0}
      .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .logo img{height:46px;width:auto}
      .cli{border:1px solid #000;padding:4px 8px;font-size:11px;min-width:280px}
      .aut{text-align:right;font-family:monospace;font-size:10px}
      .barcode{font-family:monospace;font-size:22px;letter-spacing:1px;border:1px solid #000;padding:2px 8px;display:inline-block}
      h3{text-align:center;margin:14px 0 6px;font-size:13px;letter-spacing:1px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #000;padding:3px 6px}
      th{background:#f0f0f0;font-size:10px;text-align:left}
      td.r,th.r{text-align:right}
      .sec{margin-top:10px;font-weight:bold;font-size:11px}
      .formas{width:60%;margin-top:2px}
      .rodape{position:fixed;left:18px;right:18px;bottom:14px}
      .totrec{display:flex;justify-content:flex-end;align-items:center;gap:10px;font-size:13px}
      .totrec b{border:1px solid #000;padding:2px 20px;min-width:120px;text-align:right}
      .notas{margin-top:10px;font-size:9px;color:#333;display:flex;justify-content:space-between;align-items:flex-end}
      .cancel{color:#c00;font-weight:bold}
    </style></head>
    <body>
      <div class="top">
        <div class="logo"><img src="${logoDataUri}" alt="MELO" /></div>
        <div class="cli">
          <div><b>Cliente</b></div>
          <div>${d.codcli || ''} - ${d.nome_cliente || ''}</div>
          <div><b>Data:</b> ${fmtData(d.aut_data)}</div>
        </div>
        <div class="aut">
          <div class="barcode">${d.aut_id}</div>
          <div>${d.aut_autenticacao || ''}</div>
        </div>
      </div>

      <h3>COMPROVANTE DE PAGAMENTO ${Number(d.aut_cancel) === 1 ? '<span class="cancel">(CANCELADO)</span>' : ''}</h3>

      <table>
        <thead><tr>
          <th style="text-align:center">#</th>
          <th>Título</th>
          <th class="r">Valor Original</th>
          <th class="r">Valor do Juros</th>
          <th class="r">Taxa Admin.</th>
          <th class="r">Valor Total<sup>1</sup></th>
          <th class="r">Valor Total a Pagar<sup>1</sup></th>
          <th class="r">Valor Pago</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>

      <div class="sec">FORMAS DE PAGAMENTO</div>
      <table class="formas"><tbody>${linhasFormas}</tbody></table>

      <div class="rodape">
        <div class="totrec"><span><b style="border:none;padding:0">Total Recebido:</b></span><b>${num(totalRecebido)}</b></div>
        <div class="notas">
          <div>
            <div><sup>1</sup> Valor atualizado até o dia ${fmtData(d.aut_data)}.</div>
            <div><sup>2</sup> Pagamento efetuado com cheque ou cheque-pré está sujeito a compensação.</div>
            <div>(*) Pagamento realizado parcialmente.</div>
          </div>
          <div>Impresso em ${impressoEm}</div>
        </div>
      </div>
    </body></html>`;
}
