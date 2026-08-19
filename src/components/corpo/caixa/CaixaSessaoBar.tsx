import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Unlock, ArrowUp, ArrowDown, X } from 'lucide-react';
import { mascaraInputBRL, desmascarar, formatarBRL } from '@/utils/monetario';
import type { SessaoCaixaHook } from '@/hooks/useSessaoCaixa';
import type { FormaPagamentoSessao } from '@/data/caixa/sessao';
import { getRelatorio } from '@/data/caixa/sessao';

const FORMA_LABEL: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CREDITO: 'Cartão crédito', DEBITO: 'Cartão débito',
  PIX: 'PIX', CHEQUE: 'Cheque', OUTRO: 'Outro',
};

interface Props {
  s: SessaoCaixaHook;
  filial: string;
  codConta: string;
  operador: string;
}

/**
 * Barra de status do caixa + modais de abertura/sangria/suprimento/fechamento.
 * Encaixa no topo da tela do Caixa; NÃO altera o recebimento.
 */
export default function CaixaSessaoBar({ s, filial, codConta, operador }: Props) {
  const [modal, setModal] = useState<null | 'abrir' | 'sangria' | 'suprimento' | 'fechar'>(null);
  const [busy, setBusy] = useState(false);

  // form: abrir
  const [fundo, setFundo] = useState('200,00');
  const [obsAbrir, setObsAbrir] = useState('');
  // form: sangria/suprimento
  const [movValor, setMovValor] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  // form: fechamento
  const [espDinheiro, setEspDinheiro] = useState(0);
  const [espFormas, setEspFormas] = useState<{ forma_pagamento: FormaPagamentoSessao; esperado: number; informado: string }[]>([]);
  const [contado, setContado] = useState('');
  const [obsFechar, setObsFechar] = useState('');
  const [resultado, setResultado] = useState<{ quebra: number } | null>(null);

  const fechar = () => { setModal(null); setResultado(null); };

  // ---- Abrir ----
  const onAbrir = async () => {
    setBusy(true);
    try {
      await s.abrir(desmascarar(fundo), obsAbrir.trim() || undefined);
      toast.success('Caixa aberto.');
      fechar();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir caixa.');
    } finally { setBusy(false); }
  };

  // ---- Sangria / Suprimento ----
  const abrirMov = (tipo: 'sangria' | 'suprimento') => { setMovValor(''); setMovMotivo(''); setModal(tipo); };
  const onMov = async () => {
    const valor = desmascarar(movValor);
    if (valor <= 0) return toast.error('Valor deve ser positivo.');
    if (!movMotivo.trim()) return toast.error('Informe o motivo.');
    setBusy(true);
    try {
      if (modal === 'sangria') await s.sangria(valor, movMotivo.trim());
      else await s.suprimento(valor, movMotivo.trim());
      toast.success(modal === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.');
      fechar();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar.');
    } finally { setBusy(false); }
  };

  // ---- Fechamento ----
  const abrirFechar = async () => {
    setBusy(true);
    try {
      setResultado(null);
      if (s.aberto) {
        const r = await s.iniciarFechamento();
        setEspDinheiro(r?.saldoEsperadoDinheiro ?? 0);
        setEspFormas((r?.esperadoPorForma ?? []).map((f) => ({ forma_pagamento: f.forma_pagamento, esperado: f.liquido, informado: formatarBRL(f.liquido).replace('R$', '').trim() })));
        setContado(formatarBRL(r?.saldoEsperadoDinheiro ?? 0).replace('R$', '').trim());
      } else if (s.emFechamento && s.sessao) {
        // retomar: carrega esperado do relatório
        const rel = await getRelatorio(s.sessao.id, filial);
        setEspDinheiro(Number(s.sessao.saldo_esperado_dinheiro ?? rel.saldo_esperado_dinheiro ?? 0));
        setEspFormas((rel.conferencia_formas ?? []).map((f: any) => ({ forma_pagamento: f.forma_pagamento, esperado: Number(f.valor_esperado), informado: formatarBRL(Number(f.valor_esperado)).replace('R$', '').trim() })));
        setContado(formatarBRL(Number(s.sessao.saldo_esperado_dinheiro ?? 0)).replace('R$', '').trim());
      }
      setModal('fechar');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar fechamento.');
    } finally { setBusy(false); }
  };

  const quebraPrevia = desmascarar(contado) - espDinheiro;

  const onConfirmarFechar = async () => {
    setBusy(true);
    try {
      const r = await s.confirmarFechamento(
        desmascarar(contado),
        espFormas.map((f) => ({ forma_pagamento: f.forma_pagamento, valor_informado: desmascarar(f.informado) })),
        obsFechar.trim() || undefined,
      );
      setResultado({ quebra: r?.quebra ?? 0 });
      toast.success('Caixa fechado.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao confirmar fechamento.');
    } finally { setBusy(false); }
  };

  const onCancelarFechar = async () => {
    setBusy(true);
    try { await s.cancelarFechamento(); toast.info('Fechamento cancelado.'); fechar(); }
    catch (e: any) { toast.error(e.message || 'Erro.'); }
    finally { setBusy(false); }
  };

  // ---- pill de situação ----
  const situacao = s.aberto
    ? { txt: 'ABERTO', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-500' }
    : s.emFechamento
    ? { txt: 'EM FECHAMENTO', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700', dot: 'bg-amber-500' }
    : { txt: 'FECHADO', cls: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600', dot: 'bg-gray-400' };

  const mostraSaldo = s.aberto || s.emFechamento;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm px-4 py-3 mb-4 flex items-center gap-6 flex-wrap">
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: s.aberto ? '#10b981' : s.emFechamento ? '#f59e0b' : '#9ca3af' }}
        />
        <Bloco label="Caixa"><span className="font-mono tabular-nums">{codConta || '—'}</span></Bloco>
        <Bloco label="Operador">{operador || '—'}</Bloco>
        <Bloco label="Situação">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${situacao.cls}`}>
            <span className={`w-2 h-2 rounded-full ${situacao.dot}`} /> {situacao.txt}
          </span>
        </Bloco>

        {mostraSaldo && (
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Dinheiro na gaveta</div>
            <div className="text-2xl font-semibold font-mono tabular-nums">{formatarBRL(s.saldoDinheiro)}</div>
          </div>
        )}

        <div className={`flex items-center gap-2 flex-wrap ${mostraSaldo ? '' : 'ml-auto'}`}>
          {!s.pronto ? (
            <span className="text-xs text-amber-600">Configure a conta do operador no cadastro.</span>
          ) : s.aberto ? (
            <>
              <Btn onClick={() => abrirMov('suprimento')}><ArrowDown size={15} /> Suprimento</Btn>
              <Btn onClick={() => abrirMov('sangria')}><ArrowUp size={15} /> Sangria</Btn>
              <Btn danger onClick={abrirFechar} disabled={busy}><Lock size={15} /> Fechar caixa</Btn>
            </>
          ) : s.emFechamento ? (
            <>
              <Btn onClick={abrirFechar} disabled={busy}>Continuar fechamento</Btn>
              <Btn onClick={onCancelarFechar} disabled={busy}>Cancelar</Btn>
            </>
          ) : (
            <Btn ok onClick={() => { setFundo('200,00'); setObsAbrir(''); setModal('abrir'); }}>
              <Unlock size={15} /> Abrir caixa
            </Btn>
          )}
        </div>
      </div>

      {/* MODAL ABRIR */}
      {modal === 'abrir' && (
        <Modal titulo="Abrir caixa" icone={<Unlock size={18} />} onClose={fechar}>
          <p className="text-sm text-gray-500">
            Conta <b className="font-mono">{codConta}</b> · Operador <b>{operador}</b>
          </p>
          <Campo label="Fundo de troco (dinheiro na gaveta)">
            <input className="input-money" value={fundo} onChange={(e) => setFundo(mascaraInputBRL(e.target.value))} />
          </Campo>
          <Campo label="Observação (opcional)">
            <textarea className="fld" rows={2} value={obsAbrir} onChange={(e) => setObsAbrir(e.target.value)} placeholder="Ex.: início do turno" />
          </Campo>
          <Rodape>
            <Btn onClick={fechar}>Cancelar</Btn>
            <Btn ok onClick={onAbrir} disabled={busy}>Abrir caixa</Btn>
          </Rodape>
        </Modal>
      )}

      {/* MODAL SANGRIA / SUPRIMENTO */}
      {(modal === 'sangria' || modal === 'suprimento') && (
        <Modal
          titulo={modal === 'sangria' ? 'Sangria (retirada)' : 'Suprimento (reforço)'}
          icone={modal === 'sangria' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
          onClose={fechar}
        >
          <p className="text-sm text-gray-500">
            {modal === 'sangria'
              ? `Retirada de dinheiro — não pode passar do saldo (${formatarBRL(s.saldoDinheiro)}).`
              : 'Entrada de dinheiro que não é recebimento (reforço de troco).'}
          </p>
          <Campo label="Valor (R$)">
            <input className="input-money" value={movValor} onChange={(e) => setMovValor(mascaraInputBRL(e.target.value))} />
          </Campo>
          <Campo label="Motivo *">
            <input className="fld" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} placeholder="Ex.: retirada para o cofre" />
          </Campo>
          <Rodape>
            <Btn onClick={fechar}>Cancelar</Btn>
            <Btn ok onClick={onMov} disabled={busy}>Confirmar</Btn>
          </Rodape>
        </Modal>
      )}

      {/* MODAL FECHAMENTO */}
      {modal === 'fechar' && (
        <Modal
          titulo="Fechar caixa · conferência"
          icone={<Lock size={18} />}
          onClose={resultado ? fechar : onCancelarFechar}
          wide
        >
          {resultado ? (
            <>
              <div className={`rounded-xl p-4 text-center border ${resultado.quebra === 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
                <div className={`text-[11px] uppercase tracking-wide font-semibold ${resultado.quebra === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {resultado.quebra === 0 ? 'Caixa confere' : resultado.quebra > 0 ? 'Sobra' : 'Falta'}
                </div>
                <div className={`text-3xl font-semibold font-mono ${resultado.quebra === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {resultado.quebra > 0 ? '+' : ''}{formatarBRL(resultado.quebra)}
                </div>
                <div className="text-xs text-gray-500 mt-1">esperado {formatarBRL(espDinheiro)} · contado {formatarBRL(desmascarar(contado))}</div>
              </div>
              <Rodape><Btn ok onClick={fechar}>Concluir</Btn></Rodape>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Confira o dinheiro contado e os valores por forma. O sistema calcula a diferença (quebra).</p>
              {espFormas.length > 0 && (
                <div className="border-t border-b border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800">
                  {espFormas.map((f, i) => (
                    <div key={f.forma_pagamento} className="grid grid-cols-[1fr_auto_120px] gap-3 items-center py-2">
                      <div>
                        <div className="font-semibold text-sm">{FORMA_LABEL[f.forma_pagamento] || f.forma_pagamento}</div>
                        <div className="text-xs text-gray-500">Esperado: {formatarBRL(f.esperado)}</div>
                      </div>
                      <span className="text-xs text-gray-400">contado</span>
                      <input
                        className="input-money !text-base"
                        value={f.informado}
                        onChange={(e) => setEspFormas((prev) => prev.map((x, j) => (j === i ? { ...x, informado: mascaraInputBRL(e.target.value) } : x)))}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Campo label="Dinheiro contado na gaveta (R$)">
                <input className="input-money" value={contado} onChange={(e) => setContado(mascaraInputBRL(e.target.value))} />
              </Campo>
              <div className={`rounded-xl p-3 text-center border ${quebraPrevia === 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
                <span className={`text-[11px] uppercase tracking-wide font-semibold ${quebraPrevia === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {quebraPrevia === 0 ? 'Caixa confere' : quebraPrevia > 0 ? 'Sobra' : 'Falta'}:
                </span>{' '}
                <span className={`font-mono font-semibold ${quebraPrevia === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {quebraPrevia > 0 ? '+' : ''}{formatarBRL(quebraPrevia)}
                </span>
              </div>
              <Campo label="Observação (opcional)">
                <input className="fld" value={obsFechar} onChange={(e) => setObsFechar(e.target.value)} />
              </Campo>
              <Rodape>
                <Btn onClick={onCancelarFechar} disabled={busy}>Cancelar</Btn>
                <Btn danger onClick={onConfirmarFechar} disabled={busy}>Confirmar fechamento</Btn>
              </Rodape>
            </>
          )}
        </Modal>
      )}

      <style jsx>{`
        :global(.fld) { width:100%; padding:9px 11px; border-radius:8px; border:1px solid #cfd7e3; background:#fff; font:inherit; }
        :global(.dark .fld) { background:#0f172a; border-color:#334155; color:#e2e8f0; }
        :global(.input-money) { width:100%; padding:11px 13px; border-radius:8px; border:1px solid #cfd7e3; background:#fff; font-family:ui-monospace,monospace; font-size:20px; font-weight:600; text-align:right; }
        :global(.dark .input-money) { background:#0f172a; border-color:#334155; color:#e2e8f0; }
      `}</style>
    </>
  );
}

function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

function Btn({ children, onClick, ok, danger, disabled }: { children: React.ReactNode; onClick?: () => void; ok?: boolean; danger?: boolean; disabled?: boolean }) {
  const base = 'inline-flex items-center gap-1.5 font-semibold text-sm rounded-lg px-3.5 py-2 border transition disabled:opacity-50 disabled:cursor-not-allowed';
  const cls = ok
    ? 'bg-emerald-600 border-emerald-600 text-white hover:brightness-105'
    : danger
    ? 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
    : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600';
  return <button className={`${base} ${cls}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Modal({ titulo, icone, children, onClose, wide }: { titulo: string; icone: React.ReactNode; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      {/* Sem fechar ao clicar fora: sair só pelo Cancelar ou pelo X (ação financeira) */}
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden`}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          {icone}
          <span className="font-bold">{titulo}</span>
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3.5">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Rodape({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2.5 pt-1">{children}</div>;
}
