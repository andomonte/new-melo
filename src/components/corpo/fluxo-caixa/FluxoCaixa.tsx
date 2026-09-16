'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Printer, FileText, FileSpreadsheet, TrendingUp } from 'lucide-react';
import { mascaraInputBRL, desmascarar } from '@/utils/monetario';
import ModalDetalheFluxo, { type DetalheCtx } from './ModalDetalheFluxo';

// ---------- modelo normalizado (comum a mensal e período) ----------
interface Coluna { key: string; label: string }
interface NBucket { atrasados: number; valores: number[] } // valores alinhados às colunas
interface NGrupo extends NBucket { tipo_op: 'E' | 'S'; tipo_mov: 'OP' | 'NOP'; cc: string }
interface Norm {
  modo: 'mensal' | 'periodo';
  cenario?: string;
  temAtrasados: boolean;
  colunas: Coluna[];
  entradas: { grupos: NGrupo[]; total: NBucket };
  saidas: { grupos: NGrupo[]; total: NBucket };
  resultadoDiario: NBucket;
  mes?: number; ano?: number; // p/ drill-down (mensal)
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CENARIO_LABEL: Record<string, string> = { PASSADO: 'Realizado', ATUAL: 'Realizado + Previsto', FUTURO: 'Previsto' };
const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------- helpers de agregação ----------
const nb = (n: number): NBucket => ({ atrasados: 0, valores: new Array(n).fill(0) });
const somaN = (lista: NBucket[], n: number): NBucket => {
  const t = nb(n);
  for (const b of lista) { t.atrasados += b.atrasados || 0; for (let i = 0; i < n; i++) t.valores[i] += b.valores[i] || 0; }
  return t;
};
const subN = (a: NBucket, b: NBucket, n: number): NBucket => {
  const t = nb(n);
  t.atrasados = (a.atrasados || 0) - (b.atrasados || 0);
  for (let i = 0; i < n; i++) t.valores[i] = (a.valores[i] || 0) - (b.valores[i] || 0);
  return t;
};
// Resultado Acumulado = Saldo Inicial + Resultado Diário correndo pelas colunas
const acumular = (rd: NBucket, saldo: number, temAtrasados: boolean): NBucket => {
  let acc = saldo + (temAtrasados ? rd.atrasados || 0 : 0);
  const atrasados = acc;
  const valores = rd.valores.map((v) => (acc += v || 0));
  return { atrasados, valores };
};

type Kind = 'grp' | 'blank' | 'total' | 'saldo' | 'blocoTit' | 'blocoEnt' | 'blocoSai' | 'blocoRd' | 'blocoAcc';
interface Row { c0: string; c1: string; c2: string; b: NBucket | null; kind: Kind }

export default function FluxoCaixa() {
  const agora = new Date();
  const [modo, setModo] = useState<'mensal' | 'periodo'>('mensal');
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [mesFim, setMesFim] = useState(agora.getMonth() + 1);
  const [anoFim, setAnoFim] = useState(agora.getFullYear());
  const [saldoMasc, setSaldoMasc] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<Norm | null>(null);
  const [detalheCtx, setDetalheCtx] = useState<DetalheCtx | null>(null);

  const saldoInicial = desmascarar(saldoMasc) || 0;

  const abrirDetalhe = (r: Row, alvo: string, rotulo: string) => {
    if (r.kind !== 'grp' || !dados || dados.modo !== 'mensal') return;
    setDetalheCtx({ tipo_op: r.c0 as 'E' | 'S', tipo_mov: r.c1 as 'OP' | 'NOP', cc: r.c2, alvo, rotuloAlvo: rotulo, mes: dados.mes!, ano: dados.ano! });
  };

  const consultar = async () => {
    setCarregando(true);
    try {
      if (modo === 'mensal') {
        const q = new URLSearchParams({ mes: String(mes), ano: String(ano), saldo_inicial: String(saldoInicial) });
        const r = await fetch('/api/fluxo-caixa/mensal?' + q.toString());
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao gerar o fluxo de caixa.');
        // normaliza (dias{} → valores[])
        const colunas: Coluna[] = Array.from({ length: d.diasNoMes }, (_, i) => ({ key: String(i + 1), label: 'DIA' + String(i + 1).padStart(2, '0') }));
        const norB = (b: any): NBucket => ({ atrasados: b?.atrasados || 0, valores: colunas.map((_, i) => b?.dias?.[i + 1] || 0) });
        const norG = (g: any): NGrupo => ({ tipo_op: g.tipo_op, tipo_mov: g.tipo_mov, cc: g.cc, ...norB(g) });
        setDados({
          modo: 'mensal', cenario: d.cenario, temAtrasados: true, colunas, mes: d.mes, ano: d.ano,
          entradas: { grupos: d.entradas.grupos.map(norG), total: norB(d.entradas.total) },
          saidas: { grupos: d.saidas.grupos.map(norG), total: norB(d.saidas.total) },
          resultadoDiario: norB(d.resultadoDiario),
        });
      } else {
        const q = new URLSearchParams({ mes_ini: String(mes), ano_ini: String(ano), mes_fim: String(mesFim), ano_fim: String(anoFim) });
        const r = await fetch('/api/fluxo-caixa/periodo?' + q.toString());
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao gerar o fluxo de caixa.');
        const colunas: Coluna[] = d.colunas;
        const norB = (arr: number[]): NBucket => ({ atrasados: 0, valores: arr || [] });
        const norG = (g: any): NGrupo => ({ tipo_op: g.tipo_op, tipo_mov: g.tipo_mov, cc: g.cc, atrasados: 0, valores: g.valores });
        setDados({
          modo: 'periodo', temAtrasados: false, colunas,
          entradas: { grupos: d.entradas.grupos.map(norG), total: norB(d.entradas.total) },
          saidas: { grupos: d.saidas.grupos.map(norG), total: norB(d.saidas.total) },
          resultadoDiario: norB(d.resultadoDiario),
        });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  const nCols = dados?.colunas.length || 0;

  const rows = useMemo<Row[]>(() => {
    if (!dados) return [];
    const n = nCols;
    const out: Row[] = [];
    const ordMov = (m: string) => (m === 'NOP' ? 0 : 1);
    const ord = (g: NGrupo[]) => [...g].sort((a, b) => ordMov(a.tipo_mov) - ordMov(b.tipo_mov) || a.cc.localeCompare(b.cc));

    ord(dados.entradas.grupos).forEach((g) => out.push({ c0: 'E', c1: g.tipo_mov, c2: g.cc, b: g, kind: 'grp' }));
    ord(dados.saidas.grupos).forEach((g) => out.push({ c0: 'S', c1: g.tipo_mov, c2: g.cc, b: g, kind: 'grp' }));

    out.push({ c0: '', c1: '', c2: '', b: null, kind: 'blank' });
    out.push({ c0: 'T', c1: 'TE', c2: 'TOTAL ENTRADAS', b: dados.entradas.total, kind: 'total' });
    out.push({ c0: 'T', c1: 'TS', c2: 'TOTAL SAIDAS', b: dados.saidas.total, kind: 'total' });
    out.push({ c0: 'T', c1: 'TS', c2: 'SALDO', b: dados.resultadoDiario, kind: 'saldo' });

    const entOP = somaN(dados.entradas.grupos.filter((g) => g.tipo_mov === 'OP'), n);
    const entNOP = somaN(dados.entradas.grupos.filter((g) => g.tipo_mov === 'NOP'), n);
    const saiOP = somaN(dados.saidas.grupos.filter((g) => g.tipo_mov === 'OP'), n);
    const saiNOP = somaN(dados.saidas.grupos.filter((g) => g.tipo_mov === 'NOP'), n);
    const bloco = (titulo: string, ent: NBucket, sai: NBucket) => {
      const rd = subN(ent, sai, n);
      const acc = acumular(rd, saldoInicial, dados.temAtrasados);
      out.push({ c0: '', c1: '', c2: titulo, b: null, kind: 'blocoTit' });
      out.push({ c0: '', c1: '', c2: 'Entradas', b: ent, kind: 'blocoEnt' });
      out.push({ c0: '', c1: '', c2: 'Saídas', b: sai, kind: 'blocoSai' });
      out.push({ c0: '', c1: '', c2: 'Resultado Diário', b: rd, kind: 'blocoRd' });
      out.push({ c0: '', c1: '', c2: 'Resultado Acumulado', b: acc, kind: 'blocoAcc' });
    };
    out.push({ c0: '', c1: '', c2: '', b: null, kind: 'blank' });
    bloco('Movimentação Operacional', entOP, saiOP);
    bloco('Movimentação Não Operacional', entNOP, saiNOP);
    bloco('Movimentação Geral', dados.entradas.total, dados.saidas.total);
    return out;
  }, [dados, saldoInicial, nCols]);

  const periodoLabel = () => modo === 'mensal' ? `${MESES[mes - 1]}/${ano}` : `${MESES[mes - 1]}/${ano} a ${MESES[mesFim - 1]}/${anoFim}`;
  const tituloRel = () => `Fluxo de Caixa — ${periodoLabel()}`;
  const baseLabel = () => dados?.modo === 'periodo' ? 'Previsto (por mês)' : (CENARIO_LABEL[dados?.cenario || ''] || '—');

  // ---------- exports ----------
  const cabecalho = () => ['TIPO_OP', 'TIPO_MOV', 'CONTA FINANCEIRA', ...(dados?.temAtrasados ? ['ATRASADOS'] : []), ...(dados?.colunas.map((c) => c.label) || [])];
  const valoresDe = (b: NBucket): number[] => [...(dados?.temAtrasados ? [b.atrasados || 0] : []), ...b.valores];
  const rowParaArray = (r: Row) => [r.c0, r.c1, r.c2, ...(r.b ? valoresDe(r.b) : (dados?.temAtrasados ? [''] : []).concat(dados!.colunas.map(() => '')))];

  const exportarExcel = async () => {
    if (!dados) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Fluxo de Caixa');
      ws.addRow(['MELO DISTRIBUIDORA DE PECAS LTDA.']).font = { bold: true, size: 12 };
      ws.addRow([tituloRel(), '', `Base: ${baseLabel()}`, `Saldo inicial: ${brl(saldoInicial)}`]);
      ws.addRow([]);
      const hr = ws.addRow(cabecalho()); hr.font = { bold: true }; hr.alignment = { horizontal: 'right' };
      hr.getCell(1).alignment = { horizontal: 'left' };
      for (const r of rows) {
        if (r.kind === 'blank') { ws.addRow([]); continue; }
        const row = ws.addRow(rowParaArray(r));
        if (r.kind !== 'grp') row.font = { bold: true };
        row.eachCell((cell, col) => { if (col > 3 && typeof cell.value === 'number') cell.numFmt = '#,##0.00'; });
      }
      ws.getColumn(1).width = 9; ws.getColumn(2).width = 9; ws.getColumn(3).width = 30;
      ws.columns.forEach((c, i) => { if (i > 2) c.width = 14; });
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `fluxo-caixa-${periodoLabel().replace(/[\/ ]/g, '_')}.xlsx`);
    } catch (e: any) { toast.error('Falha ao gerar Excel: ' + (e?.message || '')); }
  };

  const exportarPdf = async () => {
    if (!dados) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      doc.setFontSize(12); doc.text('MELO DISTRIBUIDORA DE PECAS LTDA.', 10, 12);
      doc.setFontSize(9); doc.text(`${tituloRel()}   |   Base: ${baseLabel()}   |   Saldo inicial: ${brl(saldoInicial)}`, 10, 18);
      const bodyRows = rows.filter((r) => r.kind !== 'blank');
      const body = bodyRows.map((r) => [r.c0, r.c1, r.c2, ...(r.b ? valoresDe(r.b).map((v) => brl(v)) : cabecalho().slice(3).map(() => ''))]);
      const negras = new Set(bodyRows.map((r, i) => (r.kind !== 'grp' ? i : -1)));
      autoTable(doc, {
        head: [cabecalho()], body, startY: 22,
        styles: { fontSize: 5.5, cellPadding: 0.6, halign: 'right' },
        headStyles: { fillColor: [30, 64, 175], halign: 'right', fontSize: 5.5 },
        columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 1: { halign: 'center', cellWidth: 12 }, 2: { halign: 'left', cellWidth: 34 } },
        didParseCell: (d: any) => { if (d.section === 'body' && negras.has(d.row.index)) d.cell.styles.fontStyle = 'bold'; },
      });
      doc.save(`fluxo-caixa-${periodoLabel().replace(/[\/ ]/g, '_')}.pdf`);
    } catch (e: any) { toast.error('Falha ao gerar PDF: ' + (e?.message || '')); }
  };

  const imprimir = () => {
    if (!dados) return;
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) return;
    const th = cabecalho().map((h) => `<th>${h}</th>`).join('');
    const nCol = cabecalho().length;
    const trs = rows.map((r) => {
      if (r.kind === 'blank') return `<tr class="vazia"><td colspan="${nCol}"></td></tr>`;
      const forte = r.kind !== 'grp';
      const vals = r.b ? valoresDe(r.b) : null;
      const tds = vals ? vals.map((v) => `<td class="num ${v < 0 ? 'neg' : ''}">${v === 0 ? '–' : brl(v)}</td>`).join('') : `<td colspan="${nCol - 3}"></td>`;
      return `<tr class="${forte ? 'forte' : ''}"><td class="c">${r.c0}</td><td class="c">${r.c1}</td><td class="lbl">${r.c2}</td>${tds}</tr>`;
    }).join('');
    w.document.write(`<html><head><title>${tituloRel()}</title><style>
      body{font-family:Arial,sans-serif;font-size:8px;padding:12px}h2{margin:0}
      table{border-collapse:collapse;width:100%;margin-top:8px}
      th,td{border:1px solid #ccc;padding:2px 4px}
      th{background:#1e40af;color:#fff;text-align:right}th:first-child,th:nth-child(2),th:nth-child(3){text-align:left}
      .num{text-align:right}.lbl{text-align:left;white-space:nowrap}.c{text-align:center}
      .forte{background:#eef2ff;font-weight:bold}.neg{color:#c00}.vazia td{border:none;height:6px}
    </style></head><body>
      <h2>MELO DISTRIBUIDORA DE PECAS LTDA.</h2>
      <div>${tituloRel()} &nbsp;|&nbsp; Base: ${baseLabel()} &nbsp;|&nbsp; Saldo inicial: R$ ${brl(saldoInicial)}</div>
      <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const anos = Array.from({ length: 8 }, (_, i) => agora.getFullYear() - 4 + i);
  const rowClass = (k: Kind) =>
    k === 'total' ? 'bg-gray-100 font-semibold'
    : k === 'saldo' ? 'bg-amber-50 font-semibold'
    : k === 'blocoTit' ? 'bg-indigo-100 font-bold'
    : k === 'blocoAcc' ? 'bg-emerald-50 font-semibold'
    : k === 'blocoRd' ? 'bg-amber-50 font-semibold'
    : (k === 'blocoEnt' || k === 'blocoSai') ? 'bg-white font-medium'
    : 'hover:bg-blue-50';

  const Cel = ({ v, bold, onClick }: { v: number; bold?: boolean; onClick?: () => void }) => {
    const cls = v < 0 ? 'text-red-600' : v === 0 ? 'text-gray-300' : 'text-gray-800';
    const clic = !!onClick && v !== 0;
    return (
      <td onClick={clic ? onClick : undefined}
        className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${bold ? 'font-semibold' : ''} ${cls} ${clic ? 'cursor-pointer hover:bg-blue-100 hover:underline' : ''}`}>
        {v === 0 ? '–' : brl(v)}
      </td>
    );
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <TrendingUp className="w-6 h-6 text-blue-700" />
        <h1 className="text-xl font-bold text-gray-800">Fluxo de Caixa</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Modo</label>
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button onClick={() => setModo('mensal')} className={`px-3 py-1.5 ${modo === 'mensal' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>Mensal</button>
            <button onClick={() => setModo('periodo')} className={`px-3 py-1.5 ${modo === 'periodo' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>Período</button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{modo === 'periodo' ? 'Mês início' : 'Mês'}</label>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{modo === 'periodo' ? 'Ano início' : 'Ano'}</label>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {modo === 'periodo' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mês fim</label>
              <select value={mesFim} onChange={(e) => setMesFim(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ano fim</label>
              <select value={anoFim} onChange={(e) => setAnoFim(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Saldo Inicial (R$)</label>
          <input value={saldoMasc} inputMode="numeric" onChange={(e) => setSaldoMasc(mascaraInputBRL(e.target.value))} placeholder="0,00" className="border rounded px-2 py-1.5 text-sm w-32 text-right" />
        </div>
        <Button onClick={consultar} disabled={carregando} className="gap-2">
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Consultar
        </Button>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir} disabled={!dados} className="gap-2"><Printer className="w-4 h-4" /> Imprimir</Button>
          <Button variant="outline" onClick={exportarPdf} disabled={!dados} className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" onClick={exportarExcel} disabled={!dados} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>
      </div>

      {dados && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <div>Base: <span className="font-medium text-gray-700">{baseLabel()}</span>{' · '}Saldo inicial manual (editável) · negativos em vermelho</div>
          {dados.modo === 'mensal' && (
            <div className="text-[11px] text-gray-400">Clique numa célula de <span className="font-medium">ATRASADOS</span>/<span className="font-medium">DIA</span> (≠ 0) para detalhar e reagendar</div>
          )}
        </div>
      )}

      {dados ? (
        <div className="mt-2 flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg">
          <table className="text-xs min-w-max">
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-800 text-white">
                <th className="px-2 py-2 text-center">TIPO_OP</th>
                <th className="px-2 py-2 text-center">TIPO_MOV</th>
                <th className="px-3 py-2 text-left">CONTA FINANCEIRA</th>
                {dados.temAtrasados && <th className="px-2 py-2 text-right whitespace-nowrap">ATRASADOS</th>}
                {dados.colunas.map((c) => <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                if (r.kind === 'blank') return <tr key={idx}><td colSpan={3 + (dados.temAtrasados ? 1 : 0) + nCols} className="h-2" /></tr>;
                const forte = r.kind !== 'grp';
                const clic = r.kind === 'grp' && dados.modo === 'mensal';
                return (
                  <tr key={idx} className={rowClass(r.kind)}>
                    <td className="px-2 py-1 text-center">{r.c0}</td>
                    <td className="px-2 py-1 text-center">{r.c1}</td>
                    <td className="px-3 py-1 text-left whitespace-nowrap">{r.c2}</td>
                    {r.b ? (
                      <>
                        {dados.temAtrasados && <Cel v={r.b.atrasados || 0} bold={forte} onClick={clic ? () => abrirDetalhe(r, 'ATRASADOS', 'ATRASADOS') : undefined} />}
                        {dados.colunas.map((c, i) => <Cel key={c.key} v={r.b!.valores[i] || 0} bold={forte} onClick={clic ? () => abrirDetalhe(r, c.key, c.label) : undefined} />)}
                      </>
                    ) : (
                      <td colSpan={(dados.temAtrasados ? 1 : 0) + nCols} />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !carregando && (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-sm">
            Selecione o período e clique em <span className="font-medium">&nbsp;Consultar&nbsp;</span> para gerar o fluxo de caixa.
          </div>
        )
      )}

      <ModalDetalheFluxo isOpen={!!detalheCtx} onClose={() => setDetalheCtx(null)} ctx={detalheCtx} onReagendado={consultar} />
    </div>
  );
}
