// src/lib/danfe/gerarTermoBateriasHtml.ts
// Termo de Compromisso sobre Carcaças de Baterias (A4 retrato) — logística reversa
// (Lei 12.305/2010 - PNRS e Resolução CONAMA 401/2008). O cliente se compromete a
// devolver as baterias usadas ao ponto de venda. Vira PDF via danfe-html-pdf.

interface ProdutoTermo {
  ref: string;
  descr: string;
  marca: string;
  qtde: number;
}
export interface DadosTermoBaterias {
  nroform?: string;
  serie?: string;
  cliente: {
    nome: string;
    documento: string;
    tipoDoc?: string;
    endereco?: string;
  };
  produtos: ProdutoTermo[];
  logoSrc?: string;
  cidade?: string; // local da assinatura (ex.: "Manaus")
}

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmtDoc = (d: string) => {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return s;
};

export function gerarTermoBateriasHtml(d: DadosTermoBaterias): string {
  const cli = d.cliente || ({} as any);
  const linhas = (d.produtos || [])
    .map(
      (p, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(p.ref)}</td>
        <td>${esc(p.descr)}</td>
        <td>${esc(p.marca)}</td>
        <td style="text-align:center">${esc(p.qtde)}</td>
      </tr>`,
    )
    .join('');

  return `
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; margin: 0; line-height: 1.45; }
    .cab { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .logo { height: 46px; }
    .titulo { text-align: center; font-weight: 700; font-size: 16px; }
    .sub { text-align: center; font-size: 11px; color: #444; }
    .box { border: 1px solid #000; padding: 6px 8px; margin-bottom: 10px; }
    .k { font-size: 9px; color: #444; text-transform: uppercase; }
    .v { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
    th, td { border: 1px solid #000; padding: 3px 5px; font-size: 11px; }
    th { background: #eee; text-transform: uppercase; font-size: 10px; }
    .just { text-align: justify; margin: 10px 0; }
    .assin { margin-top: 46px; text-align: center; }
    .linha { border-top: 1px solid #000; width: 70%; margin: 0 auto; padding-top: 4px; }
  </style>

  <div class="cab">
    ${d.logoSrc ? `<img class="logo" src="${esc(d.logoSrc)}" />` : ''}
    <div style="flex:1">
      <div class="titulo">TERMO DE COMPROMISSO SOBRE CARCAÇAS DE BATERIAS</div>
      <div class="sub">Logística reversa — Lei nº 12.305/2010 (PNRS) e Resolução CONAMA nº 401/2008</div>
    </div>
  </div>

  <div class="box">
    <div class="k">Referente à Nota Fiscal / Formulário</div>
    <div class="v">Nº ${esc(d.nroform || '')}${d.serie ? ', série ' + esc(d.serie) : ''}</div>
    <div class="k" style="margin-top:4px">${esc(cli.tipoDoc || 'CPF/CNPJ')}</div>
    <div class="v">${esc(fmtDoc(cli.documento))}</div>
    <div class="k" style="margin-top:4px">Nome / Razão Social</div>
    <div class="v">${esc(cli.nome)}</div>
    ${cli.endereco ? `<div class="k" style="margin-top:4px">Endereço</div><div>${esc(cli.endereco)}</div>` : ''}
  </div>

  <p class="just">
    O adquirente acima identificado declara, para os devidos fins, estar ciente de que as
    baterias e acumuladores relacionados abaixo, após esgotada a sua vida útil, constituem
    resíduo perigoso e <strong>não podem ser descartados no meio ambiente</strong>, e
    <strong>compromete-se a devolvê-los</strong> ao estabelecimento vendedor ou à rede de
    assistência técnica autorizada, para fins de destinação ambientalmente adequada
    (logística reversa), conforme a legislação vigente.
  </p>

  <table>
    <thead>
      <tr><th style="width:6%">Item</th><th style="width:18%">Referência</th><th>Descrição</th><th style="width:20%">Marca</th><th style="width:10%">Qtde</th></tr>
    </thead>
    <tbody>${linhas || `<tr><td colspan="5" style="text-align:center">Nenhum item selecionado.</td></tr>`}</tbody>
  </table>

  <p class="just">
    Declaro ter recebido as orientações quanto ao manuseio, acondicionamento e devolução
    das baterias usadas, assumindo integral responsabilidade pela sua correta destinação.
  </p>

  <div class="assin">
    <div>${esc(d.cidade || 'Manaus')}, ______ de _______________ de __________.</div>
    <div class="linha" style="margin-top:40px">Assinatura do adquirente / responsável</div>
  </div>`;
}

export default gerarTermoBateriasHtml;
