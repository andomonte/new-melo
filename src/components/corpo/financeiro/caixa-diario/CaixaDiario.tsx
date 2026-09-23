'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Printer, FileSpreadsheet, Wallet } from 'lucide-react';

interface Linha {
  banco: string; conta: string; codconta: string;
  valor: number; historico: string; forma_pgto: string; cx_geral: string; oficial: string;
}
interface Resposta {
  ok: boolean; data: string; tipo: string;
  entradas01: Linha[]; entradas02: Linha[]; saidas01: Linha[]; saidas02: Linha[];
  geralEntradas: Linha[]; geralSaidas: Linha[];
  totalEntrada: number; totalSaida: number; saldo: number; erro?: string;
}

type Aba = 'e01' | 'e02' | 's01' | 's02' | 'geral';
const ABAS: { key: Aba; label: string }[] = [
  { key: 'e01', label: 'Entradas 01' },
  { key: 'e02', label: 'Entradas 02' },
  { key: 's01', label: 'Saídas 01' },
  { key: 's02', label: 'Saídas 02' },
  { key: 'geral', label: 'Caixa Geral' },
];
const TIPOS = [
  { v: 'N', l: 'Todos' }, { v: 'S', l: 'Depósito' }, { v: 'C', l: 'Crédito Cliente' }, { v: 'P', l: 'PIX' },
];

const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Tabela de movimento (entradas ou saídas). OFICIAL só nas ENTRADAS (fiel ao Delphi).
function GridMov({ linhas, coluna }: { linhas: Linha[]; coluna: 'ENTRADA' | 'SAIDA' }) {
  const total = linhas.reduce((a, x) => a + x.valor, 0);
  const temOficial = coluna === 'ENTRADA';
  const nCols = temOficial ? 6 : 5;
  return (
    <div className="overflow-auto border border-gray-200 rounded-lg h-full">
      <table className="text-xs min-w-max w-full">
        <thead className="sticky top-0 z-10 bg-[#1e40af] text-white">
          <tr>
            <th className="px-2 py-1.5 text-left">HISTÓRICO</th>
            <th className="px-2 py-1.5 text-left">CONTA</th>
            <th className="px-2 py-1.5 text-left">FORMA_PGTO</th>
            <th className="px-2 py-1.5 text-right">{coluna}</th>
            <th className="px-2 py-1.5 text-center">CX_GERAL</th>
            {temOficial && <th className="px-2 py-1.5 text-center">OFICIAL</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr><td colSpan={nCols} className="text-center text-gray-400 py-6">Sem movimento.</td></tr>
          ) : linhas.map((l, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-blue-50">
              <td className="px-2 py-1 whitespace-nowrap max-w-[360px] truncate" title={l.historico}>{l.historico}</td>
              <td className="px-2 py-1 whitespace-nowrap" title={l.banco}>{l.conta}</td>
              <td className="px-2 py-1 whitespace-nowrap">{l.forma_pgto}</td>
              <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{brl(l.valor)}</td>
              <td className="px-2 py-1 text-center">{l.cx_geral}</td>
              {temOficial && <td className="px-2 py-1 text-center">{l.oficial}</td>}
            </tr>
          ))}
        </tbody>
        {linhas.length > 0 && (
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td className="px-2 py-1" colSpan={3}>Total</td>
              <td className="px-2 py-1 text-right tabular-nums">{brl(total)}</td>
              <td colSpan={temOficial ? 2 : 1} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---- Resumo por CONTA → FORMA DE PAGAMENTO (totalizador do fim de cada aba) ----
interface ResumoForma { forma: string; valor: number }
interface ResumoConta { conta: string; banco: string; formas: ResumoForma[]; total: number }

function resumoPorConta(linhas: Linha[]): ResumoConta[] {
  const mapa = new Map<string, ResumoConta>();
  for (const l of linhas) {
    let rc = mapa.get(l.conta);
    if (!rc) { rc = { conta: l.conta, banco: l.banco, formas: [], total: 0 }; mapa.set(l.conta, rc); }
    let rf = rc.formas.find((f) => f.forma === l.forma_pgto);
    if (!rf) { rf = { forma: l.forma_pgto, valor: 0 }; rc.formas.push(rf); }
    rf.valor += l.valor; rc.total += l.valor;
  }
  const arr = Array.from(mapa.values());
  arr.forEach((rc) => rc.formas.sort((a, b) => b.valor - a.valor));
  arr.sort((a, b) => b.total - a.total);
  return arr;
}

function ResumoContas({ linhas, coluna }: { linhas: Linha[]; coluna: 'ENTRADA' | 'SAIDA' }) {
  const resumo = resumoPorConta(linhas);
  if (resumo.length === 0) return null;
  const totalGeral = resumo.reduce((a, r) => a + r.total, 0);
  return (
    <div className="border border-gray-200 rounded-lg overflow-auto shrink-0" style={{ maxHeight: 200 }}>
      <table className="text-xs w-full">
        <thead className="sticky top-0 z-10 bg-gray-700 text-white">
          <tr>
            <th className="px-2 py-1 text-left">RESUMO POR CONTA / FORMA</th>
            <th className="px-2 py-1 text-right">{coluna}</th>
          </tr>
        </thead>
        <tbody>
          {resumo.map((rc) => (
            <FragmentoConta key={rc.conta} rc={rc} />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
            <td className="px-2 py-1">TOTAL GERAL</td>
            <td className="px-2 py-1 text-right tabular-nums">{brl(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FragmentoConta({ rc }: { rc: ResumoConta }) {
  return (
    <>
      <tr className="bg-blue-50 font-semibold border-t border-gray-200">
        <td className="px-2 py-1" title={rc.banco}>{rc.conta}{rc.banco ? ` — ${rc.banco}` : ''}</td>
        <td className="px-2 py-1 text-right tabular-nums">{brl(rc.total)}</td>
      </tr>
      {rc.formas.map((f, i) => (
        <tr key={i} className="border-t border-gray-100">
          <td className="px-2 py-1 pl-6 text-gray-700">{f.forma}</td>
          <td className="px-2 py-1 text-right tabular-nums text-gray-700">{brl(f.valor)}</td>
        </tr>
      ))}
    </>
  );
}

// ---- Resumo por FORMA DE PAGAMENTO (somando todas as contas) ----
function resumoPorForma(linhas: Linha[]): ResumoForma[] {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.forma_pgto, (mapa.get(l.forma_pgto) || 0) + l.valor);
  return Array.from(mapa.entries()).map(([forma, valor]) => ({ forma, valor })).sort((a, b) => b.valor - a.valor);
}

function ResumoFormaTabela({ linhas, coluna }: { linhas: Linha[]; coluna: 'ENTRADA' | 'SAIDA' }) {
  const resumo = resumoPorForma(linhas);
  if (resumo.length === 0) return null;
  const total = resumo.reduce((a, r) => a + r.valor, 0);
  return (
    <div className="border border-gray-200 rounded-lg overflow-auto shrink-0" style={{ maxHeight: 200 }}>
      <table className="text-xs w-full">
        <thead className="sticky top-0 z-10 bg-gray-700 text-white">
          <tr><th className="px-2 py-1 text-left">RESUMO POR FORMA</th><th className="px-2 py-1 text-right">{coluna}</th></tr>
        </thead>
        <tbody>
          {resumo.map((f, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-2 py-1 text-gray-700">{f.forma}</td>
              <td className="px-2 py-1 text-right tabular-nums text-gray-700">{brl(f.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
            <td className="px-2 py-1">TOTAL</td>
            <td className="px-2 py-1 text-right tabular-nums">{brl(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Rodapé com os dois resumos lado a lado (por conta/forma + por forma).
function ResumoRodape({ linhas, coluna }: { linhas: Linha[]; coluna: 'ENTRADA' | 'SAIDA' }) {
  if (linhas.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 shrink-0">
      <div className="flex-1 min-w-[280px]"><ResumoContas linhas={linhas} coluna={coluna} /></div>
      <div className="w-80 shrink-0"><ResumoFormaTabela linhas={linhas} coluna={coluna} /></div>
    </div>
  );
}

export default function CaixaDiario() {
  const [data, setData] = useState(hojeISO());
  const [tipo, setTipo] = useState('N');
  const [conta, setConta] = useState(''); // cod_conta selecionado ('' = todas)
  const [contaLabel, setContaLabel] = useState('');
  const [contaOpts, setContaOpts] = useState<{ cod_conta: string; label: string }[]>([]);
  const [contaAberto, setContaAberto] = useState(false);
  const [aba, setAba] = useState<Aba>('e01');
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<Resposta | null>(null);

  // Combobox de conta — busca em dbconta (mesmo endpoint do Contas a Pagar)
  const buscarContas = async (term: string) => {
    try {
      const q = new URLSearchParams();
      if (term.trim()) q.set('busca', term.trim());
      const r = await fetch('/api/contas-pagar/contas-dbconta?' + q.toString());
      const d = await r.json();
      setContaOpts((d.contas || []).map((x: any) => ({ cod_conta: x.cod_conta, label: x.label })));
    } catch { setContaOpts([]); }
  };

  const consultar = async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ data, tipo });
      if (conta.trim()) q.set('conta', conta.trim());
      const r = await fetch('/api/financeiro/caixa-diario?' + q.toString());
      const d: Resposta = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao gerar o movimento.');
      setDados(d);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  const abaAtual = (d: Resposta): Linha[] =>
    aba === 'e01' ? d.entradas01 : aba === 'e02' ? d.entradas02 : aba === 's01' ? d.saidas01 : aba === 's02' ? d.saidas02 : [];
  const colAba = aba.startsWith('e') ? 'ENTRADA' : 'SAIDA' as 'ENTRADA' | 'SAIDA';

  const exportarExcel = async () => {
    if (!dados) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      // Resumo por Conta → Forma de pagamento (anexado ao fim de cada planilha)
      const addResumo = (ws: any, linhas: Linha[], col: string) => {
        const resumo = resumoPorConta(linhas);
        if (!resumo.length) return;
        ws.addRow([]);
        ws.addRow([`Resumo por Conta / Forma — ${col}`]).font = { bold: true };
        ws.addRow(['CONTA / FORMA', col]).font = { bold: true };
        resumo.forEach((rc) => {
          const rh = ws.addRow([`${rc.conta}${rc.banco ? ' — ' + rc.banco : ''}`, rc.total]);
          rh.font = { bold: true }; rh.getCell(2).numFmt = '#,##0.00';
          rc.formas.forEach((f) => { const r = ws.addRow(['   ' + f.forma, f.valor]); r.getCell(2).numFmt = '#,##0.00'; });
        });
        const tg = ws.addRow(['TOTAL GERAL', resumo.reduce((a, r) => a + r.total, 0)]);
        tg.font = { bold: true }; tg.getCell(2).numFmt = '#,##0.00';
      };
      // Resumo só por Forma de pagamento (todas as contas)
      const addResumoForma = (ws: any, linhas: Linha[], col: string) => {
        const resumo = resumoPorForma(linhas);
        if (!resumo.length) return;
        ws.addRow([]);
        ws.addRow([`Resumo por Forma — ${col}`]).font = { bold: true };
        ws.addRow(['FORMA', col]).font = { bold: true };
        resumo.forEach((f) => { const r = ws.addRow([f.forma, f.valor]); r.getCell(2).numFmt = '#,##0.00'; });
        const tg = ws.addRow(['TOTAL', resumo.reduce((a, r) => a + r.valor, 0)]);
        tg.font = { bold: true }; tg.getCell(2).numFmt = '#,##0.00';
      };
      const addAba = (nome: string, linhas: Linha[], col: string) => {
        const oficial = col === 'ENTRADA';
        const ws = wb.addWorksheet(nome.slice(0, 31));
        const head = ['HISTÓRICO', 'CONTA', 'FORMA_PGTO', col, 'CX_GERAL', ...(oficial ? ['OFICIAL'] : [])];
        ws.addRow(head).font = { bold: true };
        linhas.forEach((l) => ws.addRow([l.historico, l.conta, l.forma_pgto, l.valor, l.cx_geral, ...(oficial ? [l.oficial] : [])]));
        ws.addRow(['Total', '', '', linhas.reduce((a, x) => a + x.valor, 0), '', ...(oficial ? [''] : [])]).font = { bold: true };
        addResumo(ws, linhas, col);
        addResumoForma(ws, linhas, col);
        ws.getColumn(1).width = 45; ws.getColumn(2).width = 22; ws.getColumn(4).numFmt = '#,##0.00';
      };
      // SEMPRE gera TODAS as abas, cada uma numa planilha (independente da aba ativa)
      addAba('Entradas 01', dados.entradas01, 'ENTRADA');
      addAba('Entradas 02', dados.entradas02, 'ENTRADA');
      addAba('Saídas 01', dados.saidas01, 'SAIDA');
      addAba('Saídas 02', dados.saidas02, 'SAIDA');

      // Planilha Geral (consolidado): resumo do dia + as duas listas + resumo por conta/forma
      const ws = wb.addWorksheet('Geral');
      ws.addRow([`Movimento Diário do Caixa — ${dataBR(dados.data)}`]).font = { bold: true, size: 12 };
      ws.addRow([]);
      [['Entradas do Dia', dados.totalEntrada], ['Saídas do Dia', dados.totalSaida], ['Saldo do Dia', dados.saldo]]
        .forEach(([lbl, v]) => { const row = ws.addRow([lbl, v]); row.font = { bold: true }; row.getCell(2).numFmt = '#,##0.00'; });
      ws.addRow([]);
      const secao = (titulo: string, linhas: Linha[], col: string) => {
        ws.addRow([titulo]).font = { bold: true };
        ws.addRow(['HISTÓRICO', 'CONTA', 'FORMA_PGTO', col, 'CX_GERAL', 'OFICIAL']).font = { bold: true };
        linhas.forEach((l) => ws.addRow([l.historico, l.conta, l.forma_pgto, l.valor, l.cx_geral, l.oficial]));
        ws.addRow(['Total', '', '', linhas.reduce((a, x) => a + x.valor, 0), '', '']).font = { bold: true };
        addResumo(ws, linhas, col);
        addResumoForma(ws, linhas, col);
        ws.addRow([]);
      };
      secao('ENTRADAS', dados.geralEntradas, 'ENTRADA');
      secao('SAÍDAS', dados.geralSaidas, 'SAIDA');
      ws.getColumn(1).width = 45; ws.getColumn(2).width = 22; ws.getColumn(4).numFmt = '#,##0.00';
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `caixa-diario-${data}.xlsx`);
    } catch (e: any) { toast.error('Falha ao gerar Excel: ' + (e?.message || '')); }
  };

  const imprimir = () => {
    if (!dados) return;
    const w = window.open('', '_blank', 'width=1000,height=800'); if (!w) return;
    const tabela = (titulo: string, linhas: Linha[], col: string) => {
      const oficial = col === 'ENTRADA';
      const nc = oficial ? 6 : 5;
      const rows = linhas.map((l) => `<tr><td>${l.historico}</td><td>${l.conta}</td><td>${l.forma_pgto}</td><td class="num">${brl(l.valor)}</td><td class="c">${l.cx_geral}</td>${oficial ? `<td class="c">${l.oficial}</td>` : ''}</tr>`).join('');
      const tot = linhas.reduce((a, x) => a + x.valor, 0);
      return `<h3>${titulo}</h3><table><thead><tr><th>HISTÓRICO</th><th>CONTA</th><th>FORMA_PGTO</th><th>${col}</th><th>CX_GERAL</th>${oficial ? '<th>OFICIAL</th>' : ''}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${nc}">Sem movimento.</td></tr>`}</tbody>
        <tfoot><tr class="forte"><td colspan="3">Total</td><td class="num">${brl(tot)}</td><td colspan="${oficial ? 2 : 1}"></td></tr></tfoot></table>`;
    };
    const resumoHtml = (col: string, linhas: Linha[]) => {
      const resumo = resumoPorConta(linhas);
      if (!resumo.length) return '';
      const totalGeral = resumo.reduce((a, r) => a + r.total, 0);
      const body = resumo.map((rc) =>
        `<tr class="ch"><td>${rc.conta}${rc.banco ? ` — ${rc.banco}` : ''}</td><td class="num">${brl(rc.total)}</td></tr>`
        + rc.formas.map((f) => `<tr><td class="ind">${f.forma}</td><td class="num">${brl(f.valor)}</td></tr>`).join('')
      ).join('');
      return `<h3>Resumo por Conta / Forma — ${col}</h3>
        <table class="res"><thead><tr><th>CONTA / FORMA</th><th>${col}</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr class="forte"><td>TOTAL GERAL</td><td class="num">${brl(totalGeral)}</td></tr></tfoot></table>`;
    };
    const resumoFormaHtml = (col: string, linhas: Linha[]) => {
      const resumo = resumoPorForma(linhas);
      if (!resumo.length) return '';
      const total = resumo.reduce((a, r) => a + r.valor, 0);
      const body = resumo.map((f) => `<tr><td>${f.forma}</td><td class="num">${brl(f.valor)}</td></tr>`).join('');
      return `<h3>Resumo por Forma — ${col}</h3>
        <table class="res"><thead><tr><th>FORMA</th><th>${col}</th></tr></thead>
        <tbody>${body}</tbody><tfoot><tr class="forte"><td>TOTAL</td><td class="num">${brl(total)}</td></tr></tfoot></table>`;
    };
    const bloco = (titulo: string, linhas: Linha[], col: string) =>
      tabela(titulo, linhas, col) + resumoHtml(col, linhas) + resumoFormaHtml(col, linhas);
    const corpo = aba === 'geral'
      ? bloco('Entradas', dados.geralEntradas, 'ENTRADA') + bloco('Saídas', dados.geralSaidas, 'SAIDA')
        + `<div class="tot">Entradas do Dia: ${brl(dados.totalEntrada)} &nbsp;|&nbsp; Saídas do Dia: ${brl(dados.totalSaida)} &nbsp;|&nbsp; Saldo do Dia: ${brl(dados.saldo)}</div>`
      : bloco(ABAS.find((a) => a.key === aba)!.label, abaAtual(dados), colAba);
    w.document.write(`<html><head><title>Movimento Diário do Caixa</title><style>
      body{font-family:Arial;font-size:9px;padding:12px}h2{margin:0}h3{margin:10px 0 4px}
      table{border-collapse:collapse;width:100%;margin-bottom:6px}th,td{border:1px solid #ccc;padding:2px 4px}
      th{background:#1e40af;color:#fff;text-align:left}.num{text-align:right}.c{text-align:center}.forte{background:#eef2ff;font-weight:bold}
      .tot{margin-top:8px;font-weight:bold}
      .res{max-width:540px}.res th{background:#374151}.ch{background:#dbeafe;font-weight:bold}.ind{padding-left:18px;color:#333}
    </style></head><body><h2>MELO DISTRIBUIDORA DE PECAS LTDA.</h2>
      <div>Movimento Diário do Caixa — ${dataBR(dados.data)}</div>${corpo}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Wallet className="w-6 h-6 text-blue-700" />
        <h1 className="text-xl font-bold text-gray-800">Movimento Diário do Caixa</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data da operação</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">Conta (opcional)</label>
          <input
            value={contaLabel}
            onChange={(e) => { setContaLabel(e.target.value); setConta(''); buscarContas(e.target.value); setContaAberto(true); }}
            onFocus={() => { buscarContas(contaLabel); setContaAberto(true); }}
            onBlur={() => setTimeout(() => setContaAberto(false), 150)}
            placeholder="Todas as contas"
            className="border rounded px-2 py-1.5 text-sm w-64 pr-6"
          />
          {contaLabel && (
            <button type="button" title="Limpar (todas)"
              onClick={() => { setConta(''); setContaLabel(''); setContaOpts([]); }}
              className="absolute right-2 top-[26px] text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
          {contaAberto && contaOpts.length > 0 && (
            <div className="absolute z-30 mt-1 w-72 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
              {contaOpts.map((o) => (
                <button key={o.cod_conta} type="button"
                  onMouseDown={() => { setConta(o.cod_conta); setContaLabel(o.label); setContaAberto(false); }}
                  className="block w-full text-left px-2 py-1.5 hover:bg-blue-50 whitespace-nowrap">
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={consultar} disabled={carregando} className="gap-2">
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Pesquisar
        </Button>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir} disabled={!dados} className="gap-2"><Printer className="w-4 h-4" /> Imprimir</Button>
          <Button variant="outline" onClick={exportarExcel} disabled={!dados} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mt-3 shrink-0 border-b border-gray-200">
        {ABAS.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-2 text-sm rounded-t-md ${aba === a.key ? 'bg-blue-700 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {dados ? (
        aba === 'geral' ? (
          <div className="flex-1 min-h-0 mt-2 flex gap-3">
            {/* dois grids empilhados */}
            <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
              <div className="flex-1 min-h-0 flex flex-col gap-1">
                <div className="flex-1 min-h-0"><GridMov linhas={dados.geralEntradas} coluna="ENTRADA" /></div>
                <ResumoRodape linhas={dados.geralEntradas} coluna="ENTRADA" />
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-1">
                <div className="flex-1 min-h-0"><GridMov linhas={dados.geralSaidas} coluna="SAIDA" /></div>
                <ResumoRodape linhas={dados.geralSaidas} coluna="SAIDA" />
              </div>
            </div>
            {/* painel de totais */}
            <div className="w-56 shrink-0 flex flex-col gap-2">
              <div className="border rounded-lg p-3 text-center bg-emerald-50">
                <div className="text-xs text-gray-600">Entradas do Dia</div>
                <div className="text-lg font-bold text-emerald-700">{brl(dados.totalEntrada)}</div>
              </div>
              <div className="border rounded-lg p-3 text-center bg-red-50">
                <div className="text-xs text-gray-600">Saídas do Dia</div>
                <div className="text-lg font-bold text-red-700">{brl(dados.totalSaida)}</div>
              </div>
              <div className="border rounded-lg p-3 text-center bg-blue-50">
                <div className="text-xs text-gray-600">Saldo do Dia</div>
                <div className={`text-lg font-bold ${dados.saldo < 0 ? 'text-red-600' : 'text-blue-700'}`}>{brl(dados.saldo)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 mt-2 flex flex-col gap-2">
            <div className="flex-1 min-h-0"><GridMov linhas={abaAtual(dados)} coluna={colAba} /></div>
            <ResumoRodape linhas={abaAtual(dados)} coluna={colAba} />
          </div>
        )
      ) : (
        !carregando && (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-sm">
            Selecione a data e clique em <span className="font-medium">&nbsp;Pesquisar&nbsp;</span> para ver o movimento do caixa.
          </div>
        )
      )}
    </div>
  );
}
