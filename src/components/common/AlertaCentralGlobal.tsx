/**
 * Alerta central global — padrão do sistema para mensagens de erro/atenção.
 *
 * Todo aviso de erro/atenção abre no meio da tela com botão OK, igual ao alerta da
 * Requisição de Compras (useConfirmarSalvar com somenteOk), em vez do aviso no canto:
 *  - toast({ variant: 'destructive', ... })      (hooks/use-toast)
 *  - toast.error(...) / toast.warning(...)      (sonner)
 * Avisos de sucesso/informação continuam no canto.
 *
 * Também pode ser chamado direto: mostrarAlerta({ titulo, mensagem, tipo }).
 * Montado uma única vez em pages/_app.tsx. Várias mensagens seguidas entram numa
 * fila (uma por vez); a mesma mensagem repetida não empilha.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { useToast } from '@/hooks/use-toast';

export interface AlertaCentral {
  titulo?: React.ReactNode;
  mensagem?: React.ReactNode;
  tipo?: 'warning' | 'danger';
}

type Item = AlertaCentral & { id: number; chave: string };

// ---------- fila (fora do React: pode ser chamada de qualquer lugar) ----------
let fila: Item[] = [];
let seq = 0;
const ouvintes = new Set<(f: Item[]) => void>();
const avisar = () => ouvintes.forEach((o) => o(fila));

const textoDe = (n: React.ReactNode): string =>
  n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : '[conteúdo]';

export function mostrarAlerta(a: AlertaCentral) {
  const chave = `${a.tipo || ''}|${textoDe(a.titulo)}|${textoDe(a.mensagem)}`;
  // mesma mensagem já na fila (ex.: erro repetido em sequência) → não empilha
  if (fila.some((i) => i.chave === chave)) return;
  fila = [...fila, { ...a, id: ++seq, chave }];
  avisar();
}

function fecharAtual() {
  fila = fila.slice(1);
  avisar();
}

// ---------- sonner: toast.error / toast.warning viram alerta central ----------
let sonnerDesviado = false;
function desviarSonner() {
  if (sonnerDesviado || typeof window === 'undefined') return;
  sonnerDesviado = true;
  const t = sonnerToast as any;
  const desvio = (tipo: 'danger' | 'warning') => (mensagem: React.ReactNode, data?: any) => {
    const desc = data?.description;
    mostrarAlerta({
      tipo,
      titulo: tipo === 'danger' ? 'Erro' : 'Atenção',
      mensagem: desc ? (
        <>
          {mensagem}
          {'\n'}
          {desc}
        </>
      ) : (
        mensagem
      ),
    });
    return `alerta-${seq}`;
  };
  t.error = desvio('danger');
  t.warning = desvio('warning');
}

// ---------- componente ----------
export function AlertaCentralGlobal() {
  const [itens, setItens] = useState<Item[]>(fila);
  const { toasts, dismiss } = useToast();
  const tratados = useRef(new Set<string>());

  useEffect(() => {
    desviarSonner();
    ouvintes.add(setItens);
    return () => {
      ouvintes.delete(setItens);
    };
  }, []);

  // use-toast: os "destructive" saem do canto (Toaster os ignora) e vêm para cá
  useEffect(() => {
    for (const t of toasts) {
      if ((t as any).variant !== 'destructive' || tratados.current.has(t.id)) continue;
      tratados.current.add(t.id);
      const titulo = t.title;
      const descricao = t.description;
      const ehErro = /erro|falh|inválid|invalid|não foi poss/i.test(`${textoDe(titulo)} ${textoDe(descricao)}`);
      mostrarAlerta({
        tipo: ehErro ? 'danger' : 'warning',
        titulo: titulo || (descricao ? 'Atenção' : undefined),
        mensagem: descricao,
      });
      dismiss(t.id);
    }
  }, [toasts, dismiss]);

  const atual = itens[0];

  // Enter / Esc fecham (OK). Captura antes dos atalhos da tela por trás, e ignora
  // o Enter nos primeiros instantes (o Enter que disparou o salvar não fecha o alerta).
  useEffect(() => {
    if (!atual) return;
    const abertoEm = Date.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Enter' && Date.now() - abertoEm < 300) return;
      fecharAtual();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [atual]);

  if (!atual || typeof document === 'undefined') return null;

  const perigo = atual.tipo === 'danger';
  return createPortal(
    <div
      data-alerta-central
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10050] pointer-events-auto"
    >
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[400px] max-w-[500px] mx-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            {perigo ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            )}
          </div>
          {atual.titulo ? (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{atual.titulo}</h2>
          ) : null}
          {atual.mensagem ? (
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{atual.mensagem}</div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <button
            autoFocus
            onClick={fecharAtual}
            className={`px-4 py-2 text-white rounded ${perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AlertaCentralGlobal;
