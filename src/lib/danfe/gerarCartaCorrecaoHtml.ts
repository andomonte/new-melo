// src/lib/danfe/gerarCartaCorrecaoHtml.ts
// Comprovante da Carta de Correção Eletrônica (CC-e) em HTML (A4 RETRATO), para
// virar PDF via /api/faturamento/danfe-html-pdf (orientacao: 'portrait'). Mesmo
// padrão da DANFE HTML: string self-contained, sem dependências externas.

interface EmitenteCCe {
  nome?: string;
  cnpj?: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
}
interface DestinatarioCCe {
  nome?: string;
  documento?: string;
  endereco?: string;
}
export interface DadosCartaCorrecao {
  numeroNota?: string;
  serie?: string;
  chave: string;
  protocolo?: string;
  nSeqEvento: number;
  dhEvento?: string; // ISO com -04:00
  correcao: string;
  emitente?: EmitenteCCe;
  destinatario?: DestinatarioCCe;
  homologacao?: boolean;
  logoSrc?: string;
}

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const XCONDUSO =
  'A Carta de Correção é disciplinada pelo parágrafo 1º-A do art. 7º do Convênio S/N, ' +
  'de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido ' +
  'na emissão de documento fiscal, desde que o erro não esteja relacionado com: ' +
  'I - as variáveis que determinam o valor do imposto tais como: base de cálculo, ' +
  'alíquota, diferença de preço, quantidade, valor da operação ou da prestação; ' +
  'II - a correção de dados cadastrais que implique mudança do remetente ou do ' +
  'destinatário; III - a data de emissão ou de saída.';

function fmtChave(ch: string): string {
  const s = String(ch || '').replace(/\D/g, '');
  return s.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function fmtDataHora(iso?: string): string {
  if (!iso) return '';
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
  return String(iso);
}

export function gerarCartaCorrecaoHtml(d: DadosCartaCorrecao): string {
  const emit = d.emitente || {};
  const dest = d.destinatario || {};
  const marca = d.homologacao ? 'SEM VALOR FISCAL' : '';

  return `
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; margin: 0; }
    .wrap { position: relative; }
    .marca { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
             font-size: 60px; color: rgba(200,0,0,.12); font-weight: 800; transform: rotate(-30deg);
             pointer-events: none; z-index: 0; }
    .box { border: 1px solid #000; padding: 6px 8px; margin-bottom: 6px; position: relative; z-index: 1; }
    .titulo { text-align: center; font-weight: 700; font-size: 15px; letter-spacing: .5px; }
    .sub { text-align: center; font-size: 10px; color: #333; }
    .k { font-size: 8px; color: #444; text-transform: uppercase; }
    .v { font-size: 11px; font-weight: 600; }
    .row { display: flex; gap: 8px; }
    .row > div { flex: 1; }
    .legenda { font-weight: 700; font-size: 10px; border-bottom: 1px solid #000; margin-bottom: 4px; padding-bottom: 2px; text-transform: uppercase; }
    .cond { font-size: 9px; text-align: justify; line-height: 1.35; }
    .correcao { font-size: 12px; line-height: 1.4; white-space: pre-wrap; min-height: 90px; }
    .logo { height: 40px; }
    .cab { display: flex; align-items: center; gap: 10px; }
  </style>
  <div class="wrap">
    ${marca ? `<div class="marca">${esc(marca)}</div>` : ''}

    <div class="box">
      <div class="cab">
        ${d.logoSrc ? `<img class="logo" src="${esc(d.logoSrc)}" />` : ''}
        <div style="flex:1">
          <div class="titulo">CARTA DE CORREÇÃO ELETRÔNICA</div>
          <div class="sub">CC-e — Evento 110110 · Documento sem valor fiscal, apenas comprovante do evento</div>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="row">
        <div><div class="k">Nº da NF-e</div><div class="v">${esc(d.numeroNota || '')}</div></div>
        <div><div class="k">Série</div><div class="v">${esc(d.serie || '')}</div></div>
        <div><div class="k">Sequência do evento</div><div class="v">${esc(d.nSeqEvento)}</div></div>
        <div><div class="k">Data/hora do evento</div><div class="v">${esc(fmtDataHora(d.dhEvento))}</div></div>
      </div>
      <div class="row" style="margin-top:4px">
        <div style="flex:3"><div class="k">Chave de acesso</div><div class="v" style="font-family:monospace">${esc(fmtChave(d.chave))}</div></div>
        <div><div class="k">Protocolo do evento</div><div class="v">${esc(d.protocolo || '')}</div></div>
      </div>
    </div>

    <div class="box">
      <div class="legenda">Emitente</div>
      <div class="v">${esc(emit.nome || '')}</div>
      <div class="row">
        <div><div class="k">CNPJ</div><div class="v">${esc(emit.cnpj || '')}</div></div>
        <div><div class="k">Inscrição Estadual</div><div class="v">${esc(emit.ie || '')}</div></div>
      </div>
      ${emit.endereco ? `<div class="k" style="margin-top:2px">Endereço</div><div>${esc(emit.endereco)}${emit.municipio ? ' - ' + esc(emit.municipio) : ''}</div>` : ''}
    </div>

    <div class="box">
      <div class="legenda">Destinatário</div>
      <div class="v">${esc(dest.nome || '')}</div>
      <div class="row">
        <div><div class="k">CPF/CNPJ</div><div class="v">${esc(dest.documento || '')}</div></div>
      </div>
      ${dest.endereco ? `<div class="k" style="margin-top:2px">Endereço</div><div>${esc(dest.endereco)}</div>` : ''}
    </div>

    <div class="box">
      <div class="legenda">Correção</div>
      <div class="correcao">${esc(d.correcao)}</div>
    </div>

    <div class="box">
      <div class="legenda">Condições de uso</div>
      <div class="cond">${esc(XCONDUSO)}</div>
    </div>
  </div>`;
}

export default gerarCartaCorrecaoHtml;
