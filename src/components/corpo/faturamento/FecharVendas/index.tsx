import React, { useContext, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '@/contexts/authContexts';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import { Filter, Loader2, Lock } from 'lucide-react';

const brl = (v: any) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (d: any) => {
  if (!d) return '';
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('pt-BR');
};

export default function FecharVendas() {
  const { user } = useContext(AuthContext) as any;
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [tipo, setTipo] = useState<'T' | 'C' | 'P'>('T');
  const [busca, setBusca] = useState('');
  const [vendas, setVendas] = useState<any[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [vendaAtiva, setVendaAtiva] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [fechando, setFechando] = useState(false);

  const filtrar = async () => {
    setCarregando(true);
    setSelecionadas(new Set());
    setVendaAtiva(null);
    setItens([]);
    try {
      const p = new URLSearchParams();
      if (dataDe) p.set('dataDe', dataDe);
      if (dataAte) p.set('dataAte', dataAte);
      p.set('tipo', tipo);
      if (busca.trim()) p.set('busca', busca.trim());
      const { data } = await axios.get(`/api/faturamento/vendas-a-fechar?${p.toString()}`);
      setVendas(data.vendas || []);
    } catch {
      toast.error('Erro ao filtrar vendas.');
    } finally {
      setCarregando(false);
    }
  };

  const abrirItens = async (v: any) => {
    setVendaAtiva(v);
    setItens([]);
    try {
      const { data } = await axios.get(`/api/faturamento/venda-itens?codvenda=${v.codvenda}`);
      setItens(data.itens || []);
    } catch {
      setItens([]);
    }
  };

  const toggleSel = (cod: string) => {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      n.has(cod) ? n.delete(cod) : n.add(cod);
      return n;
    });
  };

  const executarFechar = async (codvendas: string[]) => {
    if (codvendas.length === 0) return;
    setFechando(true);
    try {
      const { data } = await axios.post('/api/faturamento/fechar-vendas', {
        codvendas,
        usuario: user?.usuario || user?.codusr || '',
      });
      toast.success(
        `${data.fechadas} venda(s) fechada(s)${data.ignoradas ? ` · ${data.ignoradas} ignorada(s)` : ''}.`,
      );
      await filtrar();
    } catch (err: any) {
      toast.error(err?.response?.data?.erro || 'Erro ao fechar vendas.');
    } finally {
      setFechando(false);
    }
  };

  const fecharSelecionadas = () => {
    const cods = Array.from(selecionadas);
    if (cods.length === 0) {
      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Nenhuma venda selecionada',
        message: 'Marque ao menos uma venda para fechar.',
      });
      return;
    }
    pedirConfirmacao(() => executarFechar(cods), {
      title: 'Fechar venda(s)',
      message: `Fechar ${cods.length} venda(s) selecionada(s)? A venda será marcada como faturada (status 'F'), sem emitir NF-e.`,
      type: 'warning',
      confirmText: 'Sim, fechar',
      cancelText: 'Não',
    });
  };

  const fecharTodas = () => {
    if (vendas.length === 0) return;
    pedirConfirmacao(() => executarFechar(vendas.map((v) => v.codvenda)), {
      title: 'Fechar TODAS as vendas',
      message: `Fechar TODAS as ${vendas.length} venda(s) filtradas? Todas serão marcadas como faturadas (status 'F'), sem emitir NF-e.`,
      type: 'warning',
      confirmText: 'Sim, fechar todas',
      cancelText: 'Não',
    });
  };

  return (
    <div className="p-4 w-full">
      <h1 className="text-2xl font-bold mb-3">Fechamento de Venda</h1>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-3 bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg">
        <div>
          <label className="block text-xs text-gray-500 mb-1">De</label>
          <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-zinc-700" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Até</label>
          <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-zinc-700" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-zinc-700">
            <option value="T">Todas</option>
            <option value="C">Crédito</option>
            <option value="P">Prazo</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar (cliente, vendedor, nº venda)</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && filtrar()}
            placeholder="Digite e Enter…"
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-zinc-700" />
        </div>
        <button onClick={filtrar} disabled={carregando}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60">
          {carregando ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
          Filtrar
        </button>
      </div>

      <div className="flex gap-4">
        {/* Grid de vendas */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
            Número de Vendas: <b>{vendas.length}</b>
            {selecionadas.size > 0 && <span className="ml-3">Selecionadas: <b>{selecionadas.size}</b></span>}
          </div>
          <div className="border rounded-lg overflow-auto max-h-[52vh]">
            <table className="w-full text-sm">
              <thead className="bg-blue-600 text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox"
                      checked={vendas.length > 0 && selecionadas.size === vendas.length}
                      onChange={(e) =>
                        setSelecionadas(e.target.checked ? new Set(vendas.map((v) => v.codvenda)) : new Set())
                      } />
                  </th>
                  <th className="px-2 py-2 text-left">Data</th>
                  <th className="px-2 py-2 text-left">Tipo</th>
                  <th className="px-2 py-2 text-left">Nº Venda</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.codvenda}
                    onClick={() => abrirItens(v)}
                    className={`border-b cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700 ${
                      vendaAtiva?.codvenda === v.codvenda ? 'bg-blue-100 dark:bg-zinc-700' : ''
                    }`}>
                    <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selecionadas.has(v.codvenda)}
                        onChange={() => toggleSel(v.codvenda)} />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{dataBR(v.data)}</td>
                    <td className="px-2 py-1">{v.tipo}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{v.nrovenda}</td>
                    <td className="px-2 py-1">{v.cliente_nome}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{brl(v.total)}</td>
                    <td className="px-2 py-1 truncate max-w-[260px]" title={v.obs}>{v.obs}</td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-6">
                    Nenhuma venda não faturada no período. Amplie o intervalo ou{' '}
                    <b>limpe as datas</b> para ver todas (muitas pendentes são de 2024–2025).
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Itens da venda selecionada */}
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-3 mb-1">
            Itens da venda selecionada: <b>{itens.length}</b>
            {vendaAtiva && <span className="ml-2 text-gray-400">(venda {vendaAtiva.nrovenda})</span>}
          </div>
          <div className="border rounded-lg overflow-auto max-h-[22vh]">
            <table className="w-full text-sm">
              <thead className="bg-gray-200 dark:bg-zinc-700 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Referência</th>
                  <th className="px-2 py-1 text-left">Marca</th>
                  <th className="px-2 py-1 text-right">Qtde.</th>
                  <th className="px-2 py-1 text-right">Pç. Unit.</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1">{it.referencia}</td>
                    <td className="px-2 py-1">{it.marca}</td>
                    <td className="px-2 py-1 text-right">{it.qtde}</td>
                    <td className="px-2 py-1 text-right">{brl(it.prunit)}</td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-400 py-4">Selecione uma venda para ver os itens.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ações */}
        <div className="w-52 shrink-0 flex flex-col gap-2">
          <div className="text-xs text-gray-500 mb-1">Operações com as vendas selecionadas</div>
          <button onClick={fecharSelecionadas} disabled={fechando}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-sm disabled:opacity-60">
            {fechando ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Fechar Venda
          </button>
          <button onClick={fecharTodas} disabled={fechando || vendas.length === 0}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded text-sm disabled:opacity-60">
            {fechando ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Fechar Todas as Vendas
          </button>
        </div>
      </div>

      {ConfirmacaoSalvarModal}
    </div>
  );
}
