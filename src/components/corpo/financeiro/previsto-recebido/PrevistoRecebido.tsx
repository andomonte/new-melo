'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Search, CalendarClock, Printer, FileSpreadsheet, X } from 'lucide-react';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dbr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

interface Linha {
  dia: number; data: string; previsto: number; recebido: number; saldo: number;
  pct_recebido: number; situacao: 'ATRASADO' | 'HOJE' | 'A_VENCER';
}
interface Total { previsto: number; recebido: number; saldo: number; atrasado: number; aVencer: number }
interface Dados { ano: number; mes: number; hoje: string; linhas: Linha[]; total: Total }

const SIT_LABEL: Record<string, string> = { ATRASADO: 'Atrasado', HOJE: 'Hoje', A_VENCER: 'A vencer' };

export default function PrevistoRecebido() {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);

  const anos = Array.from({ length: 11 }, (_, i) => agora.getFullYear() - 5 + i);

  const consultar = async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ mes: String(mes), ano: String(ano) });
      const r = await fetch('/api/financeiro/previsto-recebido?' + q.toString());
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao gerar o relatório.');
      setDados(d);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  const nomeMes = MESES[mes - 1];
  const [detalhe, setDetalhe] = useState<{ dia: number; data: string; tipo: 'previsto' | 'recebido' | 'saldo' } | null>(null);

  const exportarExcel = async () => {
    if (!dados) return;
    const XLSX = await import('xlsx');
    const linhas: any[] = dados.linhas.map((l) => ({
      Dia: `DIA${String(l.dia).padStart(2, '0')}`, Data: dbr(l.data), Situacao: SIT_LABEL[l.situacao],
      Previsto: l.previsto, Recebido: l.recebido, Saldo: l.saldo, 'Pct_Recebido': l.pct_recebido,
    }));
    linhas.push({ Dia: 'TOTAL', Data: '', Situacao: '', Previsto: dados.total.previsto, Recebido: dados.total.recebido, Saldo: dados.total.saldo, Pct_Recebido: dados.total.previsto > 0 ? Math.round((dados.total.recebido / dados.total.previsto) * 100) : 0 });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Previsto x Recebido');
    XLSX.writeFile(wb, `previsto_recebido_${nomeMes}_${ano}.xlsx`);
  };

  const imprimir = () => {
    if (!dados) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) { toast.error('Pop-up bloqueado pelo navegador.'); return; }
    const tt = dados.total;
    const corS = (l: Linha) => (l.saldo <= 0 ? '#059669' : l.situacao === 'ATRASADO' ? '#dc2626' : '#d97706');
    const body = dados.linhas.map((l) => `<tr>
      <td>DIA${String(l.dia).padStart(2, '0')} · ${dbr(l.data)}</td><td>${SIT_LABEL[l.situacao]}</td>
      <td class="num">${brl(l.previsto)}</td><td class="num" style="color:#059669">${brl(l.recebido)}</td>
      <td class="num" style="color:${corS(l)}">${brl(l.saldo)}</td><td class="num">${l.pct_recebido.toFixed(0)}%</td></tr>`).join('');
    w.document.write(`<html><head><title>Previsto x Recebido</title><style>
      @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}
      h1{font-size:16px;margin:0 0 2px;color:#1d4ed8}.sub{color:#555;margin-bottom:10px;font-size:11px}
      .cards{display:flex;gap:10px;margin-bottom:10px}.card{border:1px solid #ccc;border-radius:6px;padding:6px 10px;flex:1;font-size:11px}
      .card b{display:block;font-size:14px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #bbb;padding:4px 8px;text-align:left}th{background:#1d4ed8;color:#fff}
      .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tfoot td{font-weight:bold;background:#eee}</style></head><body>
      <h1>Previsto × Recebido (Atrasados)</h1>
      <div class="sub">${nomeMes.toUpperCase()}/${ano} · MELO DISTRIBUIDORA DE PECAS LTDA · impresso em ${new Date().toLocaleString('pt-BR')}</div>
      <div class="cards"><div class="card">Previsto no mês <b>${brl(tt.previsto)}</b></div>
      <div class="card">Recebido <b style="color:#059669">${brl(tt.recebido)}</b></div>
      <div class="card">Atrasado <b style="color:#dc2626">${brl(tt.atrasado)}</b></div>
      <div class="card">A vencer <b style="color:#d97706">${brl(tt.aVencer)}</b></div></div>
      <table><thead><tr><th>Dia</th><th>Situação</th><th class="num">Previsto</th><th class="num">Recebido</th><th class="num">Saldo</th><th class="num">% Rec.</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="2">TOTAL</td><td class="num">${brl(tt.previsto)}</td><td class="num">${brl(tt.recebido)}</td><td class="num">${brl(tt.saldo)}</td><td class="num">${tt.previsto > 0 ? Math.round((tt.recebido / tt.previsto) * 100) : 0}%</td></tr></tfoot></table>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const abrir = (l: Linha, tipo: 'previsto' | 'recebido' | 'saldo') => setDetalhe({ dia: l.dia, data: l.data, tipo });

  const corSaldo = (l: Linha) =>
    l.saldo <= 0 ? 'text-emerald-600 dark:text-emerald-400'
      : l.situacao === 'ATRASADO' ? 'text-red-600 dark:text-red-400 font-semibold'
        : 'text-amber-600 dark:text-amber-400';
  const badgeSit = (s: string) =>
    s === 'ATRASADO' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : s === 'HOJE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

  const t = dados?.total;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Cabeçalho + controles */}
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-3">
          <CalendarClock size={22} /> Previsto × Recebido (Atrasados)
        </h1>
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Mês</label>
            <select value={mes} onChange={(e) => setMes(+e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ano</label>
            <select value={ano} onChange={(e) => setAno(+e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Button onClick={consultar} disabled={carregando} className="bg-gray-800 hover:bg-gray-900 text-white h-10">
            {carregando ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Consultar
          </Button>
          {dados && dados.linhas.length > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button onClick={imprimir} variant="outline" className="h-10 gap-1"><Printer size={16} /> Imprimir</Button>
              <Button onClick={exportarExcel} variant="outline" className="h-10 gap-1"><FileSpreadsheet size={16} /> Excel</Button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Coorte por <b>dia de fluxo</b> (dia útil, D+1). Para cada dia: quanto era <b>previsto</b> receber e quanto já foi
          <b> recebido</b> desses títulos. Saldo de dia passado = <span className="text-red-600 dark:text-red-400">atrasado</span>;
          futuro = <span className="text-amber-600 dark:text-amber-400">a vencer</span>.
        </p>

        {/* Cards de total */}
        {t && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Card titulo="Previsto no mês" valor={brl(t.previsto)} cor="text-gray-900 dark:text-white" />
            <Card titulo="Recebido" valor={brl(t.recebido)} cor="text-emerald-600 dark:text-emerald-400" />
            <Card titulo="Atrasado (venceu)" valor={brl(t.atrasado)} cor="text-red-600 dark:text-red-400" />
            <Card titulo="A vencer" valor={brl(t.aVencer)} cor="text-amber-600 dark:text-amber-400" />
          </div>
        )}
      </div>

      {/* Tabela diária */}
      <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
        {dados && dados.linhas.length > 0 ? (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-700 text-white sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 text-left">Dia</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                  <th className="px-3 py-2 text-right">Previsto</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">% Rec.</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {dados.linhas.map((l) => (
                  <tr key={l.dia} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-medium tabular-nums">DIA{String(l.dia).padStart(2, '0')} <span className="text-gray-400 text-xs">· {dbr(l.data)}</span></td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeSit(l.situacao)}`}>{SIT_LABEL[l.situacao]}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums cursor-pointer hover:underline" onClick={() => abrir(l, 'previsto')} title="Ver títulos previstos">{brl(l.previsto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline" onClick={() => l.recebido > 0 && abrir(l, 'recebido')} title="Ver títulos recebidos">{brl(l.recebido)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums cursor-pointer hover:underline ${corSaldo(l)}`} onClick={() => l.saldo > 0 && abrir(l, 'saldo')} title="Ver títulos a receber">{brl(l.saldo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.pct_recebido.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-800 font-bold sticky bottom-0 z-10">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(t!.previsto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{brl(t!.recebido)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(t!.saldo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t!.previsto > 0 ? ((t!.recebido / t!.previsto) * 100).toFixed(0) : 0}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-16">
            {carregando ? 'Consultando…' : 'Selecione o mês/ano e clique em Consultar.'}
          </div>
        )}
      </div>

      {detalhe && (
        <DetalheModal ctx={detalhe} ano={ano} mes={mes} onClose={() => setDetalhe(null)} />
      )}
    </div>
  );
}

const TIPO_LABEL: Record<string, string> = { previsto: 'Previstos', recebido: 'Recebidos', saldo: 'A receber (saldo)' };

interface TituloDet {
  codigo: string; nome: string; nro_doc: string;
  dt_venc: string | null; dtvenc_previsao: string | null;
  previsto: number; recebido: number; saldo: number; pago: string;
}

function DetalheModal({ ctx, ano, mes, onClose }: {
  ctx: { dia: number; data: string; tipo: 'previsto' | 'recebido' | 'saldo' };
  ano: number; mes: number; onClose: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [titulos, setTitulos] = useState<TituloDet[]>([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const q = new URLSearchParams({ ano: String(ano), mes: String(mes), dia: String(ctx.dia), tipo: ctx.tipo });
        const r = await fetch('/api/financeiro/previsto-recebido-detalhe?' + q.toString());
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao detalhar.');
        if (vivo) setTitulos(d.titulos);
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao detalhar.');
        if (vivo) setTitulos([]);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [ctx, ano, mes]);

  const vencOf = (t: TituloDet) => dbr(t.dtvenc_previsao || t.dt_venc || '');
  const lista = titulos.filter((t) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return t.nome.toLowerCase().includes(q) || (t.nro_doc || '').toLowerCase().includes(q) || vencOf(t).includes(q);
  });
  const tot = lista.reduce((a, t) => { a.previsto += t.previsto; a.recebido += t.recebido; a.saldo += t.saldo; return a; }, { previsto: 0, recebido: 0, saldo: 0 });
  const totalCol = ctx.tipo === 'recebido' ? tot.recebido : ctx.tipo === 'saldo' ? tot.saldo : tot.previsto;
  const nomeArq = `titulos_${ctx.tipo}_dia${String(ctx.dia).padStart(2, '0')}_${mes}_${ano}`;

  const exportarExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = lista.map((t) => ({ Cliente: t.nome, Documento: t.nro_doc || '', Vencimento: vencOf(t), Previsto: t.previsto, Recebido: t.recebido, Saldo: t.saldo }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Titulos');
    XLSX.writeFile(wb, nomeArq + '.xlsx');
  };

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) { toast.error('Pop-up bloqueado pelo navegador.'); return; }
    const body = lista.map((t) => `<tr><td>${t.nome}</td><td>${t.nro_doc || '—'}</td><td>${vencOf(t)}</td>
      <td class="num">${brl(t.previsto)}</td><td class="num" style="color:#059669">${brl(t.recebido)}</td><td class="num" style="color:#dc2626">${brl(t.saldo)}</td></tr>`).join('');
    w.document.write(`<html><head><title>Títulos ${TIPO_LABEL[ctx.tipo]}</title><style>
      @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:11px;color:#111}
      h1{font-size:15px;margin:0 0 2px;color:#1d4ed8}.sub{color:#555;margin-bottom:8px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left}
      th{background:#1d4ed8;color:#fff}.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      tfoot td{font-weight:bold;background:#eee}</style></head><body>
      <h1>Títulos ${TIPO_LABEL[ctx.tipo]}</h1>
      <div class="sub">DIA${String(ctx.dia).padStart(2, '0')} · ${dbr(ctx.data)} · ${lista.length} título(s)${filtro ? ` · filtro: "${filtro}"` : ''}</div>
      <table><thead><tr><th>Cliente</th><th>Documento</th><th>Vencimento</th><th class="num">Previsto</th><th class="num">Recebido</th><th class="num">Saldo</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="3">TOTAL (${lista.length})</td><td class="num">${brl(tot.previsto)}</td><td class="num">${brl(tot.recebido)}</td><td class="num">${brl(tot.saldo)}</td></tr></tfoot></table></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Títulos {TIPO_LABEL[ctx.tipo]}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">DIA{String(ctx.dia).padStart(2, '0')} · {dbr(ctx.data)} · {lista.length} de {titulos.length} título(s)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
        </div>
        {/* Toolbar: filtro + export */}
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por cliente, documento ou vencimento…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900" />
          </div>
          <Button onClick={imprimir} variant="outline" className="h-9 gap-1"><Printer size={15} /> Imprimir</Button>
          <Button onClick={exportarExcel} variant="outline" className="h-9 gap-1"><FileSpreadsheet size={15} /> Excel</Button>
        </div>
        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          {carregando ? (
            <div className="text-center text-gray-400 py-12"><Loader2 className="animate-spin inline mr-2" size={18} /> Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-center text-gray-400 py-12">Nenhum título{filtro ? ' para o filtro' : ''}.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Documento</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                  <th className="px-3 py-2 text-right">Previsto</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lista.map((t) => (
                  <tr key={t.codigo} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-3 py-2">{t.nome}</td>
                    <td className="px-3 py-2 text-gray-500">{t.nro_doc || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{vencOf(t)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(t.previsto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{brl(t.recebido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{brl(t.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Rodapé total */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm font-bold shrink-0">
          <span className="text-gray-500 font-normal">Previsto: <span className="tabular-nums text-gray-900 dark:text-white font-bold">{brl(tot.previsto)}</span></span>
          <span className="text-gray-500 font-normal">Recebido: <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">{brl(tot.recebido)}</span></span>
          <span className="text-gray-500 font-normal">Saldo: <span className="tabular-nums text-red-600 dark:text-red-400 font-bold">{brl(tot.saldo)}</span></span>
          <span>Total {TIPO_LABEL[ctx.tipo]}: <span className="tabular-nums">{brl(totalCol)}</span></span>
        </div>
      </div>
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{titulo}</p>
      <p className={`text-lg font-bold tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}
