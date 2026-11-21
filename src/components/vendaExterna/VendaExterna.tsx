/**
 * Venda Externa — tela de venda para celular/tablet (rota /externo).
 * Fase 1: online, mesmas APIs e regras da Nova Venda V2 (src/lib/vendaExterna/regras.ts).
 * Fase 2/3: a mesma tela passa a usar a fonte local (sem internet).
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import api from '@/components/services/api';
import {
  User,
  Package,
  CreditCard,
  ClipboardCheck,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  analisarVenda,
  brl,
  formasVisiveis,
  montarPayloadVenda,
  TABELAS_PRECO,
  totalImpostos,
  totalItem,
  type ClienteVenda,
  type EstadoPagamento,
  type FormaPagamento,
  type ItemVenda,
  type PrazoOpcao,
} from '@/lib/vendaExterna/regras';
import { fonteOnline as fonte, type ProdutoBusca } from '@/lib/vendaExterna/fonteOnline';

type Etapa = 'cliente' | 'itens' | 'pagamento' | 'resumo';
const ETAPAS: { id: Etapa; rotulo: string; Icone: any }[] = [
  { id: 'cliente', rotulo: 'Cliente', Icone: User },
  { id: 'itens', rotulo: 'Itens', Icone: Package },
  { id: 'pagamento', rotulo: 'Pagamento', Icone: CreditCard },
  { id: 'resumo', rotulo: 'Resumo', Icone: ClipboardCheck },
];

const PAG_VAZIO: EstadoPagamento = { forma: null, prazo: '', prazoDias: [], parcelasCartao: 0 };

interface Rascunho {
  cliente: ClienteVenda | null;
  itens: ItemVenda[];
  pag: EstadoPagamento;
  obs: string;
}

const lerNumero = (s: string) => {
  const t = String(s || '').trim().replace(/\./g, '').replace(',', '.');
  const v = Number(t);
  return Number.isFinite(v) ? v : 0;
};

function useDebounce<T>(valor: T, ms: number) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** mensagem de erro de uma chamada (axios) para mostrar na tela */
const msgErro = (e: any) =>
  e?.response?.data?.error ||
  e?.response?.data?.erro ||
  (e?.response?.status ? `Erro ${e.response.status}` : e?.message) ||
  'Falha na consulta';

const lerCookie = (nome: string) => {
  const par = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : '';
};

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

export default function VendaExterna() {
  const { user } = useContext(AuthContext);
  const online = useOnline();

  // As APIs de venda leem a filial do cookie filial_melo. A tela de filial apaga esse
  // cookie ao abrir; se o vendedor entrou direto em /externo, recupera do perfil.
  const [semFilial, setSemFilial] = useState(false);
  useEffect(() => {
    if (!user?.usuario) return;
    if (lerCookie('filial_melo')) {
      setSemFilial(false);
      return;
    }
    if (user.filial) {
      document.cookie = `filial_melo=${encodeURIComponent(user.filial)}; path=/; max-age=${60 * 60 * 24 * 7}`;
      setSemFilial(false);
    } else setSemFilial(true);
  }, [user?.usuario, user?.filial]);
  const chaveRascunho = `vendaExterna_rascunho_${user?.usuario || 'anon'}`;

  const funcoes = useMemo(
    () => (user?.funcoes || []).map((f: any) => (typeof f === 'string' ? f : f?.sigla)).filter(Boolean) as string[],
    [user],
  );
  const armId = useMemo(() => {
    const a: any = (user?.armazens || [])[0];
    return Number(a?.id_armazem ?? a?.value) || 1001;
  }, [user]);

  // ---------- estado da venda (rascunho guardado no aparelho) ----------
  const [etapa, setEtapa] = useState<Etapa>('cliente');
  const [cliente, setCliente] = useState<ClienteVenda | null>(null);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [pag, setPag] = useState<EstadoPagamento>(PAG_VAZIO);
  const [obs, setObs] = useState('');
  const carregouRascunho = useRef(false);

  useEffect(() => {
    if (!user?.usuario || carregouRascunho.current) return;
    carregouRascunho.current = true;
    try {
      const r: Rascunho | null = JSON.parse(localStorage.getItem(chaveRascunho) || 'null');
      if (r) {
        setCliente(r.cliente);
        setItens(r.itens || []);
        setPag(r.pag || PAG_VAZIO);
        setObs(r.obs || '');
        if (r.cliente) setEtapa(r.itens?.length ? 'itens' : 'cliente');
      }
    } catch {
      /* rascunho inválido: ignora */
    }
  }, [user?.usuario, chaveRascunho]);

  useEffect(() => {
    if (!carregouRascunho.current) return;
    try {
      const r: Rascunho = { cliente, itens, pag, obs };
      if (!cliente && itens.length === 0) localStorage.removeItem(chaveRascunho);
      else localStorage.setItem(chaveRascunho, JSON.stringify(r));
    } catch {
      /* sem espaço: segue */
    }
  }, [cliente, itens, pag, obs, chaveRascunho]);

  // ---------- dados auxiliares ----------
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  useEffect(() => {
    fonte.formasPagamento().then(setFormas).catch(() => setFormas([]));
  }, []);

  const [credito, setCredito] = useState<{ passou: string; mensagem?: string } | null>(null);
  const subtotal = useMemo(() => itens.reduce((a, i) => a + totalItem(i), 0), [itens]);
  const subtotalDeb = useDebounce(subtotal, 400);
  useEffect(() => {
    if (!cliente) {
      setCredito(null);
      return;
    }
    let vivo = true;
    fonte.validarCredito(cliente.codcli, subtotalDeb, pag.forma?.descricao || '').then((r) => vivo && setCredito(r));
    return () => {
      vivo = false;
    };
  }, [cliente, subtotalDeb, pag.forma]);

  const [prazos, setPrazos] = useState<PrazoOpcao[]>([]);
  useEffect(() => {
    fonte.opcoesPrazo(subtotalDeb).then(setPrazos).catch(() => setPrazos([]));
  }, [subtotalDeb]);

  const analise = useMemo(() => analisarVenda({ cliente, itens, pag, funcoes, credito }), [cliente, itens, pag, funcoes, credito]);
  const impostos = useMemo(() => totalImpostos(itens), [itens]);
  const impostosPendentes = itens.some((i) => i.impostos === undefined);

  // forma não-boleto limpa o prazo; à vista forçado tira boleto; parcelas do cartão no limite
  useEffect(() => {
    setPag((p) => {
      let n = p;
      if (p.forma && !analise.boleto && p.prazo && p.prazo !== 'FECHAMENTO NA SEMANA') n = { ...n, prazo: '', prazoDias: [] };
      if (analise.boleto && analise.prazoBloqueado) n = { ...n, forma: null, prazo: '', prazoDias: [] };
      if (analise.cartaoCredito && (n.parcelasCartao < 1 || n.parcelasCartao > analise.maxParcelasCartao))
        n = { ...n, parcelasCartao: Math.min(Math.max(1, n.parcelasCartao), analise.maxParcelasCartao) };
      if (!analise.cartaoCredito && n.parcelasCartao !== 0) n = { ...n, parcelasCartao: 0 };
      return n;
    });
  }, [analise.boleto, analise.prazoBloqueado, analise.cartaoCredito, analise.maxParcelasCartao]);

  // ---------- impostos (servidor) por item ----------
  const calcImpostos = useCallback(
    (lista: ItemVenda[], cli: ClienteVenda | null) => {
      if (!cli) return;
      lista.forEach((it) => {
        fonte.impostosItem(it.codprod, cli.codcli, it.qtd, it.prunit).then((r) => {
          setItens((prev) =>
            prev.map((x) =>
              x.codprod === it.codprod && x.qtd === it.qtd && x.prunit === it.prunit
                ? { ...x, impostos: r ? r.impostos : 0, campos_fiscais: r?.campos || {} }
                : x,
            ),
          );
        });
      });
    },
    [],
  );

  // ---------- cliente ----------
  const escolherCliente = useCallback(
    async (c: ClienteVenda) => {
      setCliente(c);
      setCredito(null);
      if (itens.length > 0) {
        try {
          const precos = await fonte.precos(itens.map((i) => i.codprod), c.prvenda);
          const novos = itens.map((i) => {
            const p = precos[i.codprod];
            return p > 0 ? { ...i, prunit: p, prvenda_original: p, impostos: undefined } : { ...i, impostos: undefined };
          });
          setItens(novos);
          calcImpostos(novos, c);
        } catch {
          /* mantém preços */
        }
      }
      setEtapa('itens');
    },
    [itens, calcImpostos],
  );

  // ---------- itens ----------
  const adicionar = useCallback(
    (p: ProdutoBusca) => {
      const i = itens.findIndex((x) => x.codprod === p.codprod);
      const novo: ItemVenda =
        i >= 0
          ? { ...itens[i], qtd: itens[i].qtd + 1, impostos: undefined }
          : {
              codprod: p.codprod,
              ref: p.ref,
              descr: p.descr,
              marca: p.marca,
              qtd: 1,
              prunit: p.preco,
              prvenda_original: p.preco,
              disp: p.disp,
            };
      setItens(i >= 0 ? itens.map((x, k) => (k === i ? novo : x)) : [novo, ...itens]);
      calcImpostos([novo], cliente);
    },
    [itens, cliente, calcImpostos],
  );

  const alterarItem = useCallback(
    (codprod: string, mud: Partial<ItemVenda>) => {
      const atual = itens.find((x) => x.codprod === codprod);
      if (!atual) return;
      const novo = { ...atual, ...mud, impostos: undefined };
      setItens(itens.map((x) => (x.codprod === codprod ? novo : x)));
      calcImpostos([novo], cliente);
    },
    [itens, cliente, calcImpostos],
  );

  const remover = (codprod: string) => setItens((prev) => prev.filter((x) => x.codprod !== codprod));

  // ---------- envio ----------
  const [envio, setEnvio] = useState<{ fase: 'enviando' | 'ok' | 'erro'; msg: string; nro?: string } | null>(null);
  const enviar = async () => {
    if (!cliente || !analise.podeEnviar || envio?.fase === 'enviando') return;
    if (!online) {
      setEnvio({ fase: 'erro', msg: 'Sem internet. (O envio sem internet chega na próxima fase.)' });
      return;
    }
    setEnvio({ fase: 'enviando', msg: 'Enviando a venda…' });
    try {
      const transporte =
        String(cliente.claspgto).toUpperCase() === 'V' && cliente.status !== '4'
          ? { codtptransp: '001', descr: 'CLIENTE RETIRA' }
          : null;
      const payload = montarPayloadVenda({
        cliente,
        itens,
        pag,
        analise,
        usuario: { usuario: user?.usuario || '', codusr: user?.codusr || 0 },
        armId,
        obs,
        transporte,
      });
      const r = await api.post('/api/vendas/postgresql/finalizarVenda', payload);
      if (r.data?.ok) {
        setEnvio({
          fase: 'ok',
          msg: r.data.status === 'B' ? 'Venda enviada para análise (preço abaixo da tabela).' : 'Venda salva.',
          nro: r.data.nrovenda || r.data.codvenda,
        });
      } else {
        setEnvio({ fase: 'erro', msg: r.data?.error || 'Falha ao salvar a venda.' });
      }
    } catch (e: any) {
      setEnvio({ fase: 'erro', msg: e?.response?.data?.error || e?.message || 'Erro ao salvar a venda.' });
    }
  };

  const novaVenda = () => {
    setCliente(null);
    setItens([]);
    setPag(PAG_VAZIO);
    setObs('');
    setCredito(null);
    setEnvio(null);
    setEtapa('cliente');
    try {
      localStorage.removeItem(chaveRascunho);
    } catch {
      /* */
    }
  };

  // ---------- próximo passo (botão do rodapé) ----------
  const proximo: { rotulo: string; acao: () => void; ativo: boolean } = (() => {
    if (etapa === 'cliente') return { rotulo: 'Itens', acao: () => setEtapa('itens'), ativo: !!cliente };
    if (etapa === 'itens') return { rotulo: 'Pagamento', acao: () => setEtapa('pagamento'), ativo: itens.length > 0 };
    if (etapa === 'pagamento') return { rotulo: 'Resumo', acao: () => setEtapa('resumo'), ativo: true };
    return { rotulo: analise.precoAbaixo ? 'Enviar p/ análise' : 'Enviar venda', acao: enviar, ativo: analise.podeEnviar };
  })();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
      {/* topo */}
      <header className="sticky top-0 z-20 bg-[#1e3a5f] text-white px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">Venda Externa</span>
          <span
            className={`ml-auto inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${online ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? 'online' : 'sem internet'}
          </span>
        </div>
        <div className="text-xs text-blue-100 truncate">
          {user?.usuario}
          {cliente ? ` · ${cliente.codcli} ${cliente.nomefant || cliente.nome}` : ''}
        </div>
        {/* etapas */}
        <nav className="grid grid-cols-4 gap-1 mt-2">
          {ETAPAS.map(({ id, rotulo, Icone }) => {
            const ativo = etapa === id;
            const bloqueado = (id === 'itens' || id === 'pagamento' || id === 'resumo') && !cliente;
            return (
              <button
                key={id}
                disabled={bloqueado}
                onClick={() => setEtapa(id)}
                className={`flex flex-col items-center rounded-md py-1.5 text-[11px] ${
                  ativo ? 'bg-white text-[#1e3a5f] font-semibold' : 'text-blue-100'
                } disabled:opacity-40`}
              >
                <Icone size={18} />
                {rotulo}
                {id === 'itens' && itens.length > 0 ? ` (${itens.length})` : ''}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-3 pb-36">
        {semFilial && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-800">
            Filial não selecionada.{' '}
            <a href="/filial" className="font-semibold underline">
              Escolher filial
            </a>{' '}
            e depois voltar para /externo.
          </div>
        )}
        {etapa === 'cliente' && <EtapaCliente cliente={cliente} credito={credito} onEscolher={escolherCliente} />}
        {etapa === 'itens' && cliente && (
          <EtapaItens
            cliente={cliente}
            itens={itens}
            armId={armId}
            onAdicionar={adicionar}
            onAlterar={alterarItem}
            onRemover={remover}
          />
        )}
        {etapa === 'pagamento' && cliente && (
          <EtapaPagamento formas={formas} prazos={prazos} pag={pag} setPag={setPag} analise={analise} obs={obs} setObs={setObs} />
        )}
        {etapa === 'resumo' && cliente && (
          <EtapaResumo
            cliente={cliente}
            itens={itens}
            analise={analise}
            impostos={impostos}
            impostosPendentes={impostosPendentes}
            pag={pag}
          />
        )}
      </main>

      {/* rodapé fixo: total + próximo */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="max-w-3xl mx-auto">
          {analise.impedimento && etapa !== 'cliente' && (
            <div
              className={`text-[11px] font-semibold mb-1 ${
                analise.podeEnviar ? 'text-amber-600' : 'text-red-600'
              } flex items-center gap-1`}
            >
              <AlertTriangle size={13} /> {analise.impedimento}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-500">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                {impostos > 0 ? ` · impostos ${brl(impostos)}` : ''}
              </div>
              <div className="text-xl font-bold text-green-700 dark:text-green-400">{brl(subtotal + impostos)}</div>
            </div>
            <button
              onClick={proximo.acao}
              disabled={!proximo.ativo || envio?.fase === 'enviando'}
              className="rounded-xl bg-[#1e3a5f] text-white font-semibold px-5 py-3 text-sm disabled:opacity-40"
            >
              {proximo.rotulo}
            </button>
          </div>
        </div>
      </footer>

      {/* resultado do envio */}
      {envio && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 text-center">
            {envio.fase === 'enviando' && <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#1e3a5f]" />}
            {envio.fase === 'ok' && <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />}
            {envio.fase === 'erro' && <AlertTriangle className="w-12 h-12 mx-auto text-red-600" />}
            {envio.nro && <div className="text-2xl font-bold mt-3">Nº {envio.nro}</div>}
            <p className="mt-2 text-sm whitespace-pre-line">{envio.msg}</p>
            {envio.fase === 'ok' && (
              <button onClick={novaVenda} className="mt-5 w-full rounded-xl bg-[#1e3a5f] text-white font-semibold py-3">
                Nova venda
              </button>
            )}
            {envio.fase === 'erro' && (
              <button onClick={() => setEnvio(null)} className="mt-5 w-full rounded-xl border border-gray-300 py-3 font-semibold">
                Voltar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================================
function Cartao({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-3 ${className}`}>{children}</div>
  );
}

function CampoBusca({
  valor,
  setValor,
  placeholder,
  carregando,
}: {
  valor: string;
  setValor: (v: string) => void;
  placeholder: string;
  carregando?: boolean;
}) {
  return (
    <div className="relative">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-10 pr-10 py-3 text-base outline-none focus:ring-2 focus:ring-[#1e3a5f]"
        autoCapitalize="characters"
        autoCorrect="off"
        enterKeyHint="search"
      />
      {carregando ? (
        <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
      ) : valor ? (
        <button onClick={() => setValor('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Limpar">
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}

// ---------- Cliente ----------
function EtapaCliente({
  cliente,
  credito,
  onEscolher,
}: {
  cliente: ClienteVenda | null;
  credito: { passou: string; mensagem?: string } | null;
  onEscolher: (c: ClienteVenda) => void;
}) {
  const [termo, setTermo] = useState('');
  const termoDeb = useDebounce(termo, 400);
  const [lista, setLista] = useState<ClienteVenda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const t = termoDeb.trim();
    setErro('');
    if (!t || (!/^\d+$/.test(t) && t.length < 3)) {
      setLista([]);
      return;
    }
    let vivo = true;
    setCarregando(true);
    fonte
      .buscarClientes(t)
      .then((r) => vivo && setLista(r))
      .catch((e) => {
        if (!vivo) return;
        setLista([]);
        setErro(msgErro(e));
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [termoDeb]);

  return (
    <div className="space-y-3">
      {cliente && (
        <Cartao className="border-[#1e3a5f]">
          <div className="text-xs text-gray-500">Cliente da venda</div>
          <div className="font-semibold">
            {cliente.codcli} · {cliente.nomefant || cliente.nome}
          </div>
          {cliente.nomefant && cliente.nome !== cliente.nomefant && <div className="text-xs text-gray-500">{cliente.nome}</div>}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
            <span>Documento: {cliente.cpfcgc || '—'}</span>
            <span>
              {cliente.cidade || ''}
              {cliente.uf ? `/${cliente.uf}` : ''}
            </span>
            <span>Tabela: {TABELAS_PRECO[Number(cliente.prvenda)] || cliente.prvenda}</span>
            <span>Classe: {cliente.claspgto || '—'}</span>
            <span>Limite: {brl(cliente.limite)}</span>
            <span>Débito: {brl(cliente.debito)}</span>
            <span className="col-span-2 font-semibold">Disponível: {brl(cliente.saldo)}</span>
          </div>
          {credito?.passou === 'NOK' && (
            <div className="mt-2 text-xs font-semibold text-red-600 flex gap-1">
              <AlertTriangle size={14} className="shrink-0" /> {credito.mensagem || 'Cliente com restrição'}
            </div>
          )}
        </Cartao>
      )}

      <CampoBusca
        valor={termo}
        setValor={setTermo}
        placeholder={cliente ? 'Trocar cliente: nome, CNPJ ou código' : 'Cliente: nome, CNPJ ou código'}
        carregando={carregando}
      />

      <div className="space-y-2">
        {lista.map((c) => (
          <button key={c.codcli} onClick={() => { onEscolher(c); setTermo(''); }} className="w-full text-left">
            <Cartao className="active:bg-blue-50 dark:active:bg-zinc-800">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">
                    {c.codcli} · {c.nomefant || c.nome}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {c.cpfcgc} {c.cidade ? `· ${c.cidade}/${c.uf}` : ''}
                  </div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="text-gray-500">disponível</div>
                  <div className={`font-semibold ${c.saldo > 0 ? 'text-green-700' : 'text-red-600'}`}>{brl(c.saldo)}</div>
                </div>
              </div>
            </Cartao>
          </button>
        ))}
        {erro ? (
          <div className="text-center text-sm text-red-600 py-6">Não foi possível buscar: {erro}</div>
        ) : (
          !carregando &&
          termoDeb.trim().length >= 3 &&
          lista.length === 0 && <div className="text-center text-sm text-gray-500 py-6">Nenhum cliente encontrado.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Itens ----------
function EtapaItens({
  cliente,
  itens,
  armId,
  onAdicionar,
  onAlterar,
  onRemover,
}: {
  cliente: ClienteVenda;
  itens: ItemVenda[];
  armId: number;
  onAdicionar: (p: ProdutoBusca) => void;
  onAlterar: (codprod: string, m: Partial<ItemVenda>) => void;
  onRemover: (codprod: string) => void;
}) {
  const [termo, setTermo] = useState('');
  const termoDeb = useDebounce(termo, 450);
  const [lista, setLista] = useState<ProdutoBusca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const t = termoDeb.trim();
    setErro('');
    if (t.length < 2) {
      setLista([]);
      return;
    }
    let vivo = true;
    setCarregando(true);
    fonte
      .buscarProdutos(t, cliente.prvenda, armId)
      .then((r) => vivo && setLista(r.slice(0, 60)))
      .catch((e) => {
        if (!vivo) return;
        setLista([]);
        setErro(msgErro(e));
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [termoDeb, cliente.prvenda, armId]);

  const qtdNoCarrinho = (codprod: string) => itens.find((i) => i.codprod === codprod)?.qtd || 0;

  return (
    <div className="space-y-3">
      <CampoBusca valor={termo} setValor={setTermo} placeholder="Produto: referência, descrição ou | marca" carregando={carregando} />

      {/* resultados da busca */}
      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map((p) => {
            const noCarrinho = qtdNoCarrinho(p.codprod);
            return (
              <Cartao key={p.codprod}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">
                      {p.ref} <span className="text-xs font-normal text-gray-500">· {p.marca}</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{p.descr}</div>
                    <div className="text-xs mt-1">
                      <span className={p.disp > 0 ? 'text-green-700' : 'text-red-600'}>disp. {p.disp}</span>
                      <span className="ml-3 font-semibold">{brl(p.preco)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAdicionar(p)}
                    disabled={!(p.preco > 0)}
                    className="shrink-0 rounded-xl bg-[#1e3a5f] text-white w-12 h-12 flex flex-col items-center justify-center disabled:opacity-30"
                    aria-label="Adicionar"
                  >
                    <Plus size={20} />
                    {noCarrinho > 0 && <span className="text-[10px] leading-none">{noCarrinho}</span>}
                  </button>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
      {erro ? (
        <div className="text-center text-sm text-red-600 py-4">Não foi possível buscar: {erro}</div>
      ) : (
        !carregando &&
        termoDeb.trim().length >= 2 &&
        lista.length === 0 && <div className="text-center text-sm text-gray-500 py-4">Nenhum produto com preço nesta tabela.</div>
      )}

      {/* carrinho */}
      {itens.length > 0 && (
        <>
          <div className="text-xs font-semibold text-gray-500 uppercase pt-2">Itens da venda</div>
          <div className="space-y-2">
            {itens.map((it) => (
              <ItemCarrinho key={it.codprod} it={it} onAlterar={onAlterar} onRemover={onRemover} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ItemCarrinho({
  it,
  onAlterar,
  onRemover,
}: {
  it: ItemVenda;
  onAlterar: (codprod: string, m: Partial<ItemVenda>) => void;
  onRemover: (codprod: string) => void;
}) {
  const [precoTxt, setPrecoTxt] = useState(it.prunit.toFixed(2).replace('.', ','));
  useEffect(() => setPrecoTxt(it.prunit.toFixed(2).replace('.', ',')), [it.prunit]);
  const abaixo = it.prvenda_original > 0 && it.prunit < it.prvenda_original - 0.01;
  const semEstoque = it.qtd > it.disp;

  return (
    <Cartao>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">
            {it.ref} <span className="text-xs font-normal text-gray-500">· {it.marca}</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{it.descr}</div>
        </div>
        <button onClick={() => onRemover(it.codprod)} className="text-red-500 p-1" aria-label="Remover">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex items-center rounded-xl border border-gray-300 dark:border-zinc-700">
          <button
            onClick={() => (it.qtd > 1 ? onAlterar(it.codprod, { qtd: it.qtd - 1 }) : onRemover(it.codprod))}
            className="w-10 h-10 flex items-center justify-center"
            aria-label="Diminuir"
          >
            <Minus size={18} />
          </button>
          <input
            value={it.qtd}
            inputMode="numeric"
            onChange={(e) => {
              const q = Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0));
              if (q > 0) onAlterar(it.codprod, { qtd: q });
            }}
            className="w-12 text-center bg-transparent text-base font-semibold outline-none"
          />
          <button onClick={() => onAlterar(it.codprod, { qtd: it.qtd + 1 })} className="w-10 h-10 flex items-center justify-center" aria-label="Aumentar">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 block">preço unit.</label>
          <input
            value={precoTxt}
            inputMode="decimal"
            onChange={(e) => setPrecoTxt(e.target.value)}
            onBlur={() => {
              const v = lerNumero(precoTxt);
              if (v > 0 && Math.abs(v - it.prunit) > 0.001) onAlterar(it.codprod, { prunit: +v.toFixed(2) });
              else setPrecoTxt(it.prunit.toFixed(2).replace('.', ','));
            }}
            className={`w-full rounded-lg border px-2 py-1.5 text-base bg-transparent outline-none ${
              abaixo ? 'border-amber-500 text-amber-700' : 'border-gray-300 dark:border-zinc-700'
            }`}
          />
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500">total</div>
          <div className="font-bold text-sm">{brl(totalItem(it))}</div>
          {it.impostos === undefined ? (
            <div className="text-[10px] text-gray-400">impostos…</div>
          ) : it.impostos > 0 ? (
            <div className="text-[10px] text-gray-500">+ {brl(it.impostos)} imp.</div>
          ) : null}
        </div>
      </div>
      {(abaixo || semEstoque) && (
        <div className="mt-1 text-[11px] text-amber-700 flex flex-wrap gap-x-3">
          {abaixo && <span>abaixo da tabela ({brl(it.prvenda_original)})</span>}
          {semEstoque && <span>disponível só {it.disp}</span>}
        </div>
      )}
    </Cartao>
  );
}

// ---------- Pagamento ----------
function EtapaPagamento({
  formas,
  prazos,
  pag,
  setPag,
  analise,
  obs,
  setObs,
}: {
  formas: FormaPagamento[];
  prazos: PrazoOpcao[];
  pag: EstadoPagamento;
  setPag: React.Dispatch<React.SetStateAction<EstadoPagamento>>;
  analise: ReturnType<typeof analisarVenda>;
  obs: string;
  setObs: (v: string) => void;
}) {
  const visiveis = formasVisiveis(formas, analise.prazoBloqueado);
  const botao = (ativo: boolean) =>
    `rounded-xl border-2 px-3 py-3 text-sm font-semibold text-center ${
      ativo ? 'border-[#1e3a5f] bg-blue-50 dark:bg-blue-950/40 text-[#1e3a5f] dark:text-blue-200' : 'border-gray-200 dark:border-zinc-700'
    }`;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Forma de pagamento</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {visiveis.map((f) => (
            <button
              key={String(f.id)}
              onClick={() => setPag((p) => ({ ...p, forma: f, ...(p.prazo === 'FECHAMENTO NA SEMANA' ? { prazo: '', prazoDias: [] } : {}) }))}
              className={botao(pag.forma?.id === f.id)}
            >
              {f.descricao}
            </button>
          ))}
          {!analise.prazoBloqueado && (
            <button
              onClick={() => setPag((p) => ({ ...p, forma: null, prazo: 'FECHAMENTO NA SEMANA', prazoDias: [] }))}
              className={botao(pag.prazo === 'FECHAMENTO NA SEMANA')}
            >
              FECHAMENTO NA SEMANA
            </button>
          )}
        </div>
        {analise.avistaForcado && (
          <div className="text-xs text-amber-700 mt-2">Cliente com pagamento à vista obrigatório.</div>
        )}
        {analise.prazoBloqueado && analise.prazoBloqueadoMsg && (
          <div className="text-xs text-gray-500 mt-1">Boleto indisponível: {analise.prazoBloqueadoMsg}</div>
        )}
      </div>

      {analise.boleto && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Prazo do boleto (dias)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {prazos.map((o) => (
              <button key={o.prazo} onClick={() => setPag((p) => ({ ...p, prazo: o.prazo, prazoDias: o.dias }))} className={botao(pag.prazo === o.prazo)}>
                {o.prazo}
              </button>
            ))}
          </div>
          {prazos.length === 0 && <div className="text-xs text-gray-500">Sem faixa de prazo para este valor.</div>}
        </div>
      )}

      {analise.cartaoCredito && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Parcelas no cartão</div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: analise.maxParcelasCartao }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPag((p) => ({ ...p, parcelasCartao: n }))} className={botao(pag.parcelasCartao === n)}>
                {n}x
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Observação</div>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-base outline-none"
          placeholder="Observação da venda (opcional)"
        />
      </div>
    </div>
  );
}

// ---------- Resumo ----------
function EtapaResumo({
  cliente,
  itens,
  analise,
  impostos,
  impostosPendentes,
  pag,
}: {
  cliente: ClienteVenda;
  itens: ItemVenda[];
  analise: ReturnType<typeof analisarVenda>;
  impostos: number;
  impostosPendentes: boolean;
  pag: EstadoPagamento;
}) {
  return (
    <div className="space-y-3">
      <Cartao>
        <div className="text-xs text-gray-500">Cliente</div>
        <div className="font-semibold">
          {cliente.codcli} · {cliente.nomefant || cliente.nome}
        </div>
        <div className="text-xs text-gray-500">Tabela {TABELAS_PRECO[Number(cliente.prvenda)] || cliente.prvenda}</div>
      </Cartao>
      <Cartao>
        <div className="text-xs text-gray-500 mb-1">Itens</div>
        {itens.map((i) => (
          <div key={i.codprod} className="flex justify-between text-sm py-0.5 gap-2">
            <span className="truncate">
              {i.qtd}× {i.ref}
            </span>
            <span className="shrink-0">{brl(totalItem(i))}</span>
          </div>
        ))}
      </Cartao>
      <Cartao>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{brl(analise.total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Impostos (IPI + ST)</span>
          <span>{impostosPendentes ? 'calculando…' : brl(impostos)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg mt-1">
          <span>Total</span>
          <span className="text-green-700 dark:text-green-400">{brl(analise.total + impostos)}</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Pagamento: <span className="font-semibold">{analise.obsfat || (pag.forma?.descricao ?? '—')}</span>
        </div>
      </Cartao>
      {analise.impedimento && (
        <div className={`rounded-xl p-3 text-sm font-semibold ${analise.podeEnviar ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
          {analise.impedimento}
        </div>
      )}
    </div>
  );
}
