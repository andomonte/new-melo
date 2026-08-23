import React, { useEffect, useState } from 'react';

/**
 * Overlay de acesso por filial (segredo compartilhado do setor).
 *
 * Usado nas telas soltas (Separação/Conferência/TV) para destravar ao abrir e
 * ao trocar de filial. Não é login pessoal — todos do setor sabem o código.
 * Se a filial não tiver código configurado, entra direto (sem pedir).
 *
 * Estilo autocontido (inline) para funcionar em qualquer tela.
 */
type FilialItem = { nome_filial: string; codigo_filial: number; exige_codigo: boolean };

interface Props {
  filiaisUrl: string;
  initialFilial?: string;
  titulo?: string;
  onUnlock: (filial: string) => void;
}

const C = {
  bg: 'rgba(10,16,22,0.94)',
  card: '#18232e',
  ink: '#e7eef4',
  muted: '#9fb0bf',
  line: '#33444f',
  panel: '#111a22',
  primary: '#2b558d',
  primary2: '#3d6cad',
  danger: '#e0664f',
};

export default function FilialGate({ filiaisUrl, initialFilial = 'MANAUS', titulo = 'Selecione a filial', onUnlock }: Props) {
  const [filiais, setFiliais] = useState<FilialItem[]>([]);
  const [filial, setFilial] = useState(initialFilial);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(filiaisUrl, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.filiais?.length) {
          setFiliais(d.filiais);
          setFilial((cur) => (d.filiais.some((f: FilialItem) => f.nome_filial === cur) ? cur : d.filiais[0].nome_filial));
        }
      })
      .catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atual = filiais.find((f) => f.nome_filial === filial);
  const exige = atual ? atual.exige_codigo : true; // enquanto carrega, assume que pode exigir

  async function entrar() {
    setErro('');
    setBusy(true);
    try {
      const r = await fetch('/api/filiais/validar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filial, codigo }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErro(d.error || 'Código da filial incorreto.');
        setBusy(false);
        return;
      }
      onUnlock(filial);
    } catch {
      setErro('Falha de conexão.');
      setBusy(false);
    }
  }

  const S: Record<string, React.CSSProperties> = {
    bg: { position: 'fixed', inset: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20, fontFamily: '"Barlow Semi Condensed","Segoe UI",system-ui,sans-serif' },
    card: { width: 440, maxWidth: '100%', background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 30, boxShadow: '0 20px 60px rgba(0,0,0,.5)', color: C.ink },
    brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
    t1: { fontWeight: 700, letterSpacing: '.14em', color: C.primary2, fontSize: 16 },
    h: { margin: '0 0 6px', fontSize: 26, fontWeight: 700 },
    sub: { margin: '0 0 22px', color: C.muted, fontSize: 14 },
    lbl: { display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 },
    inp: { width: '100%', height: 56, padding: '0 15px', borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 22, fontWeight: 600, outline: 'none', marginBottom: 16, textTransform: 'none' as const, fontFamily: '"IBM Plex Mono",monospace', letterSpacing: '.18em' },
    sel: { width: '100%', height: 56, padding: '0 12px', borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 20, fontWeight: 600, outline: 'none', marginBottom: 16, cursor: 'pointer' },
    erro: { minHeight: 20, color: C.danger, fontWeight: 600, fontSize: 13, margin: '2px 0 12px' },
    btn: { width: '100%', height: 58, borderRadius: 12, border: 'none', cursor: 'pointer', background: C.primary, color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '.02em' },
    dica: { fontSize: 13, color: C.muted, margin: '2px 0 14px' },
  };

  return (
    <div style={S.bg}>
      <div style={S.card}>
        <div style={S.brand}>
          <svg width={34} height={34} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 5 L43 40 H5 Z" fill="none" stroke={C.primary2} strokeWidth={3.4} strokeLinejoin="round" />
            <path d="M24 17 L33 34 H15 Z" fill={C.primary2} />
          </svg>
          <span style={S.t1}>MELO</span>
        </div>
        <h2 style={S.h}>{titulo}</h2>
        <p style={S.sub}>Escolha a filial e informe o código de acesso do setor para continuar.</p>

        <label>
          <span style={S.lbl}>Filial</span>
          <select
            style={S.sel}
            value={filial}
            onChange={(e) => { setFilial(e.target.value); setCodigo(''); setErro(''); }}
          >
            {(filiais.length ? filiais.map((f) => f.nome_filial) : [filial]).map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </label>

        {exige ? (
          <label>
            <span style={S.lbl}>Código da filial</span>
            <input
              style={S.inp}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={codigo}
              onChange={(e) => { setCodigo(e.target.value); setErro(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
              autoFocus
            />
          </label>
        ) : (
          <p style={S.dica}>Esta filial não exige código.</p>
        )}

        <div style={S.erro}>{erro}</div>
        <button style={S.btn} disabled={busy} onClick={entrar}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
