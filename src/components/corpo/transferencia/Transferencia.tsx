import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { toast } from 'sonner';
import { Loader2, Search, Send, Truck, ArrowRightLeft } from 'lucide-react';
import { mascaraInputBRL, desmascarar, formatarBRL } from '@/utils/monetario';
import { gerarTransferencia, type ResultadoFilial } from '@/data/transferencia/gerarTransferencia';

interface Produto {
  codprod: string; ref: string; descr: string; marca: string; unimed: string;
  qtd_entrada: number; qtd_transferido: number; qtd_disponivel: number; pr_transf: number;
}
interface FilialDest { codcli: string; sigla: string; nome: string; uf: string; ativo: boolean; }
interface LinhaDist { qtd: string; codcli: string; } // por codprod

export default function Transferencia() {
  const { user } = useContext(AuthContext);
  const username = user?.usuario || 'Sistema';

  const [codent, setCodent] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filiais, setFiliais] = useState<FilialDest[]>([]);
  const [dist, setDist] = useState<Record<string, LinhaDist>>({}); // codprod -> {qtd, codcli}
  const [pedido, setPedido] = useState('');
  const [obs, setObs] = useState('');
  const [frete, setFrete] = useState('');
  const [armOrigem, setArmOrigem] = useState('1001'); // armazém de origem (Manaus)
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoFilial[] | null>(null);

  useEffect(() => {
    fetch('/api/transferencia/filiais-destino')
      .then((r) => r.json())
      .then((d) => setFiliais((d.filiais || []).filter((f: FilialDest) => f.codcli !== '00002'))) // exclui a origem MAO
      .catch(() => setFiliais([]));
  }, []);

  const buscarEntrada = async () => {
    const c = codent.trim();
    if (!c) return toast.info('Informe o número da entrada.');
    setBuscando(true); setProdutos([]); setDist({}); setResultados(null);
    try {
      const r = await fetch(`/api/transferencia/entrada/${encodeURIComponent(c)}/produtos`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setProdutos(d.itens || []);
      if ((d.itens || []).length === 0) toast.info('Entrada sem itens disponíveis.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const setLinha = (codprod: string, campo: keyof LinhaDist, valor: string) =>
    setDist((prev) => {
      const atual: LinhaDist = prev[codprod] || { qtd: '', codcli: '' };
      return { ...prev, [codprod]: { ...atual, [campo]: valor } };
    });

  const gerar = async () => {
    // monta a distribuição por filial (só linhas com qtd>0 e filial escolhida)
    const porFilial: Record<string, any> = {};
    for (const p of produtos) {
      const l = dist[p.codprod];
      const q = l ? desmascarar(l.qtd) : 0;
      if (!l || !l.codcli || q <= 0) continue;
      if (q > p.qtd_disponivel + 0.001) return toast.error(`${p.ref}: qtd acima do disponível (${p.qtd_disponivel}).`);
      (porFilial[l.codcli] ||= { codcli_destino: l.codcli, sigla: filiais.find((f) => f.codcli === l.codcli)?.sigla, arm_id_origem: Number(armOrigem), vlr_frete: desmascarar(frete), pedido, obs, itens: [] }).itens.push({ codprod: p.codprod, qtd: q, pr_transf: p.pr_transf });
    }
    const listaFiliais = Object.values(porFilial);
    if (listaFiliais.length === 0) return toast.error('Informe quantidade e filial destino em ao menos um produto.');

    setGerando(true); setResultados(null); setProgresso('Iniciando…');
    try {
      const res = await gerarTransferencia({ codent: codent.trim(), username, filiais: listaFiliais as any, onStep: setProgresso });
      setResultados(res);
      const ok = res.filter((r) => r.ok).length;
      if (ok === res.length) toast.success(`${ok} transferência(s) gerada(s) com NF-e.`);
      else toast.warning(`${ok}/${res.length} ok. Veja os detalhes.`);
      // recarrega os produtos (qtd_disponivel muda)
      await buscarEntrada();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setGerando(false); setProgresso(null);
    }
  };

  const totalEnviar = produtos.reduce((s, p) => {
    const q = dist[p.codprod] ? desmascarar(dist[p.codprod].qtd) : 0;
    return s + q * p.pr_transf;
  }, 0);

  return (
    <div className="h-full flex flex-col border border-gray-300 bg-white dark:bg-slate-900 dark:border-slate-700">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <span className="w-8 h-8 rounded-md bg-blue-600 text-white grid place-items-center"><ArrowRightLeft size={16} /></span>
        <div className="leading-tight">
          <div className="font-bold">TRANSFERÊNCIA ENTRE FILIAIS</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold -mt-0.5">A partir de uma Entrada · gera NF-e (CFOP 6152)</div>
        </div>
        <div className="ml-auto text-sm">Operador <b>{username}</b></div>
      </div>

      <main className="flex-1 overflow-auto p-4">
        <div className="w-full max-w-[1400px] mx-auto space-y-4">
          {/* Entrada */}
          <section className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Entrada</span>
              <input value={codent} onChange={(e) => setCodent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarEntrada()}
                placeholder="Nº da entrada" className="h-10 px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono w-48" />
            </label>
            <button onClick={buscarEntrada} disabled={buscando}
              className="h-10 px-4 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              {buscando ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Buscar
            </button>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Armazém origem</span>
              <input value={armOrigem} onChange={(e) => setArmOrigem(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono w-28" />
            </label>
          </section>

          {/* Produtos */}
          {produtos.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-slate-800 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">Referência</th>
                      <th className="text-left px-3 py-2">Descrição</th>
                      <th className="text-left px-3 py-2">Marca</th>
                      <th className="text-right px-3 py-2">Qtd Entrada</th>
                      <th className="text-right px-3 py-2">Disponível</th>
                      <th className="text-right px-3 py-2">Pr. Transf.</th>
                      <th className="text-center px-3 py-2 w-28">Qtd a Enviar</th>
                      <th className="text-left px-3 py-2 w-40">Filial destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => (
                      <tr key={p.codprod} className="border-t border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono">{p.ref}</td>
                        <td className="px-3 py-2">{p.descr}</td>
                        <td className="px-3 py-2 text-gray-500">{p.marca}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.qtd_entrada}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{p.qtd_disponivel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarBRL(p.pr_transf)}</td>
                        <td className="px-2 py-2">
                          <input value={dist[p.codprod]?.qtd || ''} onChange={(e) => setLinha(p.codprod, 'qtd', e.target.value.replace(/[^\d]/g, ''))}
                            disabled={p.qtd_disponivel <= 0} placeholder="0"
                            className="w-24 h-9 px-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right font-mono disabled:opacity-40" />
                        </td>
                        <td className="px-2 py-2">
                          <select value={dist[p.codprod]?.codcli || ''} onChange={(e) => setLinha(p.codprod, 'codcli', e.target.value)}
                            disabled={p.qtd_disponivel <= 0}
                            className="w-36 h-9 px-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40">
                            <option value="">—</option>
                            {filiais.map((f) => <option key={f.codcli} value={f.codcli}>{f.sigla} ({f.uf})</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Rodapé: transporte + gerar */}
          {produtos.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-end gap-4 flex-wrap">
              <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Pedido</span>
                <input value={pedido} onChange={(e) => setPedido(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
              </label>
              <label className="flex flex-col gap-1 flex-[2] min-w-[220px]">
                <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Observação</span>
                <input value={obs} onChange={(e) => setObs(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Vlr. Frete</span>
                <input value={frete} onChange={(e) => setFrete(mascaraInputBRL(e.target.value))} className="h-10 px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right font-mono w-32" />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Total a enviar</span>
                <span className="h-10 grid place-items-center px-3 font-mono font-semibold">{formatarBRL(totalEnviar)}</span>
              </div>
              <button onClick={gerar} disabled={gerando}
                className="h-11 px-6 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50">
                {gerando ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />} Gerar Transferência
              </button>
            </section>
          )}

          {/* Resultados */}
          {resultados && (
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-2">
              <div className="font-semibold text-sm">Resultado</div>
              {resultados.map((r) => (
                <div key={r.codcli_destino} className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 border ${r.ok ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
                  <b className="w-16">{r.sigla || r.codcli_destino}</b>
                  {r.ok ? (
                    <span className="text-emerald-700 dark:text-emerald-300">✓ Fatura {r.codfat} · NF-e autorizada · transferência #{r.tra_id}</span>
                  ) : (
                    <span className="text-red-700 dark:text-red-300">✗ {r.erro}</span>
                  )}
                </div>
              ))}
            </section>
          )}

          {produtos.length === 0 && !buscando && (
            <div className="text-center text-sm text-gray-400 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl py-10">
              Informe uma Entrada e clique em Buscar para distribuir os produtos às filiais.
            </div>
          )}
        </div>
      </main>

      {progresso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl px-7 py-6 w-full max-w-sm text-center">
            <Loader2 className="animate-spin mx-auto text-blue-600" size={30} />
            <div className="mt-3 font-bold">Gerando transferência</div>
            <div className="mt-1 text-sm text-gray-500">{progresso}</div>
            <div className="mt-3 text-[11px] text-gray-400">Cada filial gera 1 NF-e. Se a nota falhar, aquela é desfeita automaticamente.</div>
          </div>
        </div>
      )}
    </div>
  );
}
