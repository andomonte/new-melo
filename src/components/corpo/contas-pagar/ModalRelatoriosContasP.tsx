'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Loader2, Search, Printer, FileText, FileSpreadsheet, Columns3, GripVertical } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

interface Linha {
  cod_pgto: string; nro_dup: string; nro_nf: string; nome: string;
  cof_id: string | number; conta_financeira: string;
  dt_emissao: string | null; dt_venc: string | null; dt_pgto: string | null;
  valor_pgto: number; valor_pago: number; valor_aberto: number; valor_juros: number;
  tem_nota: string; tem_cobr: string; nome_comprador: string; cod_conta: string; obs: string; paga: string;
}
interface Totais { pgto: number; pago: number; aberto: number; juros: number; qtd: number }
interface Grupo { chave: string; rotulo: string; linhas: Linha[]; subtotais: Totais }
interface Resultado { tipo: string; titulo: string; grupos: Grupo[]; totalGeral: Totais }

const TIPOS = [
  { value: 'periodo', label: 'Por Período' },
  { value: 'conta_financeira', label: 'Por Conta Financeira' },
  { value: 'pagas_sem_nf', label: 'Pagas sem NF' },
  { value: 'comprador', label: 'Por Comprador' },
  { value: 'filtro_tela', label: 'Dados Filtrados da Tela' },
  { value: 'centro_custo', label: 'Por Centro de Custo' },
  { value: 'grupo_centro', label: 'Por Grupo de Centros de Custo' },
];

const EXIGE_PERIODO = new Set(['periodo', 'pagas_sem_nf']);
const PARAM_LABEL: Record<string, string> = {
  conta_financeira: 'Conta Financeira (opcional)',
  pagas_sem_nf: 'Conta Financeira (opcional)',
  comprador: 'Comprador (opcional)',
  centro_custo: 'Centro de Custo (opcional)',
  grupo_centro: 'Grupo de Centros (opcional)',
};

// Catálogo de TODAS as colunas do grid (fiel ao Delphi). tipo: text | num | data
type Col = { key: keyof Linha; label: string; tipo: 'text' | 'num' | 'data' };
const CATALOGO: Col[] = [
  { key: 'cod_pgto', label: 'Cód. Pagto', tipo: 'text' },
  { key: 'nro_dup', label: 'Duplicata', tipo: 'text' },
  { key: 'nome', label: 'Credor', tipo: 'text' },
  { key: 'nro_nf', label: 'Nº NF', tipo: 'text' },
  { key: 'cof_id', label: 'Cód. C.Fin.', tipo: 'text' },
  { key: 'conta_financeira', label: 'Conta Financeira', tipo: 'text' },
  { key: 'dt_emissao', label: 'Emissão', tipo: 'data' },
  { key: 'dt_venc', label: 'Vencimento', tipo: 'data' },
  { key: 'dt_pgto', label: 'Pagamento', tipo: 'data' },
  { key: 'valor_pgto', label: 'Vlr. Pgto', tipo: 'num' },
  { key: 'valor_pago', label: 'Vlr. Pago', tipo: 'num' },
  { key: 'valor_aberto', label: 'Vlr. Aberto', tipo: 'num' },
  { key: 'valor_juros', label: 'Vlr. Juros', tipo: 'num' },
  { key: 'tem_nota', label: 'Tem Nota', tipo: 'text' },
  { key: 'tem_cobr', label: 'Tem Cobr.', tipo: 'text' },
  { key: 'nome_comprador', label: 'Comprador', tipo: 'text' },
  { key: 'cod_conta', label: 'Conta', tipo: 'text' },
  { key: 'obs', label: 'Observação', tipo: 'text' },
  { key: 'paga', label: 'Paga', tipo: 'text' },
];
const CATALOGO_KEYS = CATALOGO.map((c) => c.key as string);
const TOTAIS_KEY: Record<string, keyof Totais> = { valor_pgto: 'pgto', valor_pago: 'pago', valor_aberto: 'aberto', valor_juros: 'juros' };
const SCREEN_KEY = 'contas-pagar-relatorio';

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const primeiroDiaMesISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const fmtData = (d: any) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR'); };
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ModalRelatoriosContasP({ isOpen, onClose, userName }: Props) {
  const [tipo, setTipo] = useState('periodo');
  const [tipoData, setTipoData] = useState<'venc' | 'pgto'>('venc');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [param, setParam] = useState('');
  const [status, setStatus] = useState('');
  const [usarPeriodo, setUsarPeriodo] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  // Gerenciamento de colunas (visíveis + sequência), persistido por usuário.
  const [ordem, setOrdem] = useState<string[]>(CATALOGO_KEYS);
  const [visiveis, setVisiveis] = useState<string[]>(CATALOGO_KEYS);
  const [prefsCarregadas, setPrefsCarregadas] = useState(false);
  const [mostrarColunas, setMostrarColunas] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const temParam = tipo in PARAM_LABEL;

  // Carregar preferências de coluna
  useEffect(() => {
    if (!userName) { setPrefsCarregadas(true); return; }
    fetch(`/api/userPreferences?user=${encodeURIComponent(userName)}&screen=${encodeURIComponent(SCREEN_KEY)}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data?.preferences;
        if (p) {
          const ordSalva: string[] = Array.isArray(p.ordemColunas) ? p.ordemColunas.filter((k: string) => CATALOGO_KEYS.includes(k)) : [];
          const novos = CATALOGO_KEYS.filter((k) => !ordSalva.includes(k));
          if (ordSalva.length) setOrdem([...ordSalva, ...novos]);
          if (Array.isArray(p.colunasVisiveis) && p.colunasVisiveis.length) {
            setVisiveis([...p.colunasVisiveis.filter((k: string) => CATALOGO_KEYS.includes(k)), ...novos]);
          }
        }
      })
      .catch(() => {})
      .finally(() => setPrefsCarregadas(true));
  }, [userName]);

  // Salvar preferências (debounce)
  useEffect(() => {
    if (!prefsCarregadas || !userName) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, screen: SCREEN_KEY, preferences: { colunasVisiveis: visiveis, ordemColunas: ordem } }),
      }).catch(() => {});
    }, 800);
  }, [visiveis, ordem, prefsCarregadas, userName]);

  const colsAtivas = (): Col[] => ordem
    .filter((k) => visiveis.includes(k))
    .map((k) => CATALOGO.find((c) => c.key === k)!)
    .filter(Boolean);

  const valorCol = (c: Col, l: Linha): string => {
    const v: any = (l as any)[c.key];
    if (c.tipo === 'num') return brl(Number(v || 0));
    if (c.tipo === 'data') return fmtData(v);
    return v == null ? '' : String(v);
  };

  const toggleColuna = (k: string) => {
    setVisiveis((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };
  const restaurarColunas = () => { setOrdem(CATALOGO_KEYS); setVisiveis(CATALOGO_KEYS); };

  // Arrastar para reordenar (mesma mecânica do datatable do Contas a Receber)
  const [arrastando, setArrastando] = useState<number | null>(null);
  const handleDragStart = (index: number) => setArrastando(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (arrastando === null || arrastando === index) return;
    setOrdem((prev) => {
      const arr = [...prev];
      const [movido] = arr.splice(arrastando, 1);
      arr.splice(index, 0, movido);
      return arr;
    });
    setArrastando(index);
  };
  const handleDragEnd = () => setArrastando(null);

  const gerar = async () => {
    if (EXIGE_PERIODO.has(tipo) && (!dataInicio || !dataFim)) { toast.error('Informe o período (data inicial e final).'); return; }
    setCarregando(true); setRes(null);
    try {
      const q = new URLSearchParams({ tipo });
      const usaPeriodo = EXIGE_PERIODO.has(tipo) || (tipo !== 'periodo' && usarPeriodo);
      if (tipo === 'periodo') { q.set('tipo_data', tipoData); q.set('data_inicio', dataInicio); q.set('data_fim', dataFim); }
      else if (usaPeriodo && dataInicio && dataFim) { q.set('data_inicio', dataInicio); q.set('data_fim', dataFim); }
      if (temParam && param.trim() && param !== '__TODOS__') q.set('param', param.trim());
      if (tipo === 'filtro_tela' && status) q.set('status', status);
      const r = await fetch(`/api/contas-pagar/consulta-avancada?${q.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Falha ao gerar relatório');
      setRes(data);
      if (!data.grupos?.length) toast.info('Nenhum título encontrado para os filtros informados.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar relatório');
    } finally {
      setCarregando(false);
    }
  };

  // valor de subtotal/total para uma coluna (soma se for coluna de total; senão vazio)
  const valorTotalCol = (c: Col, t: Totais): string => {
    const tk = TOTAIS_KEY[c.key as string];
    return tk ? brl(t[tk] as number) : '';
  };

  // ---------- Impressão ----------
  const imprimir = () => {
    if (!res) return;
    const cols = colsAtivas();
    const w = window.open('', '_blank', 'width=1300,height=800');
    if (!w) { toast.error('Permita pop-ups para imprimir.'); return; }
    const th = cols.map((c) => `<th class="${c.tipo === 'num' ? 'n' : ''}">${c.label}</th>`).join('');
    const tdLinha = (l: Linha) => `<tr>${cols.map((c) => `<td class="${c.tipo === 'num' ? 'n' : ''}">${valorCol(c, l)}</td>`).join('')}</tr>`;
    const linhaResumo = (t: Totais, label: string, cls: string) => {
      let feito = false;
      return `<tr class="${cls}">${cols.map((c, i) => {
        const tk = TOTAIS_KEY[c.key as string];
        if (tk) return `<td class="n">${brl(t[tk] as number)}</td>`;
        if (i === 0 && !feito) { feito = true; return `<td>${label}</td>`; }
        return '<td></td>';
      }).join('')}</tr>`;
    };
    const blocos = res.grupos.map((g) => `
      <tr class="grp"><td colspan="${cols.length}">${g.rotulo} — ${g.subtotais.qtd} título(s)</td></tr>
      ${g.linhas.map(tdLinha).join('')}
      ${linhaResumo(g.subtotais, 'SUBTOTAL', 'sub')}`).join('');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${res.titulo}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:20px;color:#111}
        h1{font-size:14px;margin:0}.sub-h{font-size:11px;color:#444;margin:2px 0 12px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:3px 5px;text-align:left;white-space:nowrap}
        th{background:#eee}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
        tr.grp td{background:#dbe5f1;font-weight:bold}tr.sub td{background:#f2f2f2;font-weight:bold}
        tr.tot td{background:#c9d8ea;font-weight:bold}
      </style></head><body>
      <h1>MELO DISTRIBUIDORA DE PECAS LTDA.</h1>
      <div class="sub-h">${res.titulo} — emitido em ${new Date().toLocaleString('pt-BR')}</div>
      <table><thead><tr>${th}</tr></thead><tbody>${blocos}${linhaResumo(res.totalGeral, `TOTAL GERAL (${res.totalGeral.qtd})`, 'tot')}</tbody></table>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  // ---------- PDF ----------
  const exportarPdf = async () => {
    if (!res) return;
    try {
      const cols = colsAtivas();
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12); doc.text('MELO DISTRIBUIDORA DE PECAS LTDA.', 14, 12);
      doc.setFontSize(9); doc.text(`${res.titulo} — ${new Date().toLocaleString('pt-BR')}`, 14, 18);
      const resumoRow = (t: Totais, label: string, fill: number[]) => {
        let feito = false;
        return cols.map((c, i) => {
          const tk = TOTAIS_KEY[c.key as string];
          if (tk) return { content: brl(t[tk] as number), styles: { halign: 'right', fontStyle: 'bold', fillColor: fill } };
          if (i === 0 && !feito) { feito = true; return { content: label, styles: { fontStyle: 'bold', fillColor: fill } }; }
          return { content: '', styles: { fillColor: fill } };
        });
      };
      const body: any[] = [];
      for (const g of res.grupos) {
        body.push([{ content: `${g.rotulo} — ${g.subtotais.qtd} título(s)`, colSpan: cols.length, styles: { fillColor: [219, 229, 241], fontStyle: 'bold' } }]);
        for (const l of g.linhas) body.push(cols.map((c) => valorCol(c, l)));
        body.push(resumoRow(g.subtotais, 'SUBTOTAL', [242, 242, 242]));
      }
      body.push(resumoRow(res.totalGeral, `TOTAL GERAL (${res.totalGeral.qtd})`, [201, 216, 234]));
      const colStyles: any = {};
      cols.forEach((c, i) => { if (c.tipo === 'num') colStyles[i] = { halign: 'right' }; });
      autoTable(doc, {
        head: [cols.map((c) => c.label)], body, startY: 22,
        styles: { fontSize: 6.5, cellPadding: 1 }, headStyles: { fillColor: [230, 230, 230], textColor: 20 },
        columnStyles: colStyles,
      });
      doc.save(`relatorio-contas-pagar-${tipo}-${hojeISO()}.pdf`);
    } catch (e) {
      toast.error('Erro ao gerar PDF: ' + (e instanceof Error ? e.message : ''));
    }
  };

  // ---------- Excel ----------
  const exportarExcel = async () => {
    if (!res) return;
    try {
      const cols = colsAtivas();
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Relatório');
      ws.addRow(['MELO DISTRIBUIDORA DE PECAS LTDA.']);
      ws.addRow([res.titulo]);
      ws.addRow([`Emitido em ${new Date().toLocaleString('pt-BR')}`]);
      ws.addRow([]);
      const head = ws.addRow(cols.map((c) => c.label)); head.font = { bold: true };
      const celValor = (c: Col, l: Linha) => (c.tipo === 'num' ? Number((l as any)[c.key] || 0) : c.tipo === 'data' ? fmtData((l as any)[c.key]) : (l as any)[c.key] ?? '');
      const resumoArr = (t: Totais, label: string) => {
        let feito = false;
        return cols.map((c, i) => {
          const tk = TOTAIS_KEY[c.key as string];
          if (tk) return t[tk] as number;
          if (i === 0 && !feito) { feito = true; return label; }
          return '';
        });
      };
      for (const g of res.grupos) {
        const gr = ws.addRow([g.rotulo]); gr.font = { bold: true };
        gr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE5F1' } } as any;
        for (const l of g.linhas) ws.addRow(cols.map((c) => celValor(c, l)));
        ws.addRow(resumoArr(g.subtotais, 'SUBTOTAL')).font = { bold: true };
      }
      ws.addRow(resumoArr(res.totalGeral, `TOTAL GERAL (${res.totalGeral.qtd})`)).font = { bold: true };
      cols.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = c.tipo === 'num' ? 14 : c.key === 'nome' || c.key === 'conta_financeira' || c.key === 'obs' ? 30 : 14;
        if (c.tipo === 'num') col.numFmt = '#,##0.00';
      });
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `relatorio-contas-pagar-${tipo}-${hojeISO()}.xlsx`);
    } catch (e) {
      toast.error('Erro ao gerar Excel: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const cols = colsAtivas();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Relatórios — Contas a Pagar" width="w-[97%] max-w-7xl" bodyClassName="overflow-visible">
      <div className="space-y-4 p-1">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Tipo de Relatório</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v); setRes(null); setParam(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {tipo === 'periodo' && (
            <div>
              <Label>Data base</Label>
              <Select value={tipoData} onValueChange={(v) => setTipoData(v as 'venc' | 'pgto')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venc">Data de Vencimento</SelectItem>
                  <SelectItem value="pgto">Data de Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {temParam && (
            <div>
              <Label>{PARAM_LABEL[tipo]}</Label>
              <Autocomplete key={tipo} resetKey={tipo} apiUrl={`/api/contas-pagar/opcoes-relatorio/${tipo}`}
                mapResponse={(d) => d.opcoes || []} value={param} onChange={(v) => setParam(v)} placeholder="— TODOS — (ou busque)" />
            </div>
          )}
          {tipo === 'filtro_tela' && (
            <div>
              <Label>Status</Label>
              <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Período + ações */}
        <div className="flex flex-wrap items-end gap-3">
          {!EXIGE_PERIODO.has(tipo) && tipo !== 'filtro_tela' && (
            <label className="flex items-center gap-2 cursor-pointer select-none" style={{ paddingBottom: 6 }}>
              <input type="checkbox" checked={usarPeriodo} onChange={(e) => setUsarPeriodo(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2f6fa8' }} />
              <span className="text-sm">Filtrar por período (vencimento)</span>
            </label>
          )}
          <div style={{ opacity: EXIGE_PERIODO.has(tipo) || tipo === 'filtro_tela' || usarPeriodo ? 1 : 0.5 }} className="flex items-end gap-3">
            <div>
              <Label>Data inicial{EXIGE_PERIODO.has(tipo) ? ' *' : ''}</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                disabled={!EXIGE_PERIODO.has(tipo) && tipo !== 'filtro_tela' && !usarPeriodo} />
            </div>
            <div>
              <Label>Data final{EXIGE_PERIODO.has(tipo) ? ' *' : ''}</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                disabled={!EXIGE_PERIODO.has(tipo) && tipo !== 'filtro_tela' && !usarPeriodo} />
            </div>
          </div>
          <Button onClick={gerar} disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}Gerar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMostrarColunas((v) => !v)}>
            <Columns3 className="w-4 h-4 mr-1" />Colunas ({visiveis.length}/{CATALOGO.length})
          </Button>
          {res && res.grupos.length > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={imprimir}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
              <Button variant="outline" size="sm" onClick={exportarPdf}><FileText className="w-4 h-4 mr-1" />PDF</Button>
              <Button variant="outline" size="sm" onClick={exportarExcel}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
            </div>
          )}
        </div>

        {/* Gerenciador de colunas */}
        {mostrarColunas && (
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Gerenciar Colunas (marque para exibir; arraste para ordenar)</span>
              <button type="button" onClick={restaurarColunas} className="text-xs text-blue-600 hover:underline">Restaurar padrão</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-60 overflow-auto">
              {ordem.map((k, idx) => {
                const c = CATALOGO.find((x) => x.key === k)!;
                return (
                  <div
                    key={k}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-2 py-1 rounded border bg-white dark:bg-zinc-800 cursor-move select-none ${arrastando === idx ? 'opacity-50 bg-blue-50 dark:bg-blue-900/20 border-blue-400' : ''}`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <input type="checkbox" checked={visiveis.includes(k)} onChange={() => toggleColuna(k)} onClick={(e) => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: '#2f6fa8' }} />
                    <span className="text-xs flex-1 truncate">{c.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resultado */}
        {res && res.grupos.length > 0 && (
          <div className="border rounded-md overflow-auto max-h-[50vh]">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                <tr>{cols.map((c) => <th key={c.key as string} className={`px-2 py-1 border-b text-left ${c.tipo === 'num' ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {res.grupos.map((g) => (
                  <FragmentGrupo key={g.chave} g={g} cols={cols} valorCol={valorCol} valorTotalCol={valorTotalCol} />
                ))}
                <tr className="bg-blue-100 dark:bg-blue-900/40 font-bold">
                  {cols.map((c, i) => {
                    const tk = TOTAIS_KEY[c.key as string];
                    return <td key={c.key as string} className={`px-2 py-1 ${c.tipo === 'num' ? 'text-right tabular-nums' : ''}`}>{tk ? valorTotalCol(c, res.totalGeral) : i === 0 ? `TOTAL GERAL (${res.totalGeral.qtd})` : ''}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {res && res.grupos.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum título encontrado para os filtros informados.</p>
        )}
      </div>
    </Modal>
  );
}

function FragmentGrupo({ g, cols, valorCol, valorTotalCol }: {
  g: Grupo; cols: Col[];
  valorCol: (c: Col, l: Linha) => string;
  valorTotalCol: (c: Col, t: Totais) => string;
}) {
  return (
    <>
      <tr className="bg-slate-200 dark:bg-slate-700 font-semibold">
        <td className="px-2 py-1" colSpan={cols.length}>{g.rotulo} — {g.subtotais.qtd} título(s)</td>
      </tr>
      {g.linhas.map((l, i) => (
        <tr key={g.chave + '_' + i} className="border-b hover:bg-gray-50 dark:hover:bg-zinc-800/50">
          {cols.map((c) => <td key={c.key as string} className={`px-2 py-1 ${c.tipo === 'num' ? 'text-right tabular-nums' : ''} ${c.key === 'cod_pgto' || c.key === 'nro_dup' ? 'font-mono' : ''}`}>{valorCol(c, l)}</td>)}
        </tr>
      ))}
      <tr className="bg-gray-100 dark:bg-zinc-800 font-semibold">
        {cols.map((c, i) => {
          const isTot = c.key === 'valor_pgto' || c.key === 'valor_pago' || c.key === 'valor_aberto' || c.key === 'valor_juros';
          return <td key={c.key as string} className={`px-2 py-1 ${c.tipo === 'num' ? 'text-right tabular-nums' : ''}`}>{isTot ? valorTotalCol(c, g.subtotais) : i === 0 ? 'SUBTOTAL' : ''}</td>;
        })}
      </tr>
    </>
  );
}
