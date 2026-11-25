/**
 * Tela padrão dos relatórios migrados do Delphi (Relatórios › Gerenciais).
 * Pede a definição do relatório à API (/api/relatorios/gerenciais/<slug>), monta os filtros,
 * executa e mostra a grade com quebra (subtotal) e total, ordenação por coluna, busca rápida
 * e exportação para Excel e PDF — no lugar do QuickReport/"Copiar para Excel" do Delphi.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Loader2, Play, X, Hourglass } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Autocomplete } from '@/components/common/Autocomplete';
import type { ColunaDef, DefinicaoRelatorio, FiltroDef } from '@/lib/relatorios/tipos';

const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' });
const dataPadrao = (v: any) => {
  if (v === 'hoje') return hojeISO();
  if (v === 'inicio_mes') return `${hojeISO().slice(0, 8)}01`;
  if (v === 'inicio_ano') return `${hojeISO().slice(0, 5)}01-01`;
  if (typeof v === 'string' && /^-?\d+d$/.test(v)) {
    const [y, m, d] = hojeISO().split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + parseInt(v, 10))).toISOString().slice(0, 10);
  }
  return typeof v === 'string' ? v : '';
};
const dataBR = (s: any) => {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s ?? '');
};

function formatar(v: any, tipo?: ColunaDef['tipo']) {
  if (v == null || v === '') return '';
  switch (tipo) {
    case 'moeda': return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'numero': return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    case 'inteiro': return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    case 'percentual': return `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    case 'data': return dataBR(v);
    default: return String(v);
  }
}
const SPAN: Record<number, string> = { 1: '', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' };
const numerico = (t?: ColunaDef['tipo']) => t === 'moeda' || t === 'numero' || t === 'inteiro' || t === 'percentual';

function valoresIniciais(filtros: FiltroDef[]) {
  const v: Record<string, any> = {};
  for (const f of filtros) {
    if (f.tipo === 'periodo') {
      v.de = dataPadrao(f.padrao?.de ?? 'inicio_mes');
      v.ate = dataPadrao(f.padrao?.ate ?? 'hoje');
    } else if (f.tipo === 'data') v[f.campo] = dataPadrao(f.padrao ?? 'hoje');
    else if (f.tipo === 'mes') v[f.campo] = f.padrao ?? hojeISO().slice(0, 7);
    else if (f.tipo === 'checkbox') v[f.campo] = !!f.padrao;
    else if (f.tipo === 'lookup' && f.multiplo) v[f.campo] = [];
    else v[f.campo] = f.padrao ?? (f.tipo === 'select' && f.opcoes?.[0] ? f.opcoes[0].valor : '');
  }
  return v;
}

/** Lookup de cadastro com seleção múltipla (chips). */
function LookupMultiplo({ f, valor, onChange }: { f: FiltroDef; valor: { value: string; label: string }[]; onChange: (v: { value: string; label: string }[]) => void }) {
  const [chave, setChave] = useState(0);
  return (
    <div>
      <Autocomplete apiUrl={`/api/relatorios/lookup/${f.lookup}`} value={null} resetKey={chave}
        placeholder={`Buscar ${f.rotulo.toLowerCase()}...`} mapResponse={(d) => d.itens || []}
        onChange={(v, op) => {
          if (v && !valor.some((x) => x.value === v)) onChange([...valor, { value: v, label: op?.label || v }]);
          setChave((k) => k + 1);
        }} />
      {valor.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {valor.map((x) => (
            <span key={x.value} className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
              {x.label}
              <button type="button" onClick={() => onChange(valor.filter((y) => y.value !== x.value))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RelatorioPadrao({ slug, api = '/api/relatorios/gerenciais' }: { slug: string; api?: string }) {
  const [def, setDef] = useState<DefinicaoRelatorio | null>(null);
  const [valores, setValores] = useState<Record<string, any>>({});
  const [rotulosMulti, setRotulosMulti] = useState<Record<string, { value: string; label: string }[]>>({});
  const [resultado, setResultado] = useState<any>(null);
  const [executando, setExecutando] = useState(false);
  const [ordem, setOrdem] = useState<{ campo: string; asc: boolean } | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setDef(null); setResultado(null); setOrdem(null); setBusca('');
    fetch(`${api}/${slug}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.erro || 'Relatório não encontrado'); return j; })
      .then((j: DefinicaoRelatorio) => { setDef(j); setValores(valoresIniciais(j.filtros)); setRotulosMulti({}); })
      .catch((e) => toast.error(e.message));
  }, [api, slug]);

  const set = (campo: string, v: any) => setValores((p) => ({ ...p, [campo]: v }));

  const executar = useCallback(async () => {
    if (!def) return;
    setExecutando(true);
    try {
      const r = await fetch(`${api}/${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filtros: valores }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.erro || 'Erro ao gerar o relatório');
      setResultado(j);
      setOrdem(null);
      (j.avisos || []).forEach((a: string) => toast.warning(a, { duration: 10000 }));
      if (!j.linhas?.length) toast.info('Nenhum registro para os filtros informados.');
    } catch (e: any) {
      toast.error(e.message, { duration: 10000 });
    } finally {
      setExecutando(false);
    }
  }, [api, slug, def, valores]);

  const colunas: ColunaDef[] = resultado?.colunas || def?.colunas || [];
  const quebra: string | null = resultado ? (resultado.quebra === undefined ? def?.quebra ?? null : resultado.quebra) : def?.quebra ?? null;

  const linhas = useMemo(() => {
    let l: any[] = resultado?.linhas || [];
    const b = busca.trim().toLowerCase();
    if (b) l = l.filter((x) => colunas.some((c) => String(x[c.campo] ?? '').toLowerCase().includes(b)));
    if (ordem) {
      const c = colunas.find((x) => x.campo === ordem.campo);
      l = [...l].sort((a, z) => {
        const va = a[ordem.campo], vz = z[ordem.campo];
        const r = numerico(c?.tipo) ? Number(va || 0) - Number(vz || 0) : String(va ?? '').localeCompare(String(vz ?? ''), 'pt-BR', { numeric: true });
        return ordem.asc ? r : -r;
      });
    }
    return l;
  }, [resultado, busca, ordem, colunas]);

  const somar = (ls: any[]) => {
    const t: Record<string, number> = {};
    for (const c of colunas) if (c.total) t[c.campo] = ls.reduce((s, x) => s + (Number(x[c.campo]) || 0), 0);
    return t;
  };
  const totalGeral = useMemo(() => ({ ...somar(linhas), ...(busca ? {} : resultado?.totais || {}) }), // eslint-disable-line react-hooks/exhaustive-deps
    [linhas, resultado, busca]);
  const temTotal = colunas.some((c) => c.total) || !!resultado?.totais;

  // linhas da grade com subtotais da quebra (só sem ordenação manual)
  const linhasGrade = useMemo(() => {
    if (!quebra || ordem) return linhas.map((l) => ({ tipo: 'linha', l }));
    const out: any[] = [];
    let atual: any = Symbol('inicio');
    let grupo: any[] = [];
    const fecha = () => { if (grupo.length && colunas.some((c) => c.total)) out.push({ tipo: 'sub', l: somar(grupo), rotulo: atual }); };
    for (const l of linhas) {
      if (l[quebra] !== atual) { fecha(); atual = l[quebra]; grupo = []; out.push({ tipo: 'grupo', rotulo: atual }); }
      grupo.push(l);
      out.push({ tipo: 'linha', l });
    }
    fecha();
    return out;
  }, [linhas, quebra, ordem, colunas]); // eslint-disable-line react-hooks/exhaustive-deps

  const colunasVisiveis = colunas.filter((c) => c.campo !== quebra);
  const rotuloQuebra = colunas.find((c) => c.campo === quebra)?.titulo || '';

  const descreverFiltros = () => (def?.filtros || []).map((f) => {
    if (f.tipo === 'periodo') return valores.de || valores.ate ? `${f.rotulo}: ${dataBR(valores.de)} a ${dataBR(valores.ate)}` : '';
    const v = valores[f.campo];
    if (f.tipo === 'lookup' && f.multiplo) return (rotulosMulti[f.campo] || []).length ? `${f.rotulo}: ${(rotulosMulti[f.campo] || []).map((x) => x.label).join(', ')}` : '';
    if (f.tipo === 'select') return v ? `${f.rotulo}: ${f.opcoes?.find((o) => o.valor === v)?.rotulo || v}` : '';
    if (f.tipo === 'checkbox') return v ? f.rotulo : '';
    return v ? `${f.rotulo}: ${f.tipo === 'data' ? dataBR(v) : v}` : '';
  }).filter(Boolean).join(' · ');

  const exportarExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(def!.titulo.slice(0, 31));
    ws.addRow([def!.titulo]).font = { bold: true, size: 13 };
    ws.addRow([descreverFiltros()]);
    (resultado?.resumo || []).forEach((r: string) => ws.addRow([r]));
    ws.addRow([]);
    const cab = ws.addRow(colunas.map((c) => c.titulo));
    cab.font = { bold: true };
    for (const l of linhas) {
      ws.addRow(colunas.map((c) => {
        const v = l[c.campo];
        if (v == null || v === '') return null;
        if (numerico(c.tipo)) return Number(v);
        if (c.tipo === 'data') return dataBR(v);
        return v;
      }));
    }
    if (temTotal) ws.addRow(colunas.map((c, i) => (i === 0 ? 'TOTAL' : totalGeral[c.campo] ?? null))).font = { bold: true };
    colunas.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(60, Math.max(10, c.titulo.length + 2, ...linhas.slice(0, 200).map((l) => String(l[c.campo] ?? '').length + 2)));
      if (c.tipo === 'moeda') col.numFmt = '#,##0.00';
      if (c.tipo === 'numero') col.numFmt = '#,##0.00##';
      if (c.tipo === 'percentual') col.numFmt = '0.00';
    });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}-${hojeISO()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: def!.paisagem || colunas.length > 7 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    doc.setFontSize(12); doc.text(def!.titulo, 30, 30);
    doc.setFontSize(8);
    const cabecalho = doc.splitTextToSize([descreverFiltros(), ...(resultado?.resumo || [])].filter(Boolean).join('\n') || ' ', doc.internal.pageSize.getWidth() - 60);
    doc.text(cabecalho, 30, 44);
    const corpo: any[] = [];
    for (const g of linhasGrade) {
      if (g.tipo === 'grupo') corpo.push([{ content: `${rotuloQuebra}: ${g.rotulo ?? '-'}`, colSpan: colunasVisiveis.length, styles: { fontStyle: 'bold', fillColor: [235, 240, 250] } }]);
      else if (g.tipo === 'sub') corpo.push(colunasVisiveis.map((c, i) => ({ content: i === 0 ? 'Subtotal' : c.total ? formatar(g.l[c.campo], c.tipo) : '', styles: { fontStyle: 'bold' } })));
      else corpo.push(colunasVisiveis.map((c) => formatar(g.l[c.campo], c.tipo)));
    }
    autoTable(doc, {
      startY: 50 + cabecalho.length * 10,
      head: [colunasVisiveis.map((c) => c.titulo)],
      body: corpo,
      foot: temTotal ? [colunasVisiveis.map((c, i) => (i === 0 ? 'TOTAL' : totalGeral[c.campo] != null ? formatar(totalGeral[c.campo], c.tipo) : ''))] : undefined,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(colunasVisiveis.map((c, i) => [i, { halign: numerico(c.tipo) ? 'right' : 'left' }])),
      didDrawPage: () => {
        const n = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.text(`Página ${n} · emitido em ${new Date().toLocaleString('pt-BR')}`, 30, doc.internal.pageSize.getHeight() - 15);
      },
    });
    doc.save(`${slug}-${hojeISO()}.pdf`);
  };

  if (!def) return <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…</div>;

  const th = 'px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap select-none cursor-pointer';
  const td = 'px-2 py-1 text-sm whitespace-nowrap';

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2">
        <h1 className="text-lg font-semibold">{def.titulo}</h1>
        {def.descricao && <p className="text-xs text-gray-500 dark:text-gray-400">{def.descricao}</p>}
      </div>

      {def.pendente ? (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0" />
          <div><div className="font-semibold">Relatório ainda não disponível</div><div className="mt-1 whitespace-pre-wrap">{def.pendente}</div></div>
        </div>
      ) : (
        <>
          {def.filtros.length > 0 && (
            <div className="mb-3 grid grid-cols-1 gap-3 rounded-md border border-gray-200 p-3 dark:border-zinc-700 md:grid-cols-4">
              {def.filtros.map((f) => (
                <div key={f.campo} className={SPAN[f.largura || (f.tipo === 'periodo' || (f.tipo === 'lookup' && f.multiplo) ? 2 : 1)]} title={f.ajuda}>
                  {f.tipo !== 'checkbox' && <Label>{f.rotulo}{f.obrigatorio ? ' *' : ''}</Label>}
                  {f.tipo === 'periodo' && (
                    <div className="flex items-center gap-2">
                      <Input type="date" value={valores.de || ''} onChange={(e) => set('de', e.target.value)} />
                      <span className="text-xs text-gray-500">até</span>
                      <Input type="date" value={valores.ate || ''} onChange={(e) => set('ate', e.target.value)} />
                    </div>
                  )}
                  {f.tipo === 'data' && <Input type="date" value={valores[f.campo] || ''} onChange={(e) => set(f.campo, e.target.value)} />}
                  {f.tipo === 'mes' && <Input type="month" value={valores[f.campo] || ''} onChange={(e) => set(f.campo, e.target.value)} />}
                  {(f.tipo === 'texto' || f.tipo === 'numero') && (
                    <Input type={f.tipo === 'numero' ? 'number' : 'text'} value={valores[f.campo] ?? ''} onChange={(e) => set(f.campo, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && executar()} />
                  )}
                  {f.tipo === 'select' && (
                    <select value={valores[f.campo] ?? ''} onChange={(e) => set(f.campo, e.target.value)}
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800">
                      {!f.obrigatorio && !f.padrao && <option value="">Todos</option>}
                      {(f.opcoes || []).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                    </select>
                  )}
                  {f.tipo === 'checkbox' && (
                    <label className="mt-6 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!valores[f.campo]} onChange={(e) => set(f.campo, e.target.checked)} /> {f.rotulo}
                    </label>
                  )}
                  {f.tipo === 'lookup' && !f.multiplo && (
                    <Autocomplete apiUrl={`/api/relatorios/lookup/${f.lookup}`} value={valores[f.campo] || null}
                      placeholder={`Buscar ${f.rotulo.toLowerCase()}...`} mapResponse={(d) => d.itens || []}
                      onChange={(v) => set(f.campo, v || '')} />
                  )}
                  {f.tipo === 'lookup' && f.multiplo && (
                    <LookupMultiplo f={f} valor={rotulosMulti[f.campo] || []}
                      onChange={(lista) => { setRotulosMulti((p) => ({ ...p, [f.campo]: lista })); set(f.campo, lista.map((x) => x.value)); }} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button onClick={executar} disabled={executando}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {executando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Gerar relatório
            </button>
            {resultado?.linhas?.length > 0 && (
              <>
                <button onClick={exportarExcel} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700">
                  <FileSpreadsheet className="h-4 w-4 text-green-700" /> Excel
                </button>
                <button onClick={exportarPdf} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700">
                  <FileText className="h-4 w-4 text-red-600" /> PDF / Imprimir
                </button>
                <Input className="ml-auto h-9 w-64" placeholder="Filtrar na tabela..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <span className="text-xs text-gray-500">{linhas.length.toLocaleString('pt-BR')} linha(s){resultado.ms ? ` · ${(resultado.ms / 1000).toFixed(1)} s` : ''}</span>
              </>
            )}
          </div>

          {resultado?.resumo?.length > 0 && (
            <div className="mb-2 space-y-0.5 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              {resultado.resumo.map((r: string) => <div key={r}>{r}</div>)}
            </div>
          )}

          {resultado && (
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200 dark:border-zinc-700">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800">
                  <tr>
                    {colunasVisiveis.map((c) => (
                      <th key={c.campo} className={`${th} ${numerico(c.tipo) ? 'text-right' : 'text-left'}`}
                        onClick={() => setOrdem((o) => (o?.campo === c.campo ? { campo: c.campo, asc: !o.asc } : { campo: c.campo, asc: true }))}>
                        {c.titulo}
                        {ordem?.campo === c.campo && (ordem.asc ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasGrade.length === 0 ? (
                    <tr><td colSpan={colunasVisiveis.length || 1} className="p-8 text-center text-sm text-gray-500">Nenhum registro.</td></tr>
                  ) : linhasGrade.map((g, i) => g.tipo === 'grupo' ? (
                    <tr key={i} className="bg-blue-50 dark:bg-blue-950/30">
                      <td colSpan={colunasVisiveis.length} className="px-2 py-1 text-sm font-semibold">{rotuloQuebra}: {g.rotulo ?? '-'}</td>
                    </tr>
                  ) : g.tipo === 'sub' ? (
                    <tr key={i} className="border-b border-gray-300 bg-gray-50 font-semibold dark:border-zinc-600 dark:bg-zinc-800/60">
                      {colunasVisiveis.map((c, k) => (
                        <td key={c.campo} className={`${td} ${numerico(c.tipo) ? 'text-right tabular-nums' : ''}`}>{k === 0 ? 'Subtotal' : c.total ? formatar(g.l[c.campo], c.tipo) : ''}</td>
                      ))}
                    </tr>
                  ) : (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                      {colunasVisiveis.map((c) => (
                        <td key={c.campo} className={`${td} ${numerico(c.tipo) ? 'text-right tabular-nums' : ''}`}>{formatar(g.l[c.campo], c.tipo)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {temTotal && linhas.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-gray-200 font-semibold dark:bg-zinc-700">
                    <tr>
                      {colunasVisiveis.map((c, k) => (
                        <td key={c.campo} className={`${td} ${numerico(c.tipo) ? 'text-right tabular-nums' : ''}`}>
                          {k === 0 && totalGeral[c.campo] == null ? 'TOTAL' : totalGeral[c.campo] != null ? formatar(totalGeral[c.campo], c.tipo) : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
