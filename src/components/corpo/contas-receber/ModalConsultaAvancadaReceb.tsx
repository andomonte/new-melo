'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Printer, FileText, FileSpreadsheet, ChevronRight, ChevronDown, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario?: string;
  filial?: string; // unidade (só MAO no web)
}

interface LinhaCliente { cliente: string; valores: Record<string, number>; total: number }
interface LinhaApi { grupo: string; centro: string; cfinanceira: string; cliente: string; valores: Record<string, number>; total: number }
interface TituloDet {
  nota: string | null; dup: string | null; dt_emissao: string | null; dt_venc: string | null; dt_pgto: string | null;
  valor_pgto: number; valor_pago: number; pago: boolean;
}

const MESES_NOME = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MESES_LONGO = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const rotuloMes = (ref: string) => `${MESES_NOME[Number(ref.slice(4, 6)) - 1] || ref.slice(4, 6)}/${ref.slice(0, 4)}`;
const rotuloMesLongo = (ref: string) => `${MESES_LONGO[Number(ref.slice(4, 6)) - 1] || ref.slice(4, 6)}_${ref.slice(0, 4)}`;
// Download de um Blob sem depender de file-saver (evita import quebrado do saveAs).
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const primeiroDiaMesISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const TIPOS_DATA = [
  { value: 'emissao', label: 'Emissão' },
  { value: 'vencimento', label: 'Vencimento' },
  { value: 'pagamento', label: 'Pagamento' },
];

export default function ModalConsultaAvancadaReceb({ isOpen, onClose, filial }: Props) {
  const [tipoData, setTipoData] = useState('emissao');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [meses, setMeses] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  // Drill-down (detalhe por cliente + conta financeira)
  const [detalhe, setDetalhe] = useState<{ cliente: string; cfinanceira: string; titulos: TituloDet[] } | null>(null);
  const [carregandoDet, setCarregandoDet] = useState(false);

  const consultar = async () => {
    if (!dataInicio || !dataFim) return toast.error('Informe o período.');
    setCarregando(true);
    setBuscou(true);
    try {
      const qs = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim, tipo_data: tipoData });
      const r = await fetch(`/api/contas-receber/consulta-avancada?${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detalhes || d.erro || 'Erro na consulta');
      setMeses(d.meses || []);
      setLinhas(d.linhas || []);
      setColapsados(new Set()); // FullExpand como o Delphi
    } catch (e: any) {
      toast.error(e.message);
      setMeses([]); setLinhas([]);
    } finally {
      setCarregando(false);
    }
  };

  const abrirDetalhe = async (cliente: string, cfinanceira: string) => {
    setCarregandoDet(true);
    setDetalhe({ cliente, cfinanceira, titulos: [] });
    try {
      const qs = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim, tipo_data: tipoData, detalhe: '1', cliente, cfinanceira });
      const r = await fetch(`/api/contas-receber/consulta-avancada?${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detalhes || d.erro || 'Erro no detalhe');
      setDetalhe({ cliente, cfinanceira, titulos: d.titulos || [] });
    } catch (e: any) {
      toast.error(e.message);
      setDetalhe(null);
    } finally {
      setCarregandoDet(false);
    }
  };

  // Árvore Grupo → Centro → CFinanceira → Cliente com subtotais por mês.
  const arvore = useMemo(() => {
    const somaZero = () => { const o: Record<string, number> = {}; meses.forEach((m) => (o[m] = 0)); return o; };
    const grupos = new Map<string, any>();
    for (const l of linhas) {
      let g = grupos.get(l.grupo);
      if (!g) { g = { nome: l.grupo, valores: somaZero(), total: 0, centros: new Map() }; grupos.set(l.grupo, g); }
      let c = g.centros.get(l.centro);
      if (!c) { c = { nome: l.centro, valores: somaZero(), total: 0, contas: new Map() }; g.centros.set(l.centro, c); }
      let cf = c.contas.get(l.cfinanceira);
      if (!cf) { cf = { nome: l.cfinanceira, valores: somaZero(), total: 0, clientes: [] as LinhaCliente[] }; c.contas.set(l.cfinanceira, cf); }
      cf.clientes.push({ cliente: l.cliente, valores: l.valores, total: l.total });
      for (const m of meses) {
        const v = Number(l.valores[m] || 0);
        cf.valores[m] += v; c.valores[m] += v; g.valores[m] += v;
      }
      cf.total += l.total; c.total += l.total; g.total += l.total;
    }
    return grupos;
  }, [linhas, meses]);

  const totalGeral = useMemo(() => {
    const o: Record<string, number> = {}; let t = 0;
    meses.forEach((m) => (o[m] = 0));
    for (const l of linhas) { for (const m of meses) o[m] += Number(l.valores[m] || 0); t += l.total; }
    return { valores: o, total: t };
  }, [linhas, meses]);

  const toggle = (chave: string) =>
    setColapsados((prev) => { const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s; });

  // ── Exportações ──
  const exportarExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('consultaavancada');
      // Layout fiel ao Delphi: colunas A-D = indentação dos níveis (GRUPO/CENTRO/CFINANCEIRA/MELO),
      // col E = CLIENTE, col F.. = meses (AGOSTO_2026), última = TOTAL.
      const negrito = (r: any) => (r.font = { bold: true });
      const hr = ws.addRow(['', '', '', '', 'CLIENTE', ...meses.map(rotuloMesLongo), 'TOTAL']);
      negrito(hr); hr.alignment = { horizontal: 'center' };
      for (const [, g] of arvore) {
        negrito(ws.addRow(['GRUPO : ' + g.nome]));
        for (const [, c] of g.centros) {
          negrito(ws.addRow(['', 'CENTRO : ' + c.nome]));
          for (const [, cf] of c.contas) {
            negrito(ws.addRow(['', '', 'CFINANCEIRA : ' + cf.nome]));
            negrito(ws.addRow(['', '', '', 'MELO : MAO']));
            for (const cli of cf.clientes as LinhaCliente[]) {
              ws.addRow(['', '', '', '', cli.cliente, ...meses.map((m) => Number(cli.valores[m] || 0)), cli.total]);
            }
          }
        }
      }
      negrito(ws.addRow(['', '', '', '', 'TOTAL GERAL', ...meses.map((m) => totalGeral.valores[m]), totalGeral.total]));
      // Larguras e formato numérico
      [1, 2, 3, 4].forEach((i) => (ws.getColumn(i).width = 4));
      ws.getColumn(5).width = 46;
      for (let i = 6; i <= 6 + meses.length; i++) { ws.getColumn(i).width = 15; ws.getColumn(i).numFmt = '#,##0.00'; ws.getColumn(i).alignment = { horizontal: 'right' }; }
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `consulta-avancada-recebimentos-${hojeISO()}.xlsx`);
    } catch (e: any) {
      toast.error('Erro ao exportar Excel: ' + e.message);
    }
  };

  const exportarPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('CONSULTA AVANÇADA — RECEBIMENTOS', 14, 12);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Unidade ${filial || 'MAO'} · ${TIPOS_DATA.find((t) => t.value === tipoData)?.label} · ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`, 14, 17);
      const body: any[] = [];
      for (const [, g] of arvore) {
        body.push([{ content: `GRUPO: ${g.nome}`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }, ...meses.map((m) => ({ content: brl(g.valores[m]), styles: { fontStyle: 'bold', halign: 'right' } })), { content: brl(g.total), styles: { fontStyle: 'bold', halign: 'right' } }]);
        for (const [, c] of g.centros) {
          body.push([{ content: `  CENTRO: ${c.nome}`, colSpan: 4, styles: { fontStyle: 'bold' } }, ...meses.map((m) => ({ content: brl(c.valores[m]), styles: { halign: 'right' } })), { content: brl(c.total), styles: { halign: 'right' } }]);
          for (const [, cf] of c.contas) {
            body.push([{ content: `    ${cf.nome}`, colSpan: 4, styles: { fontStyle: 'italic' } }, ...meses.map((m) => ({ content: brl(cf.valores[m]), styles: { halign: 'right' } })), { content: brl(cf.total), styles: { halign: 'right' } }]);
            for (const cli of cf.clientes as LinhaCliente[]) {
              body.push([{ content: `        ${cli.cliente}`, colSpan: 4 }, ...meses.map((m) => ({ content: brl(cli.valores[m] || 0), styles: { halign: 'right' } })), { content: brl(cli.total), styles: { halign: 'right' } }]);
            }
          }
        }
      }
      body.push([{ content: 'TOTAL GERAL', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [210, 210, 210] } }, ...meses.map((m) => ({ content: brl(totalGeral.valores[m]), styles: { fontStyle: 'bold', halign: 'right' } })), { content: brl(totalGeral.total), styles: { fontStyle: 'bold', halign: 'right' } }]);
      autoTable(doc, {
        startY: 21,
        head: [['Grupo / Centro / Conta / Cliente', '', '', '', ...meses.map(rotuloMes), 'Total']],
        body,
        styles: { fontSize: 6, cellPadding: 0.8 },
        headStyles: { fillColor: [40, 60, 100], fontSize: 6 },
        columnStyles: { 0: { cellWidth: 70 } },
        margin: { left: 8, right: 8 },
      });
      doc.save(`consulta-avancada-recebimentos-${hojeISO()}.pdf`);
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + e.message);
    }
  };

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (!w) return toast.error('Habilite pop-ups para imprimir.');
    const linhasHtml: string[] = [];
    const tdV = (v: number) => `<td style="text-align:right">${brl(v)}</td>`;
    for (const [, g] of arvore) {
      linhasHtml.push(`<tr class="g"><td>GRUPO: ${g.nome}</td>${meses.map((m) => tdV(g.valores[m])).join('')}${tdV(g.total)}</tr>`);
      for (const [, c] of g.centros) {
        linhasHtml.push(`<tr class="c"><td>&nbsp;&nbsp;CENTRO: ${c.nome}</td>${meses.map((m) => tdV(c.valores[m])).join('')}${tdV(c.total)}</tr>`);
        for (const [, cf] of c.contas) {
          linhasHtml.push(`<tr class="cf"><td>&nbsp;&nbsp;&nbsp;&nbsp;${cf.nome}</td>${meses.map((m) => tdV(cf.valores[m])).join('')}${tdV(cf.total)}</tr>`);
          for (const cli of cf.clientes as LinhaCliente[])
            linhasHtml.push(`<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${cli.cliente}</td>${meses.map((m) => tdV(cli.valores[m] || 0)).join('')}${tdV(cli.total)}</tr>`);
        }
      }
    }
    linhasHtml.push(`<tr class="tg"><td>TOTAL GERAL</td>${meses.map((m) => tdV(totalGeral.valores[m])).join('')}${tdV(totalGeral.total)}</tr>`);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Consulta Avançada — Recebimentos</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:16px}
        h2{margin:0 0 4px} .sub{color:#555;margin-bottom:10px;font-size:11px}
        table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:2px 5px}
        th{background:#eee;text-align:right} th:first-child{text-align:left}
        tr.g td{background:#e6e6e6;font-weight:bold} tr.c td{font-weight:bold} tr.cf td{font-style:italic}
        tr.tg td{background:#d2d2d2;font-weight:bold}
      </style></head><body>
      <h2>CONSULTA AVANÇADA — RECEBIMENTOS</h2>
      <div class="sub">Unidade ${filial || 'MAO'} · ${TIPOS_DATA.find((t) => t.value === tipoData)?.label} · ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}</div>
      <table><thead><tr><th>Grupo / Centro / Conta / Cliente</th>${meses.map((m) => `<th>${rotuloMes(m)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${linhasHtml.join('')}</tbody></table>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const colSpanTotal = meses.length + 2;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Consulta Avançada do Financeiro — Recebimentos" width="w-[98%] max-w-[1400px]">
      <div className="space-y-3">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 border-b pb-3">
          <div>
            <label className="text-[11px] text-gray-600 dark:text-gray-300 block mb-1">Filtrar pela data de</label>
            <select value={tipoData} onChange={(e) => setTipoData(e.target.value)} className="h-9 px-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800">
              {TIPOS_DATA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-600 dark:text-gray-300 block mb-1">Data inicial</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <label className="text-[11px] text-gray-600 dark:text-gray-300 block mb-1">Data final</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <label className="text-[11px] text-gray-600 dark:text-gray-300 block mb-1">Unidade</label>
            <div className="h-9 flex items-center font-mono text-sm text-blue-900 dark:text-blue-100">{filial || 'MAO'}</div>
          </div>
          <Button onClick={consultar} disabled={carregando} className="h-9">
            {carregando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />} Visualizar
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="h-9" onClick={imprimir} disabled={linhas.length === 0}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
            <Button variant="outline" className="h-9" onClick={exportarPdf} disabled={linhas.length === 0}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
            <Button variant="outline" className="h-9" onClick={exportarExcel} disabled={linhas.length === 0}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          </div>
        </div>

        {/* Árvore */}
        <div className="border border-gray-200 dark:border-slate-700 rounded overflow-auto max-h-[64vh]">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800 z-10">
              <tr>
                <th className="px-2 py-1.5 text-left min-w-[320px]">Grupo / Centro / Conta / Cliente</th>
                {meses.map((m) => <th key={m} className="px-2 py-1.5 text-right whitespace-nowrap">{rotuloMes(m)}</th>)}
                <th className="px-2 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {!buscou && <tr><td colSpan={colSpanTotal} className="px-3 py-10 text-center text-gray-400">Defina o período e clique em <b>Visualizar</b>.</td></tr>}
              {buscou && !carregando && linhas.length === 0 && <tr><td colSpan={colSpanTotal} className="px-3 py-10 text-center text-gray-400">Nenhum recebimento encontrado no período.</td></tr>}
              {carregando && <tr><td colSpan={colSpanTotal} className="px-3 py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Consultando…</td></tr>}

              {!carregando && [...arvore.values()].map((g: any) => {
                const kg = g.nome;
                const gAberto = !colapsados.has(kg);
                return (
                  <FragmentRows key={kg}>
                    <tr className="bg-gray-200/70 dark:bg-slate-700/60 font-semibold cursor-pointer" onClick={() => toggle(kg)}>
                      <td className="px-2 py-1">{gAberto ? <ChevronDown size={13} className="inline" /> : <ChevronRight size={13} className="inline" />} GRUPO: {g.nome}</td>
                      {meses.map((m) => <td key={m} className="px-2 py-1 text-right">{brl(g.valores[m])}</td>)}
                      <td className="px-2 py-1 text-right">{brl(g.total)}</td>
                    </tr>
                    {gAberto && [...g.centros.values()].map((c: any) => {
                      const kc = `${kg}||${c.nome}`;
                      const cAberto = !colapsados.has(kc);
                      return (
                        <FragmentRows key={kc}>
                          <tr className="bg-gray-100 dark:bg-slate-800/70 font-medium cursor-pointer" onClick={() => toggle(kc)}>
                            <td className="px-2 py-1 pl-5">{cAberto ? <ChevronDown size={12} className="inline" /> : <ChevronRight size={12} className="inline" />} CENTRO: {c.nome}</td>
                            {meses.map((m) => <td key={m} className="px-2 py-1 text-right">{brl(c.valores[m])}</td>)}
                            <td className="px-2 py-1 text-right">{brl(c.total)}</td>
                          </tr>
                          {cAberto && [...c.contas.values()].map((cf: any) => {
                            const kf = `${kc}||${cf.nome}`;
                            const fAberto = !colapsados.has(kf);
                            return (
                              <FragmentRows key={kf}>
                                <tr className="bg-slate-50 dark:bg-slate-800/40 italic cursor-pointer" onClick={() => toggle(kf)}>
                                  <td className="px-2 py-1 pl-8">{fAberto ? <ChevronDown size={12} className="inline" /> : <ChevronRight size={12} className="inline" />} {cf.nome}</td>
                                  {meses.map((m) => <td key={m} className="px-2 py-1 text-right">{brl(cf.valores[m])}</td>)}
                                  <td className="px-2 py-1 text-right">{brl(cf.total)}</td>
                                </tr>
                                {fAberto && (cf.clientes as LinhaCliente[]).map((cli, i) => (
                                  <tr key={cli.cliente + i} className="border-t border-gray-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer" onClick={() => abrirDetalhe(cli.cliente, cf.nome)} title="Ver títulos">
                                    <td className="px-2 py-1 pl-12 text-blue-800 dark:text-blue-300">{cli.cliente}</td>
                                    {meses.map((m) => <td key={m} className="px-2 py-1 text-right">{brl(cli.valores[m] || 0)}</td>)}
                                    <td className="px-2 py-1 text-right font-medium">{brl(cli.total)}</td>
                                  </tr>
                                ))}
                              </FragmentRows>
                            );
                          })}
                        </FragmentRows>
                      );
                    })}
                  </FragmentRows>
                );
              })}

              {!carregando && linhas.length > 0 && (
                <tr className="bg-gray-300/70 dark:bg-slate-600 font-bold border-t-2 border-gray-400">
                  <td className="px-2 py-1.5">TOTAL GERAL</td>
                  {meses.map((m) => <td key={m} className="px-2 py-1.5 text-right">{brl(totalGeral.valores[m])}</td>)}
                  <td className="px-2 py-1.5 text-right">{brl(totalGeral.total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-500">
          {linhas.length > 0 && `${linhas.length} linha(s). `}Clique num <b>cliente</b> para ver os títulos. Soma de <b>valor_pgto</b> por conta
          financeira do movimento (fiel ao Delphi FIN_RECEBMENSAL_DINAMICA). Unidade MAO.
        </p>
      </div>

      {/* Drill-down: títulos do cliente + conta financeira */}
      {detalhe && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700">
              <div className="text-sm font-semibold">
                {detalhe.cliente} <span className="text-gray-400 font-normal">· {detalhe.cfinanceira}</span>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={18} /></button>
            </div>
            <div className="overflow-auto p-3">
              {carregandoDet ? (
                <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Carregando títulos…</div>
              ) : (
                <table className="w-full text-xs tabular-nums">
                  <thead className="bg-gray-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-2 py-1 text-left">Nota</th><th className="px-2 py-1 text-left">Documento</th>
                      <th className="px-2 py-1 text-left">Emissão</th><th className="px-2 py-1 text-left">Venc.</th><th className="px-2 py-1 text-left">Pgto</th>
                      <th className="px-2 py-1 text-right">Valor</th><th className="px-2 py-1 text-right">Pago</th><th className="px-2 py-1 text-center">Rec.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.titulos.length === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center text-gray-400">Sem títulos.</td></tr>}
                    {detalhe.titulos.map((t, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-slate-800">
                        <td className="px-2 py-1">{t.nota || '-'}</td>
                        <td className="px-2 py-1 font-mono">{t.dup || '-'}</td>
                        <td className="px-2 py-1">{t.dt_emissao ? t.dt_emissao.split('-').reverse().join('/') : '-'}</td>
                        <td className="px-2 py-1">{t.dt_venc ? t.dt_venc.split('-').reverse().join('/') : '-'}</td>
                        <td className="px-2 py-1">{t.dt_pgto ? t.dt_pgto.split('-').reverse().join('/') : '-'}</td>
                        <td className="px-2 py-1 text-right">{brl(t.valor_pgto)}</td>
                        <td className="px-2 py-1 text-right">{brl(t.valor_pago)}</td>
                        <td className="px-2 py-1 text-center">
                          <span className={`px-1.5 rounded text-[10px] ${t.pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.pago ? 'S' : 'N'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {detalhe.titulos.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-300 dark:border-slate-600 font-semibold bg-gray-50 dark:bg-slate-800/50">
                        <td colSpan={5} className="px-2 py-1 text-right">Total</td>
                        <td className="px-2 py-1 text-right">{brl(detalhe.titulos.reduce((s, t) => s + t.valor_pgto, 0))}</td>
                        <td className="px-2 py-1 text-right">{brl(detalhe.titulos.reduce((s, t) => s + t.valor_pago, 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Agrupa linhas sem introduzir um elemento no DOM (para <tbody>).
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
