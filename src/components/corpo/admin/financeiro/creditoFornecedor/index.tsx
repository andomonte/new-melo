/**
 * Financeiro → Crédito de Fornecedor (/admin/financeiro/creditoFornecedor).
 * Roteiro: docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (fase 4, etapa 6).
 *
 * - Lista os fornecedores (matriz + filiais, pela raiz do CNPJ) com crédito: saldo, créditos em
 *   aberto, crédito mais antigo, filiais e títulos em aberto.
 * - Detalhe: créditos (origem, gerado, usado, saldo), histórico (o que gerou, as notas e os
 *   títulos que consumiram, estornos) e filiais.
 * - Usar crédito: títulos em aberto do fornecedor e das filiais; o usuário marca quais e quanto
 *   (parcial permitido). Baixa com a forma ABATIMENTO DE SALDO (não mexe em caixa nem banco).
 * - Estornar uso: motivo obrigatório; o valor volta ao crédito.
 * O crédito só é usado aqui: o Compras não oferece crédito de outro pedido.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Search, Wallet, Undo2, Building2 } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const API = '/api/financeiro/credito-fornecedor';

const moeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
// datas chegam como texto do banco ("2026-11-24 10:00…"): formata sem new Date() (fuso)
const dataBR = (s?: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};
const doc = (s?: string | null) => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return s || '-';
};
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const lerValor = (s: string) => r2(parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0);
const mostrarValor = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Grupo {
  grupo_key: string; nome: string | null; cpf_cgc: string | null; saldo: number; total_gerado: number;
  qtd_abertos: number; mais_antigo: string | null; dias_mais_antigo: number | null; qtd_filiais: number; qtd_titulos_abertos: number;
}
interface Credito {
  id: number; cod_credor: string; nome: string; origem: string; cod_pgto: string | null; nfe_id: string | null;
  valor_original: number; valor_disponivel: number; usado: number; status: string; dt_credito: string; obs: string | null;
  nro_dup: string | null; pag_cof_id: number | null; conta_financeira: string | null; dt_pgto: string | null; orc_id: string | null;
}
interface Uso {
  id: number; credito_id: number; valor_usado: number; dt_uso: string; motivo: string | null; username: string | null;
  fpg_cof_id: string | null; nfe_id: string | null; nnf: string | null; valor_nf: number | null;
  cod_pgto_abatido: string | null; dup_abatido: string | null; nf_abatido: string | null; nome_abatido: string | null;
  estornado_em: string | null; estornado_por: string | null; motivo_estorno: string | null; dup_origem: string | null;
}
interface Detalhe { grupo: string; credores: { cod_credor: string; nome: string; cpf_cgc: string }[]; creditos: Credito[]; usos: Uso[]; saldo: number }
interface Titulo {
  cod_pgto: string; cod_credor: string; nome: string; nro_nf: string | null; nro_dup: string | null; dt_venc: string | null;
  valor_pgto: number; pago: number; saldo: number; conta_financeira: string | null; em_remessa: boolean;
}

const origemTexto = (c: Credito) => {
  if (c.origem === 'PAGAMENTO_SEM_NF') {
    return Number(c.pag_cof_id) === 4
      ? `Adiantamento${c.orc_id ? ` da OC ${c.orc_id}` : ''}`
      : 'Título avulso pago sem NF';
  }
  if (c.origem === 'SOBRA_PAGAMENTO') return 'Sobra de antecipado na NF';
  return c.origem;
};
const corStatus: Record<string, string> = {
  ABERTO: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PARCIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CONSUMIDO: 'bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300',
  CANCELADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const th = 'px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';
const td = 'px-2 py-1.5 text-sm whitespace-nowrap';
const num = 'text-right tabular-nums';
const botao = 'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const botaoPrimario = `${botao} bg-blue-600 text-white hover:bg-blue-700`;
const botaoSec = `${botao} border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700`;

export default function CreditoFornecedor() {
  const router = useRouter();
  const { user } = useContext(AuthContext) as any;
  const usuario = user?.usuario || user?.nome || '';

  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [aba, setAba] = useState<'titulos' | 'creditos' | 'historico' | 'filiais'>('titulos');
  const [versaoTitulos, setVersaoTitulos] = useState(0); // recarrega a aba de títulos após baixa/estorno
  const [estorno, setEstorno] = useState<Uso | null>(null);

  const carregarLista = useCallback(async (q = busca, t = todos) => {
    setCarregandoLista(true);
    try {
      const r = await fetch(`${API}?q=${encodeURIComponent(q)}${t ? '&todos=1' : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao buscar');
      setGrupos(j.grupos || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregandoLista(false);
    }
  }, [busca, todos]);

  const carregarDetalhe = useCallback(async (g: string) => {
    setCarregandoDetalhe(true);
    try {
      const r = await fetch(`${API}/detalhe?grupo=${encodeURIComponent(g)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao buscar');
      setDetalhe(j);
    } catch (e: any) {
      toast.error(e.message);
      setDetalhe(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  // abertura pelo selo do Contas a Pagar: ?grupo=… ou ?cod_credor=…
  useEffect(() => {
    if (!router.isReady) return;
    carregarLista('', false);
    const g = typeof router.query.grupo === 'string' ? router.query.grupo : '';
    const cc = typeof router.query.cod_credor === 'string' ? router.query.cod_credor : '';
    if (g) setSelecionado(g);
    else if (cc) {
      fetch(`${API}?cod_credor=${encodeURIComponent(cc)}`).then((r) => r.json()).then((j) => j?.grupo && setSelecionado(j.grupo)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  useEffect(() => {
    if (selecionado) carregarDetalhe(selecionado);
    else setDetalhe(null);
  }, [selecionado, carregarDetalhe]);

  const grupoSel = useMemo(() => grupos.find((g) => g.grupo_key === selecionado) || null, [grupos, selecionado]);
  const nomeSel = grupoSel?.nome || detalhe?.credores?.[0]?.nome || selecionado || '';

  const recarregarTudo = async () => {
    setVersaoTitulos((v) => v + 1);
    await carregarLista();
    if (selecionado) await carregarDetalhe(selecionado);
  };

  // histórico: geração dos créditos + usos (notas, títulos, estornos), do mais novo para o mais antigo
  const historico = useMemo(() => {
    if (!detalhe) return [];
    const ev: { data: string; tipo: string; texto: React.ReactNode; valor: number; uso?: Uso; sinal: 1 | -1 | 0 }[] = [];
    for (const c of detalhe.creditos) {
      ev.push({
        data: c.dt_credito, tipo: 'GERADO', sinal: 1, valor: c.valor_original,
        texto: <>{origemTexto(c)} — título {c.nro_dup || c.cod_pgto || '-'}{c.status === 'CANCELADO' ? ' (crédito cancelado: pagamento estornado)' : ''}</>,
      });
    }
    for (const u of detalhe.usos) {
      const alvo = u.nfe_id
        ? <>NF {u.nnf || u.nfe_id}{u.valor_nf ? ` (valor da nota ${moeda(u.valor_nf)})` : ''}</>
        : <>Baixa do título {u.dup_abatido || u.cod_pgto_abatido}{u.nf_abatido ? ` · NF ${u.nf_abatido}` : ''}{u.nome_abatido ? ` · ${u.nome_abatido}` : ''}</>;
      ev.push({
        data: u.dt_uso, tipo: u.nfe_id ? 'NOTA' : 'TITULO', sinal: -1, valor: u.valor_usado, uso: u,
        texto: <>{alvo} <span className="text-gray-500">— crédito do título {u.dup_origem || '-'}</span></>,
      });
      if (u.estornado_em) {
        ev.push({
          data: u.estornado_em, tipo: 'ESTORNO', sinal: 1, valor: u.valor_usado,
          texto: <>Estorno da baixa do título {u.dup_abatido || u.cod_pgto_abatido}{u.motivo_estorno ? ` — ${u.motivo_estorno}` : ''}{u.estornado_por ? ` (${u.estornado_por})` : ''}</>,
        });
      }
    }
    return ev.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [detalhe]);

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold"><Wallet className="h-5 w-5 text-blue-600" /> Crédito de Fornecedor</h1>
        <div className="relative ml-auto w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Fornecedor ou CNPJ"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregarLista()}
          />
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={todos} onChange={(e) => { setTodos(e.target.checked); carregarLista(busca, e.target.checked); }} />
          Mostrar zerados
        </label>
        <button className={botaoSec} onClick={() => recarregarTudo()} disabled={carregandoLista}>
          {carregandoLista ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(420px,5fr)_7fr]">
        {/* Lista de fornecedores */}
        <div className="min-h-0 overflow-auto rounded-md border border-gray-200 dark:border-zinc-700">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className={th}>Fornecedor</th>
                <th className={`${th} ${num}`}>Saldo</th>
                <th className={`${th} ${num}`}>Créditos</th>
                <th className={`${th} ${num}`}>Mais antigo</th>
                <th className={`${th} ${num}`}>Títulos abertos</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && !carregandoLista && (
                <tr><td colSpan={5} className="p-6 text-center text-sm text-gray-500">Nenhum fornecedor com crédito.</td></tr>
              )}
              {grupos.map((g) => (
                <tr
                  key={g.grupo_key}
                  onClick={() => { setSelecionado(g.grupo_key); setAba('titulos'); }}
                  className={`cursor-pointer border-t border-gray-100 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-700/60 ${selecionado === g.grupo_key ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
                >
                  <td className={`${td} max-w-[260px] truncate`} title={g.nome || ''}>
                    <div className="truncate font-medium">{g.nome || g.grupo_key}</div>
                    <div className="text-xs text-gray-500">
                      {doc(g.cpf_cgc)}{g.qtd_filiais > 1 ? ` · ${g.qtd_filiais} filiais` : ''}
                    </div>
                  </td>
                  <td className={`${td} ${num} font-semibold`}>{moeda(g.saldo)}</td>
                  <td className={`${td} ${num}`}>{g.qtd_abertos}</td>
                  <td className={`${td} ${num}`}>{g.dias_mais_antigo != null ? `${g.dias_mais_antigo} dias` : '-'}</td>
                  <td className={`${td} ${num}`}>{g.qtd_titulos_abertos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detalhe */}
        <div className="flex min-h-0 flex-col rounded-md border border-gray-200 dark:border-zinc-700">
          {!selecionado ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">Selecione um fornecedor.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-3 dark:border-zinc-700">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{nomeSel}</div>
                  <div className="text-xs text-gray-500">Raiz {selecionado} · {detalhe?.credores.length || 0} cadastro(s)</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-gray-500">Saldo de crédito</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{moeda(detalhe?.saldo)}</div>
                </div>
              </div>

              <div className="flex gap-1 border-b border-gray-200 px-3 dark:border-zinc-700">
                {([
                  ['titulos', `Títulos em aberto${grupoSel ? ` (${grupoSel.qtd_titulos_abertos})` : ''}`],
                  ['creditos', 'Créditos'], ['historico', 'Histórico'], ['filiais', 'Filiais'],
                ] as const).map(([k, rot]) => (
                  <button
                    key={k}
                    onClick={() => setAba(k)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm ${aba === k ? 'border-blue-600 font-medium text-blue-700 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                  >
                    {rot}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {carregandoDetalhe && (
                  <div className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
                )}
                {detalhe && !carregandoDetalhe && aba === 'titulos' && (
                  <PainelUsarCredito
                    key={`${detalhe.grupo}-${versaoTitulos}`}
                    grupo={detalhe.grupo}
                    saldo={detalhe.saldo}
                    usuario={usuario}
                    onConcluido={recarregarTudo}
                  />
                )}
                {detalhe && !carregandoDetalhe && aba === 'creditos' && (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
                      <tr>
                        <th className={th}>Origem</th><th className={th}>Título</th><th className={th}>Data</th>
                        <th className={th}>Filial</th>
                        <th className={`${th} ${num}`}>Gerado</th><th className={`${th} ${num}`}>Usado</th>
                        <th className={`${th} ${num}`}>Saldo</th><th className={th}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.creditos.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100 dark:border-zinc-700">
                          <td className={td}>
                            {origemTexto(c)}
                            {c.conta_financeira && <div className="text-xs text-gray-500">{c.pag_cof_id} – {c.conta_financeira}</div>}
                          </td>
                          <td className={`${td} font-mono`}>{c.nro_dup || c.cod_pgto || '-'}</td>
                          <td className={td}>{dataBR(c.dt_credito)}</td>
                          <td className={`${td} max-w-[180px] truncate`} title={c.nome}>{c.nome}</td>
                          <td className={`${td} ${num}`}>{moeda(c.valor_original)}</td>
                          <td className={`${td} ${num}`}>{moeda(c.usado)}</td>
                          <td className={`${td} ${num} font-semibold`}>{moeda(c.status === 'CANCELADO' ? 0 : c.valor_disponivel)}</td>
                          <td className={td}><span className={`rounded px-1.5 py-0.5 text-xs ${corStatus[c.status] || ''}`}>{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {detalhe && !carregandoDetalhe && aba === 'historico' && (
                  historico.length === 0 ? <p className="p-4 text-sm text-gray-500">Sem movimentação.</p> : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
                        <tr><th className={th}>Data</th><th className={th}>Movimento</th><th className={`${th} ${num}`}>Valor</th><th className={th}>Usuário</th><th className={th} /></tr>
                      </thead>
                      <tbody>
                        {historico.map((h, i) => (
                          <tr key={i} className="border-t border-gray-100 align-top dark:border-zinc-700">
                            <td className={td}>{dataBR(h.data)}</td>
                            <td className="px-2 py-1.5 text-sm">
                              <Badge variant="secondary" className="mr-2 text-[10px]">
                                {{ GERADO: 'Gerado', NOTA: 'Nota', TITULO: 'Baixa', ESTORNO: 'Estorno' }[h.tipo]}
                              </Badge>
                              {h.texto}
                              {h.uso?.estornado_em && <span className="ml-2 text-xs text-red-600">(estornado)</span>}
                            </td>
                            <td className={`${td} ${num} ${h.sinal > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                              {h.sinal > 0 ? '+' : '−'} {moeda(h.valor)}
                            </td>
                            <td className={`${td} text-xs text-gray-500`}>{h.uso?.username || ''}</td>
                            <td className={td}>
                              {h.uso && h.uso.fpg_cof_id && !h.uso.estornado_em && (
                                <button className={`${botaoSec} px-2 py-1 text-xs`} onClick={() => setEstorno(h.uso!)} title="Estornar esta baixa">
                                  <Undo2 className="h-3.5 w-3.5" /> Estornar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
                {detalhe && !carregandoDetalhe && aba === 'filiais' && (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
                      <tr><th className={th}>Código</th><th className={th}>Nome</th><th className={th}>CNPJ/CPF</th></tr>
                    </thead>
                    <tbody>
                      {detalhe.credores.map((c) => (
                        <tr key={c.cod_credor} className="border-t border-gray-100 dark:border-zinc-700">
                          <td className={`${td} font-mono`}>{c.cod_credor}</td>
                          <td className={td}><Building2 className="mr-1 inline h-3.5 w-3.5 text-gray-400" />{c.nome}</td>
                          <td className={td}>{doc(c.cpf_cgc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {estorno && (
        <ModalEstorno
          uso={estorno}
          usuario={usuario}
          onFechar={() => setEstorno(null)}
          onConcluido={async () => { setEstorno(null); await recarregarTudo(); }}
        />
      )}
    </div>
  );
}

/** Aba "Títulos em aberto": títulos do fornecedor e das filiais; marca, informa quanto e baixa com o crédito. */
function PainelUsarCredito({ grupo, saldo, usuario, onConcluido }: {
  grupo: string; saldo: number; usuario: string; onConcluido: () => void;
}) {
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [marcados, setMarcados] = useState<Record<string, string>>({}); // cod_pgto → valor digitado
  const [obs, setObs] = useState('');
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    fetch(`${API}/detalhe?grupo=${encodeURIComponent(grupo)}&titulos=1`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.erro || 'Erro'); setTitulos(j.titulos || []); })
      .catch((e) => toast.error(e.message))
      .finally(() => setCarregando(false));
  }, [grupo]);

  const total = r2(Object.values(marcados).reduce((s, v) => s + lerValor(v), 0));
  const restante = r2(saldo - total);

  const alternar = (t: Titulo) => {
    setMarcados((m) => {
      const n = { ...m };
      if (n[t.cod_pgto] !== undefined) delete n[t.cod_pgto];
      else {
        const jaUsado = Object.values(n).reduce((s, v) => s + lerValor(v), 0);
        const sugestao = r2(Math.max(0, Math.min(t.saldo, saldo - jaUsado)));
        n[t.cod_pgto] = mostrarValor(sugestao);
      }
      return n;
    });
  };

  const erroItem = (t: Titulo) => {
    const v = marcados[t.cod_pgto];
    if (v === undefined) return '';
    const n = lerValor(v);
    if (n <= 0) return 'Informe o valor';
    if (n > t.saldo + 0.01) return 'Maior que o saldo do título';
    return '';
  };
  const temErro = titulos.some((t) => erroItem(t)) || total <= 0 || restante < -0.005;

  const confirmar = async () => {
    setGravando(true);
    try {
      const itens = Object.entries(marcados).map(([cod_pgto, v]) => ({ cod_pgto, valor: lerValor(v) }));
      const r = await fetch(`${API}/usar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo, itens, obs: obs || null, usuario }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao usar o crédito');
      toast.success(`Crédito usado: ${moeda(j.total)} em ${j.baixas?.length || 0} título(s). Saldo: ${moeda(j.saldo_restante)}.`);
      onConcluido();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };

  const semCredito = saldo <= 0.005;
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-gray-500">
        Títulos em aberto do fornecedor e das filiais. Marque quais baixar com o crédito e quanto de cada um (parcial permitido).
        A baixa sai como ABATIMENTO DE SALDO e não mexe em caixa nem banco.
        {semCredito && <b className="ml-1 text-amber-600">Este fornecedor está sem saldo de crédito.</b>}
      </p>
        <div className="rounded border border-gray-200 dark:border-zinc-700">
          {carregando ? (
            <div className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : titulos.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhum título em aberto para este fornecedor ou filiais.</p>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
                <tr>
                  <th className={th} /><th className={th}>Filial</th><th className={th}>NF</th><th className={th}>Duplicata</th>
                  <th className={th}>Vencimento</th><th className={`${th} ${num}`}>Valor</th><th className={`${th} ${num}`}>Saldo</th>
                  <th className={`${th} ${num}`}>Abater</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((t) => {
                  const marcado = marcados[t.cod_pgto] !== undefined;
                  const erro = erroItem(t);
                  return (
                    <tr key={t.cod_pgto} className={`border-t border-gray-100 dark:border-zinc-700 ${t.em_remessa ? 'opacity-50' : ''}`}>
                      <td className={td}>
                        <input type="checkbox" disabled={t.em_remessa || gravando || (semCredito && !marcado)} checked={marcado} onChange={() => alternar(t)} />
                      </td>
                      <td className={`${td} max-w-[200px] truncate`} title={t.nome}>{t.nome}</td>
                      <td className={td}>{t.nro_nf || '-'}</td>
                      <td className={`${td} font-mono`}>{t.nro_dup || t.cod_pgto}{t.em_remessa && <span className="ml-1 text-xs text-amber-600">em remessa</span>}</td>
                      <td className={td}>{dataBR(t.dt_venc)}</td>
                      <td className={`${td} ${num}`}>{moeda(t.valor_pgto)}</td>
                      <td className={`${td} ${num}`}>{moeda(t.saldo)}</td>
                      <td className={`${td} ${num}`}>
                        {marcado && (
                          <div>
                            <Input
                              className={`h-8 w-28 text-right ${erro ? 'border-red-500' : ''}`}
                              value={marcados[t.cod_pgto]}
                              disabled={gravando}
                              onChange={(e) => setMarcados((m) => ({ ...m, [t.cod_pgto]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                            />
                            {erro && <div className="text-[11px] text-red-600">{erro}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Textarea placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={250} disabled={gravando} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            Crédito {moeda(saldo)} · selecionado <b>{moeda(total)}</b> ·{' '}
            <span className={restante < -0.005 ? 'font-semibold text-red-600' : ''}>sobra {moeda(restante)}</span>
          </div>
          <div className="flex gap-2">
            <button className={botaoSec} onClick={() => { setMarcados({}); setObs(''); }} disabled={gravando || !Object.keys(marcados).length}>
              Limpar seleção
            </button>
            <button className={botaoPrimario} onClick={confirmar} disabled={gravando || temErro}>
              {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar baixa
            </button>
          </div>
        </div>
    </div>
  );
}

function ModalEstorno({ uso, usuario, onFechar, onConcluido }: { uso: Uso; usuario: string; onFechar: () => void; onConcluido: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [gravando, setGravando] = useState(false);
  const confirmar = async () => {
    setGravando(true);
    try {
      const r = await fetch(`${API}/estornar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cod_pgto: uso.cod_pgto_abatido, fpg_cof_id: uso.fpg_cof_id, motivo, usuario }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao estornar');
      toast.success(`Estorno feito: ${moeda(j.devolvido)} voltou para o crédito.`);
      onConcluido();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !gravando && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Estornar baixa com crédito</DialogTitle>
          <DialogDescription>
            Título {uso.dup_abatido || uso.cod_pgto_abatido}: a baixa é cancelada no histórico do título, que volta a ficar em aberto,
            e o valor volta para o crédito do fornecedor.
          </DialogDescription>
        </DialogHeader>
        <Textarea placeholder="Motivo do estorno (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={250} disabled={gravando} />
        <DialogFooter>
          <button className={botaoSec} onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button className={`${botao} bg-red-600 text-white hover:bg-red-700`} onClick={confirmar} disabled={gravando || !motivo.trim()}>
            {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Estornar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
