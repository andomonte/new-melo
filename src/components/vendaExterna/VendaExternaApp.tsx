/**
 * Venda Externa — entrada do app (/externo/<codigo_filial>):
 *   sem sessão → login (usuário/senha do sistema) → cria PIN → app
 *   com sessão → PIN → app (funciona sem internet)
 * Com internet: renova o passe (7 dias), baixa o pacote (se não houver ou tiver mais de
 * 6 h) e envia a fila de pedidos. Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Lock, User, Eye, EyeOff } from 'lucide-react';
import VendaExterna, { useOnline } from './VendaExterna';
import {
  aplicarCookieFilial,
  conferirPin,
  definirPin,
  errosPin,
  estaDesbloqueado,
  lerSessao,
  MAX_ERROS_PIN,
  sairDaConta,
  sessaoVencida,
  type SessaoExterna,
} from '@/lib/vendaExterna/sessao';
import { entrar, renovar } from '@/lib/vendaExterna/autenticacao';
import { baixarPacote, metaDoPacote, type MetaPacote } from '@/lib/vendaExterna/sincronizar';
import { definirFilialLocal, limparCacheLocal } from '@/lib/vendaExterna/fonteLocal';
import { pedirArmazenamentoPersistente } from '@/lib/vendaExterna/idb';
import { enviarPendentes, listarPedidos } from '@/lib/vendaExterna/fila';

type Fase = 'carregando' | 'login' | 'criarPin' | 'pin' | 'app';
const PACOTE_VELHO_MS = 6 * 3600 * 1000;

export default function VendaExternaApp({ codigoFilial }: { codigoFilial: number }) {
  const online = useOnline();
  const [fase, setFase] = useState<Fase>('carregando');
  const [sessao, setSessao] = useState<SessaoExterna | null>(null);
  const [aviso, setAviso] = useState('');
  const [meta, setMeta] = useState<MetaPacote | null>(null);
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const iniciou = useRef(false);

  // ---------- abertura ----------
  useEffect(() => {
    const s = lerSessao();
    if (!s) return setFase('login');
    if (s.codigoFilial !== codigoFilial) {
      setAviso(`Este aparelho estava na filial ${s.filial}. Entre de novo para usar esta filial.`);
      return setFase('login');
    }
    setSessao(s);
    if (!s.pinHash) return setFase('criarPin');
    setFase(estaDesbloqueado() ? 'app' : 'pin');
  }, [codigoFilial]);

  // ---------- sincronização ----------
  const sincronizar = useCallback(async (s: SessaoExterna) => {
    if (!navigator.onLine || sessaoVencida(s)) return;
    setSincronizando('Atualizando dados…');
    try {
      const m = await baixarPacote(s, (txt) => setSincronizando(txt));
      limparCacheLocal();
      setMeta(m);
    } catch (e: any) {
      setSincronizando(null);
      setAviso(`Não foi possível atualizar os dados: ${e?.message || e}`);
      return;
    }
    setSincronizando(null);
  }, []);

  // ao entrar no app: renova passe, pacote e fila (com internet)
  useEffect(() => {
    if (fase !== 'app' || !sessao || iniciou.current) return;
    iniciou.current = true;
    aplicarCookieFilial(sessao.filial);
    definirFilialLocal(sessao.filial);
    pedirArmazenamentoPersistente();
    metaDoPacote().then((m) => setMeta(m || null));
    (async () => {
      if (!navigator.onLine) return;
      const r = await renovar(sessao);
      if (r === 'sair') {
        const pend = (await listarPedidos(sessao.login)).filter((p) => p.status !== 'ENVIADO').length;
        sairDaConta();
        setSessao(null);
        setAviso(
          `Seu acesso precisa ser renovado: entre de novo.${pend ? ` Seus ${pend} pedido(s) guardado(s) continuam no aparelho.` : ''}`,
        );
        setFase('login');
        return;
      }
      const atual = r || sessao;
      if (r) setSessao(r);
      const m = await metaDoPacote();
      if (!m || Date.now() - new Date(m.gerado_em).getTime() > PACOTE_VELHO_MS) await sincronizar(atual);
      enviarPendentes(atual);
    })();
  }, [fase, sessao, sincronizar]);

  // conexão voltou: renova e envia a fila
  useEffect(() => {
    if (fase !== 'app' || !sessao || !online) return;
    (async () => {
      const r = await renovar(sessao);
      const atual = r && r !== 'sair' ? r : sessao;
      if (r && r !== 'sair') setSessao(r);
      enviarPendentes(atual);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // tentativa periódica da fila (a cada 2 min, com internet)
  useEffect(() => {
    if (fase !== 'app' || !sessao) return;
    const t = setInterval(() => {
      if (navigator.onLine) enviarPendentes(sessao);
    }, 120000);
    return () => clearInterval(t);
  }, [fase, sessao]);

  const sair = async () => {
    if (!sessao) return;
    const pend = (await listarPedidos(sessao.login)).filter((p) => p.status !== 'ENVIADO').length;
    const msg = pend
      ? `Sair da conta? Você tem ${pend} pedido(s) não enviado(s); eles continuam guardados e serão enviados quando você entrar de novo.`
      : 'Sair da conta neste aparelho?';
    if (!window.confirm(msg)) return;
    sairDaConta();
    iniciou.current = false;
    setSessao(null);
    setFase('login');
  };

  if (fase === 'carregando') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (fase === 'login') {
    return (
      <TelaLogin
        codigoFilial={codigoFilial}
        online={online}
        aviso={aviso}
        onEntrou={(s) => {
          setAviso('');
          setSessao(s);
          iniciou.current = false;
          setFase(s.pinHash ? 'app' : 'criarPin');
        }}
      />
    );
  }

  if (fase === 'criarPin' && sessao) {
    return (
      <TelaPin
        modo="criar"
        nome={sessao.nome}
        onPronto={async (pin) => {
          const s = await definirPin(sessao, pin);
          setSessao(s);
          setFase('app');
          return true;
        }}
      />
    );
  }

  if (fase === 'pin' && sessao) {
    return (
      <TelaPin
        modo="desbloquear"
        nome={sessao.nome}
        onPronto={async (pin) => {
          const r = await conferirPin(sessao, pin);
          if (r === true) {
            setFase('app');
            return true;
          }
          if (r === 'saiu') {
            setSessao(null);
            setAviso(`PIN errado ${MAX_ERROS_PIN} vezes: por segurança, entre de novo com usuário e senha.`);
            setFase('login');
            return true;
          }
          return `PIN incorreto (${errosPin()} de ${MAX_ERROS_PIN} tentativas).`;
        }}
        onEsqueci={() => {
          sairDaConta();
          setSessao(null);
          setAviso('Entre com usuário e senha para criar um novo PIN.');
          setFase('login');
        }}
      />
    );
  }

  if (fase === 'app' && sessao) {
    return (
      <>
        {aviso && (
          <div className="fixed top-0 inset-x-0 z-40 bg-amber-100 text-amber-900 text-xs px-3 py-2 flex gap-2">
            <span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso('')} className="font-semibold">
              OK
            </button>
          </div>
        )}
        <VendaExterna
          sessao={sessao}
          meta={meta}
          sincronizando={sincronizando}
          onSincronizar={() => sincronizar(sessao)}
          onSair={sair}
        />
      </>
    );
  }
  return null;
}

// =====================================================================================
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#1e3a5f] p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <img src="/images/externo-icon-192.png" alt="" className="w-10 h-10 rounded-lg" />
          <div>
            <div className="font-bold text-gray-900 dark:text-white leading-tight">Venda Externa</div>
            <div className="text-xs text-gray-500">Melo Peças</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TelaLogin({
  codigoFilial,
  online,
  aviso,
  onEntrou,
}: {
  codigoFilial: number;
  online: boolean;
  aviso: string;
  onEntrou: (s: SessaoExterna) => void;
}) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!online) return setErro('Sem internet. O primeiro acesso (ou depois de sair) precisa de conexão.');
    if (!usuario.trim() || !senha) return setErro('Informe usuário e senha.');
    setOcupado(true);
    try {
      onEntrou(await entrar(usuario.trim(), senha, codigoFilial));
    } catch (er: any) {
      setErro(er?.message || 'Não foi possível entrar.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Moldura>
      <form onSubmit={enviar} className="space-y-3">
        {aviso && <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-2">{aviso}</div>}
        {!online && (
          <div className="text-xs rounded-lg bg-red-50 border border-red-200 text-red-700 p-2">
            Sem internet. Para entrar pela primeira vez neste aparelho é preciso estar conectado.
          </div>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Usuário</span>
          <div className="relative mt-1">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="username"
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Senha</span>
          <div className="relative mt-1">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={ver ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              className="w-full pl-9 pr-10 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
            >
              {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
        {erro && <div className="text-sm font-semibold text-red-600">{erro}</div>}
        <button
          type="submit"
          disabled={ocupado}
          className="w-full rounded-xl bg-[#1e3a5f] text-white font-semibold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
        <p className="text-[11px] text-gray-500 text-center">Mesmo usuário e senha do sistema.</p>
      </form>
    </Moldura>
  );
}

function TelaPin({
  modo,
  nome,
  onPronto,
  onEsqueci,
}: {
  modo: 'criar' | 'desbloquear';
  nome: string;
  onPronto: (pin: string) => Promise<true | string>;
  onEsqueci?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const titulo = modo === 'desbloquear' ? 'Digite seu PIN' : primeiro ? 'Confirme o PIN' : 'Crie um PIN de 4 dígitos';

  const concluir = async (valor: string) => {
    setErro('');
    if (modo === 'criar' && !primeiro) {
      setPrimeiro(valor);
      setPin('');
      return;
    }
    if (modo === 'criar' && primeiro !== valor) {
      setErro('Os PINs não conferem. Crie de novo.');
      setPrimeiro(null);
      setPin('');
      return;
    }
    setOcupado(true);
    const r = await onPronto(valor);
    setOcupado(false);
    if (r !== true) {
      setErro(r);
      setPin('');
    }
  };

  const tecla = (d: string) => {
    if (ocupado) return;
    if (d === '<') return setPin((p) => p.slice(0, -1));
    const novo = (pin + d).slice(0, 4);
    setPin(novo);
    if (novo.length === 4) setTimeout(() => concluir(novo), 120);
  };

  return (
    <Moldura>
      <div className="text-center">
        <div className="text-sm text-gray-500">{nome}</div>
        <div className="font-semibold text-gray-900 dark:text-white mt-1">{titulo}</div>
        {modo === 'criar' && !primeiro && (
          <p className="text-xs text-gray-500 mt-1">Ele desbloqueia o app neste aparelho, inclusive sem internet.</p>
        )}
        <div className="flex justify-center gap-3 my-5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-[#1e3a5f]' : 'bg-gray-200 dark:bg-zinc-700'}`} />
          ))}
        </div>
        {erro && <div className="text-sm font-semibold text-red-600 mb-3">{erro}</div>}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((d, i) =>
            d === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onClick={() => tecla(d)}
                className="h-14 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xl font-semibold active:bg-gray-200"
                aria-label={d === '<' ? 'Apagar' : d}
              >
                {d === '<' ? '⌫' : d}
              </button>
            ),
          )}
        </div>
        {ocupado && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-3 text-gray-400" />}
        {onEsqueci && (
          <button onClick={onEsqueci} className="mt-4 text-xs text-gray-500 underline">
            Esqueci o PIN (entrar com usuário e senha)
          </button>
        )}
      </div>
    </Moldura>
  );
}
