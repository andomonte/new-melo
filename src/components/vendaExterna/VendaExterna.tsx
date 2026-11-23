/**
 * Venda Externa — tela de venda para celular/tablet (/externo/<filial>).
 * Funciona online (dados na hora) e sem internet (pacote no aparelho): a fonte escolhe
 * sozinha (lib/vendaExterna/fonte.ts). Todo pedido é guardado no aparelho e enviado pela
 * fila (lib/vendaExterna/fila.ts) — sem internet, sai quando a conexão voltar.
 * Regras iguais às da Nova Venda V2 (lib/vendaExterna/regras.ts).
 * Login/PIN/sincronização: VendaExternaApp.tsx. Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Package,
  CreditCard,
  ClipboardCheck,
  ListChecks,
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
  RefreshCw,
  LogOut,
  Send,
  Pencil,
  Clock,
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
import type { ProdutoBusca } from '@/lib/vendaExterna/fonteOnline';
import { fonte } from '@/lib/vendaExterna/fonte';
import { sessaoVencida, type SessaoExterna } from '@/lib/vendaExterna/sessao';
import {
  EVENTO_FILA,
  enviarPedido,
  excluirPedido,
  guardarPedido,
  listarPedidos,
  novoUuid,
  proximoNumeroLocal,
  type PedidoLocal,
} from '@/lib/vendaExterna/fila';
import type { MetaPacote } from '@/lib/vendaExterna/sincronizar';

type Etapa = 'cliente' | 'itens' | 'pagamento' | 'resumo' | 'pedidos';
const ETAPAS: { id: Etapa; rotulo: string; Icone: any }[] = [
  { id: 'cliente', rotulo: 'Cliente', Icone: User },
  { id: 'itens', rotulo: 'Itens', Icone: Package },
  { id: 'pagamento', rotulo: 'Pagamento', Icone: CreditCard },
  { id: 'resumo', rotulo: 'Resumo', Icone: ClipboardCheck },
  { id: 'pedidos', rotulo: 'Pedidos', Icone: ListChecks },
];

const PAG_VAZIO: EstadoPagamento = { forma: null, prazo: '', prazoDias: [], parcelasCartao: 0 };

interface Rascunho {
  cliente: ClienteVenda | null;
  itens: ItemVenda[];
  pag: EstadoPagamento;
  obs: string;
  editandoUuid?: string | null;
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

export function useOnline() {
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

const dataHora = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  sessao: SessaoExterna;
  meta: MetaPacote | null;
  sincronizando: string | null; // texto do progresso
  onSincronizar: () => void;
  onSair: () => void;
}

export default function VendaExterna({ sessao, meta, sincronizando, onSincronizar, onSair }: Props) {
  const online = useOnline();
  const vencida = sessaoVencida(sessao);
  const chaveRascunho = `vendaExterna_rascunho_${sessao.login}`;
  const funcoes = sessao.funcoes || [];
  const armId = sessao.armId || 1001;

  // ---------- estado da venda (rascunho guardado no aparelho) ----------
  const [etapa, setEtapa] = useState<Etapa>('cliente');
  const [cliente, setCliente] = useState<ClienteVenda | null>(null);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [pag, setPag] = useState<EstadoPagamento>(PAG_VAZIO);
  const [obs, setObs] = useState('');
  const [editandoUuid, setEditandoUuid] = useState<string | null>(null);
  const carregouRascunho = useRef(false);

  useEffect(() => {
    if (carregouRascunho.current) return;
    carregouRascunho.current = true;
    try {
      const r: Rascunho | null = JSON.parse(localStorage.getItem(chaveRascunho) || 'null');
      if (r) {
        setCliente(r.cliente);
        setItens(r.itens || []);
        setPag(r.pag || PAG_VAZIO);
        setObs(r.obs || '');
        setEditandoUuid(r.editandoUuid || null);
        if (r.cliente) setEtapa(r.itens?.length ? 'itens' : 'cliente');
      }
    } catch {
      /* rascunho inválido: ignora */
    }
  }, [chaveRascunho]);

  useEffect(() => {
    if (!carregouRascunho.current) return;
    try {
      const r: Rascunho = { cliente, itens, pag, obs, editandoUuid };
      if (!cliente && itens.length === 0) localStorage.removeItem(chaveRascunho);
      else localStorage.setItem(chaveRascunho, JSON.stringify(r));
    } catch {
      /* sem espaço: segue */
    }
  }, [cliente, itens, pag, obs, editandoUuid, chaveRascunho]);

  // ---------- pedidos do aparelho ----------
  const [pedidos, setPedidos] = useState<PedidoLocal[]>([]);
  const recarregarPedidos = useCallback(() => {
    listarPedidos(sessao.login).then(setPedidos).catch(() => setPedidos([]));
  }, [sessao.login]);
  useEffect(() => {
    recarregarPedidos();
    window.addEventListener(EVENTO_FILA, recarregarPedidos);
    return () => window.removeEventListener(EVENTO_FILA, recarregarPedidos);
  }, [recarregarPedidos]);
  const pendentes = pedidos.filter((p) => p.status !== 'ENVIADO').length;

  // ---------- dados auxiliares ----------
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  useEffect(() => {
    fonte.formasPagamento().then(setFormas).catch(() => setFormas([]));
  }, [online, meta?.gerado_em]);

  const [credito, setCredito] = useState<{ passou: string; mensagem?: string } | null>(null);
  const subtotal = useMemo(() => itens.reduce((a, i) => a + totalItem(i), 0), [itens]);
  const subtotalDeb = useDebounce(subtotal, 400);
  useEffect(() => {
    if (!cliente) {
      setCredito(null);
      return;
    }
    let vivo = true;
    fonte
      .validarCredito(cliente.codcli, subtotalDeb, pag.forma?.descricao || '')
      .then((r) => vivo && setCredito(r))
      .catch(() => vivo && setCredito(null));
    return () => {
      vivo = false;
    };
  }, [cliente, subtotalDeb, pag.forma, online]);

  const [prazos, setPrazos] = useState<PrazoOpcao[]>([]);
  useEffect(() => {
    fonte.opcoesPrazo(subtotalDeb).then(setPrazos).catch(() => setPrazos([]));
  }, [subtotalDeb, online]);

  const analise = useMemo(() => analisarVenda({ cliente, itens, pag, funcoes, credito }), [cliente, itens, pag, funcoes, credito]);
  const impostos = useMemo(() => totalImpostos(itens), [itens]);
  const impostosPendentes = itens.some((i) => i.impostos === undefined);
  const semImpostosCalculados = itens.some((i) => i.impostos === 0 && !i.campos_fiscais?.ncm) && !online;

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

  // ---------- impostos (servidor; sem internet ficam para o envio) ----------
  const calcImpostos = useCallback((lista: ItemVenda[], cli: ClienteVenda | null) => {
    if (!cli) return;
    lista.forEach((it) => {
      fonte
        .impostosItem(it.codprod, cli.codcli, it.qtd, it.prunit)
        .catch(() => null)
        .then((r) => {
          setItens((prev) =>
            prev.map((x) =>
              x.codprod === it.codprod && x.qtd === it.qtd && x.prunit === it.prunit
                ? { ...x, impostos: r ? r.impostos : 0, campos_fiscais: r?.campos || {} }
                : x,
            ),
          );
        });
    });
  }, []);

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

  // ---------- envio: guarda no aparelho e manda pela fila ----------
  const [envio, setEnvio] = useState<{
    fase: 'enviando' | 'ok' | 'guardado' | 'pendencia' | 'erro';
    msg: string;
    nro?: string;
  } | null>(null);

  const enviar = async () => {
    if (!cliente || !analise.podeEnviar || envio?.fase === 'enviando') return;
    if (vencida) {
      setEnvio({ fase: 'erro', msg: 'Sua sessão venceu (7 dias sem conectar). Conecte-se e entre de novo para fazer pedidos.' });
      return;
    }
    setEnvio({ fase: 'enviando', msg: 'Guardando o pedido…' });
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
        usuario: { usuario: sessao.login, codusr: sessao.codvend },
        armId,
        obs,
        transporte,
      });
      const anterior = editandoUuid ? pedidos.find((p) => p.uuid === editandoUuid) : undefined;
      const agora = new Date().toISOString();
      const pedido: PedidoLocal = {
        uuid: anterior?.uuid || novoUuid(),
        numero_local: anterior?.numero_local || proximoNumeroLocal(sessao.codvend),
        login: sessao.login,
        codcli: cliente.codcli,
        cliente_nome: cliente.nomefant || cliente.nome,
        total: subtotal + impostos,
        itens_count: itens.length,
        criado_em: anterior?.criado_em || agora,
        atualizado_em: agora,
        payload,
        liberaPreco: funcoes.includes('BPV') || funcoes.includes('MPV'),
        rascunho: { cliente, itens, pag, obs },
        status: 'AGUARDANDO',
      };
      await guardarPedido(pedido);

      if (!navigator.onLine) {
        setEnvio({
          fase: 'guardado',
          nro: pedido.numero_local,
          msg: 'Sem internet: o pedido ficou guardado no aparelho e será enviado sozinho quando a conexão voltar.',
        });
        return;
      }
      setEnvio({ fase: 'enviando', msg: 'Enviando o pedido…' });
      const r = await enviarPedido(sessao, pedido.uuid);
      if (r?.status === 'ENVIADO') {
        setEnvio({ fase: 'ok', nro: r.nrovenda || r.codvenda, msg: r.mensagem || 'Venda gravada.' });
      } else if (r?.status === 'PENDENCIA') {
        setEnvio({ fase: 'pendencia', nro: pedido.numero_local, msg: r.mensagem || 'Pedido com pendência.' });
      } else {
        setEnvio({
          fase: 'guardado',
          nro: pedido.numero_local,
          msg: r?.mensagem || 'O pedido ficou guardado e será enviado sozinho assim que possível.',
        });
      }
    } catch (e: any) {
      setEnvio({ fase: 'erro', msg: msgErro(e) });
    }
  };

  const novaVenda = () => {
    setCliente(null);
    setItens([]);
    setPag(PAG_VAZIO);
    setObs('');
    setCredito(null);
    setEnvio(null);
    setEditandoUuid(null);
    setEtapa('cliente');
    try {
      localStorage.removeItem(chaveRascunho);
    } catch {
      /* */
    }
  };

  /** Reabre um pedido (pendência ou aguardando) para ajustar e reenviar. */
  const abrirPedido = (p: PedidoLocal) => {
    const r = p.rascunho || {};
    setCliente(r.cliente || null);
    setItens(r.itens || []);
    setPag(r.pag || PAG_VAZIO);
    setObs(r.obs || '');
    setEditandoUuid(p.uuid);
    setEnvio(null);
    setEtapa('itens');
  };

  // ---------- próximo passo (botão do rodapé) ----------
  const proximo: { rotulo: string; acao: () => void; ativo: boolean } = (() => {
    if (etapa === 'cliente') return { rotulo: 'Itens', acao: () => setEtapa('itens'), ativo: !!cliente };
    if (etapa === 'itens') return { rotulo: 'Pagamento', acao: () => setEtapa('pagamento'), ativo: itens.length > 0 };
    if (etapa === 'pagamento') return { rotulo: 'Resumo', acao: () => setEtapa('resumo'), ativo: true };
    if (etapa === 'pedidos') return { rotulo: 'Nova venda', acao: novaVenda, ativo: true };
    return {
      rotulo: analise.precoAbaixo ? 'Enviar p/ análise' : online ? 'Enviar venda' : 'Guardar pedido',
      acao: enviar,
      ativo: analise.podeEnviar && !vencida,
    };
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
          <button onClick={onSair} className="p-1 text-blue-100" title="Sair" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
        <div className="text-xs text-blue-100 truncate">
          {sessao.nome} · {sessao.filial}
          {cliente ? ` · ${cliente.codcli} ${cliente.nomefant || cliente.nome}` : ''}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-blue-100 mt-0.5">
          {sincronizando ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> {sincronizando}
            </span>
          ) : (
            <span>{meta ? `Dados do aparelho: ${dataHora(meta.gerado_em)}` : 'Dados do aparelho: ainda não baixados'}</span>
          )}
          {online && !sincronizando && (
            <button onClick={onSincronizar} className="inline-flex items-center gap-1 underline">
              <RefreshCw size={12} /> atualizar
            </button>
          )}
        </div>
        {/* etapas */}
        <nav className="grid grid-cols-5 gap-1 mt-2">
          {ETAPAS.map(({ id, rotulo, Icone }) => {
            const ativo = etapa === id;
            const bloqueado = (id === 'itens' || id === 'pagamento' || id === 'resumo') && !cliente;
            return (
              <button
                key={id}
                disabled={bloqueado}
                onClick={() => setEtapa(id)}
                className={`relative flex flex-col items-center rounded-md py-1.5 text-[11px] ${
                  ativo ? 'bg-white text-[#1e3a5f] font-semibold' : 'text-blue-100'
                } disabled:opacity-40`}
              >
                <Icone size={18} />
                {rotulo}
                {id === 'itens' && itens.length > 0 ? ` (${itens.length})` : ''}
                {id === 'pedidos' && pendentes > 0 && (
                  <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4">
                    {pendentes}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-3 pb-36">
        {vencida && (
          <div className="mb-3 rounded-xl bg-red-50 border border-red-300 p-3 text-sm text-red-800">
            Sua sessão venceu (mais de 7 dias sem conectar). Dá para consultar, mas pedidos novos só depois de conectar e
            entrar de novo. Os pedidos guardados continuam no aparelho.
          </div>
        )}
        {!online && !meta && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-800">
            Sem internet e sem dados no aparelho. Conecte-se uma vez para baixar clientes, produtos e preços.
          </div>
        )}
        {editandoUuid && etapa !== 'pedidos' && (
          <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800 flex items-center gap-2">
            <Pencil size={14} /> Ajustando um pedido guardado. Ao enviar, ele substitui o anterior.
            <button onClick={novaVenda} className="ml-auto underline">
              cancelar
            </button>
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
          <>
            <EtapaResumo
              cliente={cliente}
              itens={itens}
              analise={analise}
              impostos={impostos}
              impostosPendentes={impostosPendentes && online}
              pag={pag}
            />
            {(!online || semImpostosCalculados) && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                Sem internet: IPI e ST são calculados no envio; o total final pode mudar. Estoque, preço e crédito também
                são conferidos de novo no envio.
              </div>
            )}
          </>
        )}
        {etapa === 'pedidos' && (
          <AbaPedidos
            pedidos={pedidos}
            online={online}
            vencida={vencida}
            onAbrir={abrirPedido}
            onEnviar={async (p) => {
              await enviarPedido(sessao, p.uuid);
            }}
            onExcluir={async (p) => {
              if (window.confirm(`Excluir o pedido ${p.numero_local} (${p.cliente_nome})? Ele não foi enviado.`)) {
                await excluirPedido(p.uuid);
              }
            }}
          />
        )}
      </main>

      {/* rodapé fixo: total + próximo */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="max-w-3xl mx-auto">
          {analise.impedimento && etapa !== 'cliente' && etapa !== 'pedidos' && (
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
            {envio.fase === 'guardado' && <Clock className="w-12 h-12 mx-auto text-blue-600" />}
            {(envio.fase === 'erro' || envio.fase === 'pendencia') && <AlertTriangle className="w-12 h-12 mx-auto text-red-600" />}
            {envio.nro && <div className="text-2xl font-bold mt-3">Nº {envio.nro}</div>}
            <p className="mt-2 text-sm whitespace-pre-line">{envio.msg}</p>
            {(envio.fase === 'ok' || envio.fase === 'guardado') && (
              <button onClick={novaVenda} className="mt-5 w-full rounded-xl bg-[#1e3a5f] text-white font-semibold py-3">
                Nova venda
              </button>
            )}
            {envio.fase === 'pendencia' && (
              <button onClick={() => setEnvio(null)} className="mt-5 w-full rounded-xl bg-[#1e3a5f] text-white font-semibold py-3">
                Ajustar o pedido
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

// ---------- Pedidos guardados no aparelho ----------
const ROTULO_SITUACAO: Record<string, { txt: string; cls: string }> = {
  AGUARDANDO: { txt: 'Aguardando envio', cls: 'bg-blue-100 text-blue-800' },
  ENVIANDO: { txt: 'Enviando…', cls: 'bg-blue-100 text-blue-800' },
  ENVIADO: { txt: 'Enviado', cls: 'bg-green-100 text-green-800' },
  PENDENCIA: { txt: 'Com pendência', cls: 'bg-red-100 text-red-800' },
  ERRO: { txt: 'Erro — tentará de novo', cls: 'bg-amber-100 text-amber-800' },
};

function AbaPedidos({
  pedidos,
  online,
  vencida,
  onAbrir,
  onEnviar,
  onExcluir,
}: {
  pedidos: PedidoLocal[];
  online: boolean;
  vencida: boolean;
  onAbrir: (p: PedidoLocal) => void;
  onEnviar: (p: PedidoLocal) => Promise<void>;
  onExcluir: (p: PedidoLocal) => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  if (pedidos.length === 0) {
    return <div className="text-center text-sm text-gray-500 py-10">Nenhum pedido feito neste aparelho.</div>;
  }
  return (
    <div className="space-y-2">
      {pedidos.map((p) => {
        const sit = ROTULO_SITUACAO[p.status] || ROTULO_SITUACAO.AGUARDANDO;
        const podeMexer = p.status === 'AGUARDANDO' || p.status === 'PENDENCIA' || p.status === 'ERRO';
        return (
          <Cartao key={p.uuid}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">
                    {p.status === 'ENVIADO' && p.nrovenda ? `Venda Nº ${p.nrovenda}` : p.numero_local}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${sit.cls}`}>{sit.txt}</span>
                </div>
                <div className="text-sm truncate">
                  {p.codcli} · {p.cliente_nome}
                </div>
                <div className="text-xs text-gray-500">
                  {dataHora(p.criado_em)} · {p.itens_count} {p.itens_count === 1 ? 'item' : 'itens'} · {brl(p.total)}
                </div>
                {p.mensagem && p.status !== 'ENVIADO' && <div className="text-xs text-red-700 mt-1">{p.mensagem}</div>}
                {p.mensagem && p.status === 'ENVIADO' && <div className="text-xs text-green-700 mt-1">{p.mensagem}</div>}
              </div>
            </div>
            {podeMexer && (
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => onAbrir(p)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-300"
                >
                  <Pencil size={13} /> Ajustar
                </button>
                {online && !vencida && (
                  <button
                    disabled={!!ocupado}
                    onClick={async () => {
                      setOcupado(p.uuid);
                      try {
                        await onEnviar(p);
                      } finally {
                        setOcupado(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white disabled:opacity-40"
                  >
                    {ocupado === p.uuid ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar
                  </button>
                )}
                <button
                  onClick={() => onExcluir(p)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-red-600 border border-red-200"
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            )}
          </Cartao>
        );
      })}
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
