import React, { useCallback, useEffect, useRef, useState } from 'react';
import FilialGate from '@/components/common/FilialGate';

/**
 * ESTAÇÃO DE SEPARAÇÃO — tela standalone (fora do menu), pensada para um
 * computador compartilhado no balcão. O separador se identifica só pelo
 * CÓDIGO de acesso (mascarado) e informa o Nº do pedido (nrovenda).
 *
 * - Iniciar: código + pedido
 * - Finalizar: código → mostra a separação em aberto → finalizar
 * - Primeiro acesso (código == matrícula): força criar código pessoal
 * - Painel ao vivo: todas em separação + finalizadas hoje (colapsável)
 *
 * Backend: /api/separacao/estacao/{identificar,iniciar,finalizar,lista,criar-codigo}
 * Estado gravado em dbvenda (statuspedido 1→2→3), igual ao módulo atual.
 */

type Func = { matricula: string; nome: string };
type Ativa = { codvenda: string; nrovenda: string; inicioseparacao: string } | null;
type EmSep = { codvenda: string; nrovenda: string; inicioseparacao: string; nome: string };
type Fin = { codvenda: string; nrovenda: string; inicioseparacao: string; fimseparacao: string; nome: string };

const API = '/api/separacao/estacao';

function two(n: number) { return (n < 10 ? '0' : '') + n; }
function parseTs(s: string): number {
  if (!s) return Date.now();
  // timestamp sem tz vem como "YYYY-MM-DD HH:mm:ss(.sss)" → trata como local
  const iso = s.replace(' ', 'T');
  const t = new Date(iso).getTime();
  return isNaN(t) ? Date.now() : t;
}
function hhmm(s: string) { const d = new Date(parseTs(s)); return two(d.getHours()) + ':' + two(d.getMinutes()); }
function durTxt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h > 0 ? h + 'h ' + two(m % 60) + 'm' : m + 'm ' + two(s % 60) + 's';
}

const noUpper = { textTransform: 'none' as const };

export default function SeparacaoEstacao() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [now, setNow] = useState(Date.now());

  // filial (sem login) — destravada pelo código da filial (gate)
  const [filial, setFilial] = useState('MANAUS');
  const [locked, setLocked] = useState(true);
  const onUnlockFilial = (f: string) => {
    setFilial(f);
    try { sessionStorage.setItem('gate_sep_filial', f); } catch { /* ignore */ }
    setLocked(false);
  };
  const trocarFilial = () => {
    try { sessionStorage.removeItem('gate_sep_filial'); } catch { /* ignore */ }
    setLocked(true);
  };

  // iniciar
  const [matIni, setMatIni] = useState('');
  const [codIni, setCodIni] = useState('');
  const [pedIni, setPedIni] = useState('');
  const [busyIni, setBusyIni] = useState(false);

  // finalizar
  const [matFin, setMatFin] = useState('');
  const [codFin, setCodFin] = useState('');
  const [busca, setBusca] = useState<{ nome: string; ativa: Ativa } | null>(null);
  const [buscaMsg, setBuscaMsg] = useState('');
  const [busyFin, setBusyFin] = useState(false);

  // listas
  const [emSep, setEmSep] = useState<EmSep[]>([]);
  const [finalizadas, setFinalizadas] = useState<Fin[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);

  // modal primeiro acesso
  const [modal, setModal] = useState<null | (Func & { novo: string; conf: string; msg: string })>(null);

  // toast
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // tema inicial + filial já destravada nesta sessão
  useEffect(() => {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    } catch { /* ignore */ }
    try {
      const f = sessionStorage.getItem('gate_sep_filial');
      if (f) { setFilial(f); setLocked(false); }
    } catch { /* ignore */ }
  }, []);

  // relógio + tempo decorrido
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // polling do painel ao vivo
  const carregarLista = useCallback(async () => {
    try {
      const r = await fetch(`${API}/lista?filial=${encodeURIComponent(filial)}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setEmSep(d.emSeparacao || []);
      setFinalizadas(d.finalizadas || []);
    } catch { /* silencioso */ }
  }, [filial]);
  useEffect(() => {
    if (locked) return;
    carregarLista();
    const t = setInterval(carregarLista, 4000);
    return () => clearInterval(t);
  }, [carregarLista, locked]);

  // ---- iniciar ----
  const hintIni = (() => {
    // dica leve; a validação real é no servidor
    if (!codIni.trim()) return null;
    return null;
  })();

  async function onIniciar() {
    const matricula = matIni.trim(), codigo = codIni.trim(), nroPedido = pedIni.trim();
    if (!matricula) { showToast('Informe a matrícula.', true); return; }
    if (!codigo) { showToast('Informe o código de acesso.', true); return; }
    if (!nroPedido) { showToast('Informe o número do pedido.', true); return; }
    setBusyIni(true);
    try {
      const r = await fetch(`${API}/iniciar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, codigo, nroPedido, filial }),
      });
      const d = await r.json();
      if (d.code === 'PRIMEIRO_ACESSO') { abrirModal(d); return; }
      if (!r.ok) { showToast(d.error || 'Não foi possível iniciar.', true); return; }
      showToast(`${String(d.data.nome).split(' ')[0]} iniciou o pedido ${d.data.nrovenda}`);
      setMatIni(''); setCodIni(''); setPedIni('');
      carregarLista();
    } catch { showToast('Falha de conexão.', true); }
    finally { setBusyIni(false); }
  }

  // ---- finalizar (buscar por código) ----
  async function onBuscar() {
    const matricula = matFin.trim(), codigo = codFin.trim();
    setBusca(null); setBuscaMsg('');
    if (!matricula) { setBuscaMsg('Informe a matrícula.'); return; }
    setBusyFin(true);
    try {
      const r = await fetch(`${API}/identificar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, codigo, filial }),
      });
      const d = await r.json();
      if (d.primeiroAcesso) { abrirModal(d); return; }
      if (!r.ok) { setBuscaMsg(d.error || 'Não foi possível identificar.'); return; }
      if (!d.ativa) { setBuscaMsg(`Nenhuma separação em aberto para ${String(d.nome).split(' ')[0]}.`); return; }
      setBusca({ nome: d.nome, ativa: d.ativa });
    } catch { setBuscaMsg('Falha de conexão.'); }
    finally { setBusyFin(false); }
  }

  async function onFinalizar(codvenda: string) {
    const matricula = matFin.trim(), codigo = codFin.trim();
    setBusyFin(true);
    try {
      const r = await fetch(`${API}/finalizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, codigo, codvenda, filial }),
      });
      const d = await r.json();
      if (d.code === 'PRIMEIRO_ACESSO') { abrirModal(d); return; }
      if (!r.ok) { showToast(d.error || 'Não foi possível finalizar.', true); return; }
      showToast(`${String(d.data.nome).split(' ')[0]} finalizou o pedido ${d.data.nrovenda} (${durTxt(parseTs(d.data.fimseparacao) - parseTs(d.data.inicioseparacao))})`);
      // limpar matrícula/código digitados para busca após finalizar
      setMatFin(''); setCodFin(''); setBusca(null); setBuscaMsg('');
      carregarLista();
    } catch { showToast('Falha de conexão.', true); }
    finally { setBusyFin(false); }
  }

  // ---- modal primeiro acesso ----
  function abrirModal(f: Func) { setModal({ matricula: f.matricula, nome: f.nome, novo: '', conf: '', msg: '' }); }
  async function salvarCodigo() {
    if (!modal) return;
    const novo = modal.novo.trim(), conf = modal.conf.trim();
    if (novo.length < 4) { setModal({ ...modal, msg: 'O código deve ter ao menos 4 dígitos.' }); return; }
    if (novo === modal.matricula) { setModal({ ...modal, msg: 'O código não pode ser igual à matrícula.' }); return; }
    if (novo !== conf) { setModal({ ...modal, msg: 'Os códigos não conferem.' }); return; }
    try {
      const r = await fetch(`${API}/criar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: modal.matricula, novoCodigo: novo, filial }),
      });
      const d = await r.json();
      if (!r.ok) { setModal({ ...modal, msg: d.error || 'Não foi possível salvar.' }); return; }
      const nome = String(modal.nome).split(' ')[0];
      setModal(null);
      setCodIni(''); setCodFin(''); setBusca(null); setBuscaMsg('');
      showToast(`Código de acesso criado para ${nome}. Agora digite o novo código.`);
    } catch { setModal({ ...modal, msg: 'Falha de conexão.' }); }
  }

  return (
    <div className="sepk" data-theme={theme}>
      <div className="wrap">
        <header className="bar">
          <div className="brand">
            <svg className="logo" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 5 L43 40 H5 Z" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
              <path d="M24 17 L33 34 H15 Z" fill="currentColor" />
            </svg>
            <div>
              <div className="t1">MELO</div>
              <div className="t2">Distribuidora de Peças</div>
            </div>
          </div>
          <div className="htitle">Separação de Pedidos</div>
          <div className="spacer" />
          <span className="chip"><span className="dot" />{filial}</span>
          <button className="trocar-filial" onClick={trocarFilial} title="Trocar filial (pede o código)">Trocar filial</button>
          <span className="clock">{new Date(now).toLocaleTimeString('pt-BR')}</span>
          <button className="iconbtn" title="Alternar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>◐</button>
        </header>

        <div className="grid">
          {/* INICIAR */}
          <div className="card start a-iniciar">
            <h2><span className="badge-n">1</span>Iniciar Separação</h2>
            <p className="sub">Informe sua matrícula, o código de acesso e o número do pedido que você pegou.</p>
            <label className="fld">
              <span className="lbl">Matrícula</span>
              <input className="inp" style={noUpper} inputMode="numeric" autoComplete="off"
                placeholder="000000" maxLength={10} value={matIni}
                onChange={(e) => setMatIni(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('codIni') as HTMLInputElement)?.focus(); }} />
            </label>
            <label className="fld">
              <span className="lbl">Código de acesso</span>
              <input id="codIni" className="inp" style={noUpper} type="password" inputMode="numeric" autoComplete="off"
                placeholder="••••" maxLength={8} value={codIni}
                onChange={(e) => setCodIni(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('pedIni') as HTMLInputElement)?.focus(); }} />
            </label>
            <label className="fld">
              <span className="lbl">Número do pedido</span>
              <input id="pedIni" className="inp" style={noUpper} inputMode="numeric" autoComplete="off"
                placeholder="000000" maxLength={9} value={pedIni}
                onChange={(e) => setPedIni(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onIniciar(); }} />
            </label>
            <button className="btn green" disabled={busyIni} onClick={onIniciar}>▶ {busyIni ? 'Iniciando…' : 'Iniciar Separação'}</button>
          </div>

          {/* FINALIZAR */}
          <div className="card finish a-finalizar">
            <h2><span className="badge-n">2</span>Finalizar Separação</h2>
            <p className="sub">Voltou com o pedido? Informe matrícula e código para ver sua separação em aberto.</p>
            <label className="fld">
              <span className="lbl">Matrícula</span>
              <input className="inp" style={noUpper} inputMode="numeric" autoComplete="off"
                placeholder="000000" maxLength={10} value={matFin}
                onChange={(e) => { setMatFin(e.target.value); setBusca(null); setBuscaMsg(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('codFin') as HTMLInputElement)?.focus(); }} />
            </label>
            <label className="fld">
              <span className="lbl">Código de acesso</span>
              <input id="codFin" className="inp" style={noUpper} type="password" inputMode="numeric" autoComplete="off"
                placeholder="••••" maxLength={8} value={codFin}
                onChange={(e) => { setCodFin(e.target.value); setBusca(null); setBuscaMsg(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') onBuscar(); }} />
            </label>
            <button className="btn blue" disabled={busyFin} onClick={onBuscar}>🔍 {busyFin ? 'Buscando…' : 'Buscar minha separação'}</button>
            <div className="results">
              {buscaMsg && <div className="res-empty">{buscaMsg}</div>}
              {busca?.ativa && (
                <div className="res-row">
                  <div>
                    <div className="ped mono">{busca.ativa.nrovenda}</div>
                    <div className="meta">Início {hhmm(busca.ativa.inicioseparacao)} · {durTxt(now - parseTs(busca.ativa.inicioseparacao))}</div>
                  </div>
                  <div className="grow" />
                  <button className="btn-fin" disabled={busyFin} onClick={() => onFinalizar(busca.ativa!.codvenda)}>✓ Finalizar</button>
                </div>
              )}
            </div>
          </div>

          {/* EM SEPARAÇÃO · 3ª coluna, toda a vertical */}
          <div className="card panelcard a-emsep">
            <div className="panel-head">
              <h2>Em separação agora</h2>
              <span className="count-pill">{emSep.length}</span>
            </div>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Separador</th><th>Pedido</th><th>Início</th><th>Tempo</th><th>Status</th></tr></thead>
                <tbody>
                  {emSep.length === 0 ? (
                    <tr className="empty-row"><td colSpan={5}>Nenhuma separação em andamento.</td></tr>
                  ) : emSep.map((r) => (
                    <tr className="prog" key={r.codvenda}>
                      <td className="sep-name">{r.nome}</td>
                      <td className="ped-cell">{r.nrovenda}</td>
                      <td className="t-num">{hhmm(r.inicioseparacao)}</td>
                      <td className="t-num">{durTxt(now - parseTs(r.inicioseparacao))}</td>
                      <td><span className="stdot"><span className="dot" />EM SEPARAÇÃO</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINALIZADAS HOJE · abaixo das duas colunas, colapsada */}
          <div className={'done-block a-done' + (doneOpen ? ' open' : '')}>
            <button className="done-toggle" onClick={() => setDoneOpen(!doneOpen)}>
              Finalizadas hoje <span className="count-pill done">{finalizadas.length}</span>
              <span className="caret">▼</span>
            </button>
            <div className="done-panel">
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Separador</th><th>Pedido</th><th>Início</th><th>Fim</th><th>Duração</th><th>Status</th></tr></thead>
                  <tbody>
                    {finalizadas.length === 0 ? (
                      <tr className="empty-row"><td colSpan={6}>Nenhuma finalizada hoje.</td></tr>
                    ) : finalizadas.map((r) => (
                      <tr key={r.codvenda}>
                        <td className="sep-name">{r.nome}</td>
                        <td className="ped-cell">{r.nrovenda}</td>
                        <td className="t-num">{hhmm(r.inicioseparacao)}</td>
                        <td className="t-num">{hhmm(r.fimseparacao)}</td>
                        <td className="t-num">{durTxt(parseTs(r.fimseparacao) - parseTs(r.inicioseparacao))}</td>
                        <td><span className="st-done">✓ Finalizada</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL primeiro acesso */}
      {modal && (
        <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="lock">🔒</div>
            <h3>Primeiro acesso</h3>
            <p>Olá, <b>{String(modal.nome).split(' ')[0]}</b>. Seu código ainda é igual à sua matrícula. Por segurança, crie um código pessoal para continuar.</p>
            <label className="fld"><span className="lbl">Novo código de acesso</span>
              <input className="inp" style={noUpper} type="password" inputMode="numeric" autoComplete="off" placeholder="••••" maxLength={8}
                value={modal.novo} onChange={(e) => setModal({ ...modal, novo: e.target.value, msg: '' })} /></label>
            <label className="fld"><span className="lbl">Confirmar código</span>
              <input className="inp" style={noUpper} type="password" inputMode="numeric" autoComplete="off" placeholder="••••" maxLength={8}
                value={modal.conf} onChange={(e) => setModal({ ...modal, conf: e.target.value, msg: '' })}
                onKeyDown={(e) => { if (e.key === 'Enter') salvarCodigo(); }} /></label>
            <div className="mc-msg">{modal.msg}</div>
            <div className="mc-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn green" onClick={salvarCodigo}>Salvar e continuar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.err ? ' err' : '')}>{toast.msg}</div>}

      {locked && (
        <FilialGate
          filiaisUrl="/api/separacao/estacao/filiais"
          initialFilial={filial}
          titulo="Estação de Separação"
          onUnlock={onUnlockFilial}
        />
      )}

      <style jsx global>{`
        .sepk{ --bg:#e9eef3; --panel:#f7f9fb; --surface:#fff; --ink:#16222e; --muted:#5c6b7a; --faint:#8595a4;
          --line:#d3dce4; --line-strong:#bcc9d4; --primary:#2b558d; --primary-600:#1f4272; --primary-tint:#e8eff8;
          --start:#1d7a4d; --start-600:#166139; --start-tint:#e2f2ea; --amber:#b5730b; --amber-tint:#fbefdb;
          --danger:#b5321f; --shadow:0 1px 2px rgba(20,34,46,.06),0 6px 20px rgba(20,34,46,.06); --radius:14px;
          min-height:100vh; background:var(--bg); color:var(--ink);
          font-family:"Barlow","Segoe UI",system-ui,sans-serif; }
        .sepk[data-theme="dark"]{ --bg:#0e151c; --panel:#141d26; --surface:#18232e; --ink:#e7eef4; --muted:#9fb0bf;
          --faint:#6f8291; --line:#26333f; --line-strong:#33444f; --primary:#5b93d6; --primary-600:#7aabe6;
          --primary-tint:#17293c; --start:#3fb37a; --start-600:#5ac492; --start-tint:#123024; --amber:#e6a94b;
          --amber-tint:#33280f; --danger:#e0664f; --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 26px rgba(0,0,0,.35); }
        .sepk *{ box-sizing:border-box; }
        .sepk .mono,.sepk .ped-cell,.sepk .inp,.sepk .clock,.sepk .t-num{ font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums; }
        .sepk .wrap{ max-width:1720px; margin:0 auto; padding:16px 22px 40px; }
        .sepk .bar{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:14px 20px;
          background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); }
        .sepk .brand{ display:flex; align-items:center; gap:11px; }
        .sepk .logo{ width:38px; height:38px; color:var(--primary); }
        .sepk .t1{ font-weight:700; font-size:15px; letter-spacing:.14em; line-height:1; color:var(--primary); }
        .sepk .t2{ font-size:12px; color:var(--muted); }
        .sepk .htitle{ font-size:26px; font-weight:700; margin-left:4px; }
        .sepk .spacer{ flex:1; }
        .sepk .chip{ display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border-radius:999px;
          background:var(--primary-tint); color:var(--primary-600); font-weight:600; font-size:13px; letter-spacing:.03em; }
        .sepk .chip .dot{ width:7px; height:7px; border-radius:50%; background:var(--primary); }
        .sepk .filsel{ display:inline-flex; align-items:center; gap:8px; padding:6px 10px 6px 12px; border-radius:999px;
          background:var(--primary-tint); border:1px solid transparent; }
        .sepk .filsel .dot{ width:7px; height:7px; border-radius:50%; background:var(--primary); }
        .sepk .filsel select{ border:none; background:transparent; color:var(--primary-600); font-weight:700; font-size:14px;
          letter-spacing:.03em; cursor:pointer; outline:none; font-family:inherit; padding-right:2px; }
        .sepk .filsel select option{ color:#16222e; }
        .sepk .trocar-filial{ height:34px; padding:0 12px; border-radius:9px; border:1px solid var(--line-strong);
          background:transparent; color:var(--muted); font-weight:600; font-size:13px; cursor:pointer;
          font-family:"Barlow Semi Condensed",sans-serif; letter-spacing:.02em; }
        .sepk .trocar-filial:hover{ color:var(--ink); border-color:var(--primary); }
        .sepk .clock{ font-size:20px; font-weight:600; }
        .sepk .iconbtn{ width:40px; height:40px; border-radius:10px; border:1px solid var(--line-strong);
          background:var(--surface); color:var(--muted); cursor:pointer; font-size:18px; }
        .sepk .iconbtn:hover{ color:var(--ink); border-color:var(--primary); }
        .sepk .grid{ display:grid; grid-template-columns:minmax(300px,1fr) minmax(300px,1fr) minmax(420px,1.3fr);
          grid-template-areas:"iniciar finalizar emsep" "done done emsep"; gap:18px; margin-top:18px; align-items:start; }
        .sepk .a-iniciar{ grid-area:iniciar; } .sepk .a-finalizar{ grid-area:finalizar; }
        .sepk .a-done{ grid-area:done; align-self:start; } .sepk .a-emsep{ grid-area:emsep; align-self:stretch; }
        @media (max-width:1080px){ .sepk .grid{ grid-template-columns:1fr; grid-template-areas:"iniciar" "finalizar" "emsep" "done"; } }
        .sepk .card{ background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:20px 20px 22px; }
        .sepk .card.start{ border-top:3px solid var(--start); } .sepk .card.finish{ border-top:3px solid var(--primary); }
        .sepk .card h2{ margin:0 0 3px; font-size:20px; font-weight:700; display:flex; align-items:center; gap:9px; }
        .sepk .card .sub{ margin:0 0 18px; color:var(--muted); font-size:13.5px; }
        .sepk .badge-n{ width:26px; height:26px; border-radius:8px; display:grid; place-items:center; font-size:14px; font-weight:700; color:#fff; }
        .sepk .start .badge-n{ background:var(--start); } .sepk .finish .badge-n{ background:var(--primary); }
        .sepk label.fld{ display:block; margin-bottom:15px; }
        .sepk .lbl{ display:block; font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
        .sepk .inp{ width:100%; height:56px; padding:0 15px; border-radius:11px; border:1.5px solid var(--line-strong);
          background:var(--panel); color:var(--ink); font-size:23px; font-weight:600; letter-spacing:.18em; outline:none; }
        .sepk .inp::placeholder{ color:var(--faint); font-weight:500; letter-spacing:.02em; }
        .sepk .inp:focus{ border-color:var(--primary); background:var(--surface); box-shadow:0 0 0 4px var(--primary-tint); }
        .sepk .btn{ width:100%; height:58px; border-radius:12px; border:none; cursor:pointer; font-size:20px; font-weight:700;
          letter-spacing:.02em; color:#fff; display:flex; align-items:center; justify-content:center; gap:9px; }
        .sepk .btn:disabled{ opacity:.6; cursor:default; }
        .sepk .btn.green{ background:var(--start); } .sepk .btn.blue{ background:var(--primary); }
        .sepk .results{ margin-top:14px; display:flex; flex-direction:column; gap:9px; }
        .sepk .res-empty{ font-size:14px; color:var(--muted); padding:13px; border:1px dashed var(--line-strong); border-radius:10px; text-align:center; }
        .sepk .res-row{ display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--line); border-radius:11px; background:var(--panel); }
        .sepk .res-row .ped{ font-size:20px; font-weight:600; } .sepk .res-row .meta{ font-size:12.5px; color:var(--muted); } .sepk .res-row .grow{ flex:1; }
        .sepk .btn-fin{ height:44px; padding:0 18px; border-radius:9px; border:none; cursor:pointer; background:var(--primary); color:#fff; font-weight:700; font-size:15px; }
        .sepk .panelcard{ display:flex; flex-direction:column; height:100%; min-height:520px; }
        .sepk .panelcard .tablewrap{ flex:1; overflow:auto; }
        .sepk .panel-head{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .sepk .panel-head h2{ margin:0; font-size:20px; font-weight:700; }
        .sepk .count-pill{ font-size:13px; font-weight:700; color:var(--amber); background:var(--amber-tint); padding:3px 10px; border-radius:999px; }
        .sepk .count-pill.done{ color:var(--start-600); background:var(--start-tint); }
        .sepk .tablewrap{ overflow-x:auto; }
        .sepk table{ width:100%; border-collapse:collapse; }
        .sepk thead th{ text-align:left; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); padding:8px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
        .sepk tbody td{ padding:11px 10px; border-bottom:1px solid var(--line); font-size:14px; white-space:nowrap; }
        .sepk tbody tr:last-child td{ border-bottom:none; }
        .sepk tbody tr.prog td:first-child{ border-left:3px solid var(--amber); }
        .sepk .sep-name{ font-weight:600; }
        .sepk .ped-cell{ font-weight:600; font-size:15.5px; }
        .sepk .t-num{ color:var(--muted); }
        .sepk .stdot{ display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:11.5px; color:var(--amber); }
        .sepk .stdot .dot{ width:8px; height:8px; border-radius:50%; background:var(--amber); animation:sepkpulse 1.4s infinite; }
        @keyframes sepkpulse{ 0%,100%{opacity:1} 50%{opacity:.3} }
        .sepk .empty-row td{ color:var(--muted); text-align:center; padding:24px; font-size:14px; border:none; }
        .sepk .done-block .done-toggle{ display:flex; align-items:center; gap:12px; width:100%; cursor:pointer;
          background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow);
          padding:15px 20px; color:var(--ink); font-size:19px; font-weight:700; }
        .sepk .done-block .done-toggle:hover{ border-color:var(--primary); }
        .sepk .done-block .caret{ margin-left:auto; color:var(--muted); font-size:14px; transition:.2s; }
        .sepk .done-block.open .caret{ transform:rotate(180deg); }
        .sepk .done-panel{ display:none; margin-top:12px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); }
        .sepk .done-block.open .done-panel{ display:block; }
        .sepk .done-panel thead th{ padding:14px 16px; } .sepk .done-panel tbody td{ padding:13px 16px; font-size:15px; }
        .sepk .st-done{ display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:12.5px; color:var(--start-600); background:var(--start-tint); padding:5px 11px; border-radius:999px; }
        .sepk .modal-bg{ position:fixed; inset:0; background:rgba(8,14,20,.58); display:flex; align-items:center; justify-content:center; z-index:60; padding:20px; }
        .sepk .modal{ background:var(--surface); border:1px solid var(--line); border-radius:16px; box-shadow:var(--shadow); padding:26px; width:430px; max-width:100%; }
        .sepk .modal .lock{ width:44px; height:44px; border-radius:12px; background:var(--start-tint); color:var(--start-600); display:grid; place-items:center; font-size:22px; margin-bottom:12px; }
        .sepk .modal h3{ margin:0 0 6px; font-size:22px; font-weight:700; }
        .sepk .modal p{ margin:0 0 18px; color:var(--muted); font-size:14px; } .sepk .modal p b{ color:var(--ink); }
        .sepk .mc-msg{ min-height:20px; color:var(--danger); font-weight:600; font-size:13px; margin:2px 0 10px; }
        .sepk .mc-actions{ display:flex; gap:10px; } .sepk .mc-actions .btn{ height:52px; font-size:17px; }
        .sepk .btn.ghost{ background:transparent; color:var(--muted); border:1.5px solid var(--line-strong); }
        .sepk .toast{ position:fixed; left:50%; bottom:26px; transform:translateX(-50%); background:var(--ink); color:var(--bg);
          padding:13px 20px; border-radius:11px; font-weight:600; font-size:15px; box-shadow:var(--shadow); z-index:70; max-width:90vw; text-align:center; }
        .sepk .toast.err{ background:var(--danger); color:#fff; }
      `}</style>
    </div>
  );
}
