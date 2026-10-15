/**
 * Modal de progresso da emissão (nota de nacionalização) — mesmo padrão visual do
 * Faturamento: barra "Etapa X de Y" + checklist das etapas (✓ concluída, ✕ falhou,
 * spinner em andamento, ○ pendente) + detalhe/erro. Fechável só quando não está mais
 * carregando.
 */

import React from 'react';

export type PassoStatus = 'pendente' | 'loading' | 'done' | 'error';
export interface PassoEmissao {
  nome: string;
  status: PassoStatus;
}

interface Props {
  aberto: boolean;
  titulo?: string;
  passos: PassoEmissao[];
  status: 'loading' | 'success' | 'error';
  /** Texto auxiliar (ex.: resultado do rollback). */
  detalhe?: string;
  /** Detalhe do erro (ex.: motivo da SEFAZ). */
  errorMsg?: string;
  onClose: () => void;
}

export const ModalProgressoEmissao: React.FC<Props> = ({
  aberto,
  titulo = 'Emissão da Nota de Nacionalização',
  passos,
  status,
  detalhe,
  errorMsg,
  onClose,
}) => {
  if (!aberto) return null;

  const total = passos.length || 1;
  const concluidos = passos.filter((p) => p.status === 'done').length;
  const atual = Math.min(total, concluidos + (status === 'loading' ? 1 : 0)) || 1;
  const pct = status === 'success' ? 100 : Math.round((concluidos / total) * 100);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{titulo}</h3>
          {status !== 'loading' && (
            <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-2xl leading-none">
              ×
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Barra de progresso */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Etapa {atual} de {total}</span>
              <span>{status === 'error' ? '—' : `${pct}%`}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  status === 'error' ? 'bg-red-500' : status === 'success' ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${status === 'error' ? 100 : pct}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <ul className="flex flex-col gap-1.5">
            {passos.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {p.status === 'done' && <span className="text-green-600 font-bold w-4 text-center">✓</span>}
                {p.status === 'error' && <span className="text-red-500 font-bold w-4 text-center">✕</span>}
                {p.status === 'loading' && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin inline-block" />
                )}
                {p.status === 'pendente' && (
                  <span className="text-gray-300 dark:text-zinc-600 w-4 text-center">○</span>
                )}
                <span
                  className={
                    p.status === 'done'
                      ? 'text-gray-700 dark:text-gray-200'
                      : p.status === 'error'
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : p.status === 'loading'
                          ? 'text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-400 dark:text-zinc-500'
                  }
                >
                  {p.nome}
                </span>
              </li>
            ))}
          </ul>

          {detalhe && <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{detalhe}</div>}

          {status === 'error' && errorMsg && (
            <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              <div className="font-semibold mb-1">Detalhe do erro</div>
              <div className="break-words whitespace-pre-wrap">{errorMsg}</div>
            </div>
          )}
        </div>

        {status !== 'loading' && (
          <div className="px-5 py-3 border-t dark:border-zinc-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
