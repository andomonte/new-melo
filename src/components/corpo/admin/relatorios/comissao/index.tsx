'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SelectPadrao from '@/components/common/SelectPadrao';
import { Search, Loader2, ChevronLeft, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, FileSpreadsheet, FileDown } from 'lucide-react';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';

interface ResumoVend {
  codvend: string;
  nome: string;
  creditos: number;
  debitos: number;
  total: number;
  total_aberto: number;
  movimentos: number;
  fechado: boolean;
  fechado_em?: string | null;
  fechado_por?: string | null;
}
interface MovExtrato {
  id: number;
  data_mov: string;
  tipo: 'FAT' | 'CAN' | 'DEV';
  codfat: string;
  codvenda: string;
  cliente: string;
  valor_base: number;
  perc: number;
  valor_comissao: number;
  saldo: number;
  status: string;
}

const brl = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};
const TIPO_LABEL: Record<string, string> = { FAT: 'Faturamento', CAN: 'Cancelamento', DEV: 'Devolução' };

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function RelatorioComissao() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoVend[]>([]);
  const [totalMes, setTotalMes] = useState(0);
  const [vendSel, setVendSel] = useState<ResumoVend | null>(null);
  const [extrato, setExtrato] = useState<MovExtrato[]>([]);
  const [vendedoresLista, setVendedoresLista] = useState<ResumoVend[]>([]);
  const [totais, setTotais] = useState({ creditos: 0, debitos: 0, total: 0, a_pagar: 0, pagos: 0 });
  const [fechando, setFechando] = useState(false);
  const [mesFechado, setMesFechado] = useState(false);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  const getUsername = () => {
    try {
      const p = localStorage.getItem('perfilUserMelo');
      return p ? JSON.parse(p)?.usuario || 'WEB' : 'WEB';
    } catch {
      return 'WEB';
    }
  };

  const buscar = useCallback(
    async (codvend?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ ano: String(ano), mes: String(mes) });
        if (codvend) params.set('codvend', codvend);
        const r = await fetch(`/api/comissao/extrato?${params.toString()}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro || 'Erro ao gerar extrato.');
        setResumo(d.resumo || []);
        setTotalMes(d.totalMes || 0);
        setExtrato(d.extrato || []);
        setMesFechado(!!d.mesFechado);
        setTotais(d.totais || { creditos: 0, debitos: 0, total: 0, a_pagar: 0, pagos: 0 });
        // guarda a lista completa de vendedores do período (para o seletor de busca)
        if (!codvend) setVendedoresLista(d.resumo || []);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    },
    [ano, mes],
  );

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirVendedor = (v: ResumoVend) => {
    setVendSel(v);
    buscar(v.codvend);
  };
  const voltarResumo = () => {
    setVendSel(null);
    setExtrato([]);
    buscar();
  };

  const totalExtrato = useMemo(
    () => extrato.reduce((s, m) => s + m.valor_comissao, 0),
    [extrato],
  );
  const totalAPagar = useMemo(
    () => resumo.reduce((s, r) => s + r.total_aberto, 0),
    [resumo],
  );

  // Escopo do fechamento: um vendedor (quando aberto no extrato) ou todos (no resumo).
  const escopoCodvend = vendSel ? vendSel.codvend : '';
  const escopoLabel = vendSel ? `vendedor ${vendSel.codvend}` : 'todos os vendedores';
  const escopoFechado = vendSel ? !!resumo[0]?.fechado : mesFechado;

  const chamarAcao = async (url: string) => {
    setFechando(true);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ano, mes, codvend: escopoCodvend || undefined, username: getUsername() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro na operação.');
      toast.success(d.mensagem || 'Operação concluída.');
      vendSel ? buscar(vendSel.codvend) : buscar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFechando(false);
    }
  };

  const fecharMes = () => {
    if (totalAPagar === 0) {
      toast.info('Não há comissão em aberto para fechar.');
      return;
    }
    pedirConfirmacao(() => chamarAcao('/api/comissao/fechar'), {
      title: `Fechar comissão — ${escopoLabel}`,
      message: `Fechar e marcar como PAGO a comissão em aberto de ${MESES[mes - 1]}/${ano} (${escopoLabel}, R$ ${brl(totalAPagar)})? Cancelamentos futuros cairão no mês corrente.`,
      type: 'warning',
      confirmText: 'Fechar',
      cancelText: 'Cancelar',
    });
  };

  const reabrirMes = () => {
    pedirConfirmacao(() => chamarAcao('/api/comissao/reabrir'), {
      title: `Abrir comissão — ${escopoLabel}`,
      message: `Reabrir o fechamento de ${MESES[mes - 1]}/${ano} (${escopoLabel})? Os movimentos voltam a ABERTO para correção.`,
      type: 'warning',
      confirmText: 'Abrir',
      cancelText: 'Cancelar',
    });
  };

  const nomeArquivo = () =>
    `comissao-${ano}-${String(mes).padStart(2, '0')}${vendSel ? '-' + vendSel.codvend : ''}`;

  const exportarExcel = async () => {
    if ((vendSel ? extrato : resumo).length === 0) return toast.info('Nada para exportar.');
    const XLSX = await import('xlsx');
    const linhas = vendSel
      ? extrato.map((m) => ({
          Data: dataBR(m.data_mov),
          Tipo: TIPO_LABEL[m.tipo] || m.tipo,
          Fatura: m.codfat,
          Cliente: m.cliente,
          Base: m.valor_base,
          'Perc %': m.perc,
          Comissao: m.valor_comissao,
          Saldo: m.saldo,
        }))
      : resumo.map((v) => ({
          Vendedor: v.codvend,
          Nome: v.nome,
          Creditos: v.creditos,
          Debitos: v.debitos,
          Total: v.total,
          'A pagar': v.fechado ? 'FECHADO' : v.total_aberto,
          Movs: v.movimentos,
        }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comissão');
    XLSX.writeFile(wb, `${nomeArquivo()}.xlsx`);
  };

  const exportarPdf = async () => {
    if ((vendSel ? extrato : resumo).length === 0) return toast.info('Nada para exportar.');
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape' });
    const titulo = `Comissão de Vendedor — ${MESES[mes - 1]}/${ano}${vendSel ? ` — ${vendSel.codvend} ${vendSel.nome}` : ''}`;
    doc.setFontSize(12);
    doc.text(titulo, 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Créditos: ${brl(totais.creditos)}   Débitos: ${brl(totais.debitos)}   Total: ${brl(totais.total)}   A pagar: ${brl(totais.a_pagar)}   Pagos: ${brl(totais.pagos)}`,
      14,
      20,
    );
    if (vendSel) {
      autoTable(doc, {
        startY: 25,
        styles: { fontSize: 8 },
        head: [['Data', 'Tipo', 'Fatura', 'Cliente', 'Base', '%', 'Comissão', 'Saldo']],
        body: extrato.map((m) => [
          dataBR(m.data_mov),
          TIPO_LABEL[m.tipo] || m.tipo,
          m.codfat,
          m.cliente,
          brl(m.valor_base),
          Number(m.perc).toFixed(2),
          brl(m.valor_comissao),
          brl(m.saldo),
        ]),
        foot: [['', '', '', '', '', '', 'Total', brl(totalExtrato)]],
      });
    } else {
      autoTable(doc, {
        startY: 25,
        styles: { fontSize: 8 },
        head: [['Vendedor', 'Nome', 'Créditos', 'Débitos', 'Total', 'A pagar', 'Movs']],
        body: resumo.map((v) => [
          v.codvend,
          v.nome,
          brl(v.creditos),
          brl(v.debitos),
          brl(v.total),
          v.fechado ? 'FECHADO' : brl(v.total_aberto),
          String(v.movimentos),
        ]),
        foot: [['', '', '', '', 'Total mês', brl(totalMes), '']],
      });
    }
    doc.save(`${nomeArquivo()}.pdf`);
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 p-6 gap-4">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
          Comissão de Vendedor {vendSel ? `— ${vendSel.codvend} ${vendSel.nome}` : ''}
        </h1>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <Label className="text-xs">Mês</Label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <Label className="text-xs">Ano</Label>
          <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
        </div>
        <div className="w-64">
          <Label className="text-xs">Vendedor</Label>
          <SelectPadrao
            searchable
            value={vendSel?.codvend || ''}
            onValueChange={(val) => {
              if (val) {
                const v = vendedoresLista.find((x) => x.codvend === val);
                if (v) abrirVendedor(v);
              } else {
                voltarResumo();
              }
            }}
            placeholder="Todos (buscar por código/nome)..."
            options={vendedoresLista.map((v) => ({ value: v.codvend, label: `${v.codvend} - ${v.nome}` }))}
          />
        </div>
        <Button onClick={() => (vendSel ? buscar(vendSel.codvend) : buscar())} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search size={16} className="mr-1" />}
          Gerar
        </Button>
        <Button variant="outline" onClick={exportarExcel} title="Exportar Excel">
          <FileSpreadsheet size={16} className="mr-1 text-green-700" /> Excel
        </Button>
        <Button variant="outline" onClick={exportarPdf} title="Exportar PDF">
          <FileDown size={16} className="mr-1 text-red-600" /> PDF
        </Button>
        {vendSel && (
          <Button variant="outline" onClick={voltarResumo}>
            <ChevronLeft size={16} className="mr-1" /> Voltar ao resumo
          </Button>
        )}
        <div className="flex-1" />
        <div className="text-right">
          {escopoFechado ? (
            <>
              <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                <Lock size={11} /> FECHADO {vendSel ? '' : '(todos)'}
              </div>
              {vendSel && resumo[0]?.fechado_em && (
                <div className="text-[11px] text-gray-500">
                  {new Date(resumo[0].fechado_em).toLocaleDateString('pt-BR')} · {resumo[0].fechado_por || ''}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] text-gray-500">A pagar {vendSel ? '(vendedor)' : '(mês)'}</div>
              <div className={`text-lg font-bold ${totalAPagar < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                R$ {brl(totalAPagar)}
              </div>
            </>
          )}
        </div>
        <Button
          onClick={escopoFechado ? reabrirMes : fecharMes}
          disabled={fechando || loading}
          className={escopoFechado ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 hover:bg-slate-900'}
        >
          {fechando ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : escopoFechado ? (
            <Unlock size={16} className="mr-1" />
          ) : (
            <Lock size={16} className="mr-1" />
          )}
          {escopoFechado ? 'Abrir' : 'Fechar'} {vendSel ? 'vendedor' : 'mês'}
        </Button>
      </div>

      {/* Resumo geral do período (sempre visível — não precisa rolar) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Créditos', valor: totais.creditos, cor: 'text-emerald-600' },
          { label: 'Débitos', valor: totais.debitos, cor: 'text-red-600' },
          { label: 'Total', valor: totais.total, cor: totais.total < 0 ? 'text-red-600' : 'text-slate-800 dark:text-gray-100' },
          { label: 'A pagar', valor: totais.a_pagar, cor: 'text-blue-600' },
          { label: 'Pagos', valor: totais.pagos, cor: 'text-slate-500' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 bg-gray-50 dark:bg-slate-800/40">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{c.label}</div>
            <div className={`text-lg font-bold tabular-nums ${c.cor}`}>R$ {brl(c.valor)}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        {!vendSel ? (
          /* ---------- RESUMO POR VENDEDOR ---------- */
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left w-24">Vendedor</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-right w-32">Créditos</th>
                <th className="px-3 py-2 text-right w-32">Débitos</th>
                <th className="px-3 py-2 text-right w-32">Total do mês</th>
                <th className="px-3 py-2 text-right w-32">A pagar</th>
                <th className="px-3 py-2 text-center w-24">Movs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Carregando...</td></tr>
              ) : resumo.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Nenhuma comissão no período.</td></tr>
              ) : (
                resumo.map((v) => (
                  <tr
                    key={v.codvend}
                    onClick={() => abrirVendedor(v)}
                    className="border-t border-gray-100 dark:border-slate-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  >
                    <td className="px-3 py-2 font-mono">{v.codvend}</td>
                    <td className="px-3 py-2">{v.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{brl(v.creditos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600">{brl(v.debitos)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${v.total < 0 ? 'text-red-600' : ''}`}>{brl(v.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {v.fechado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-semibold justify-end">
                          <Lock size={11} /> FECHADO
                        </span>
                      ) : (
                        brl(v.total_aberto)
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{v.movimentos}</td>
                  </tr>
                ))
              )}
            </tbody>
            {resumo.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-slate-800/80 font-semibold">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">TOTAL GERAL DO MÊS</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(totalMes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(totalAPagar)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          /* ---------- EXTRATO DO VENDEDOR (por dia + saldo) ---------- */
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left w-24">Data</th>
                <th className="px-3 py-2 text-left w-32">Tipo</th>
                <th className="px-3 py-2 text-left w-24">Fatura</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right w-28">Base</th>
                <th className="px-3 py-2 text-right w-16">%</th>
                <th className="px-3 py-2 text-right w-28">Comissão</th>
                <th className="px-3 py-2 text-right w-28">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Carregando...</td></tr>
              ) : extrato.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Sem lançamentos no mês.</td></tr>
              ) : (
                extrato.map((m) => {
                  const deb = m.valor_comissao < 0;
                  return (
                    <tr key={m.id} className="border-t border-gray-100 dark:border-slate-800">
                      <td className="px-3 py-2">{dataBR(m.data_mov)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 ${deb ? 'text-red-600' : 'text-emerald-600'}`}>
                          {deb ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                          {TIPO_LABEL[m.tipo] || m.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{m.codfat}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{m.cliente || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(m.valor_base)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(m.perc).toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${deb ? 'text-red-600' : 'text-emerald-600'}`}>{brl(m.valor_comissao)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{brl(m.saldo)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {extrato.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-slate-800/80 font-semibold">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right">TOTAL A PAGAR NO MÊS</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${totalExtrato < 0 ? 'text-red-600' : ''}`}>{brl(totalExtrato)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {ConfirmacaoSalvarModal}
    </div>
  );
}
