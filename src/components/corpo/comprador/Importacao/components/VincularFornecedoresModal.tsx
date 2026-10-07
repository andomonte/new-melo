/**
 * Modal: vincular os FORNECEDORES da DIe aos CLIENTES do cadastro (tipo X).
 *
 * Para cada fornecedor (ordenado pela menor adição) o endpoint já resolve:
 *   learned   → vínculo reaproveitado de outra DI;
 *   suggested → 1 candidato por prefixo do nome (auto, é só confirmar);
 *   multiple  → 2+ candidatos (escolher);
 *   none      → nenhum (busca manual).
 * Confirma gravando o vínculo (reutilizável) + cod_cliente da fatura.
 * A emissão da Nota de Nacionalização fica bloqueada até todos vinculados.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Loader2, Check, AlertTriangle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';

interface ClienteX {
  codCliente: string;
  nome: string;
  nomeFant?: string | null;
  codPais?: number | string | null;
  idEstrangeiro?: string | null;
}

interface FornecedorVinculo {
  nome_die: string;
  primeira_adicao: number;
  qtd_adicoes: number;
  cod_cliente: string | null;
  status: 'learned' | 'suggested' | 'multiple' | 'none';
  vinculado: boolean;
  candidatos: ClienteX[];
  cliente?: ClienteX | null;
  avisos: string[];
}

interface Props {
  aberto: boolean;
  importacaoId: number;
  onFechar: () => void;
  onVinculado: (nomeDie: string, codCliente: string) => void;
}

const STATUS_BADGE: Record<FornecedorVinculo['status'], { label: string; cls: string }> = {
  learned: { label: 'Reaproveitado', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' },
  suggested: { label: 'Sugerido', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  multiple: { label: 'Vários', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  none: { label: 'Sem cadastro', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
};

/** Busca manual de cliente estrangeiro (tipo X) por nome. */
const BuscaClienteX: React.FC<{ onPick: (c: ClienteX) => void }> = ({ onPick }) => {
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<ClienteX[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const buscar = useCallback(async (q: string) => {
    try {
      const res = await api.post('/api/clientes/buscaClientes', {
        page: 1,
        perPage: 10,
        filtros: [
          { campo: 'tipo', tipo: 'igual', valor: 'X' },
          { campo: 'nome', tipo: 'contém', valor: q },
        ],
      });
      return (res.data?.data || []).map((c: any) => ({
        codCliente: String(c.codcli),
        nome: c.nome || '',
        nomeFant: c.nomefant || null,
        codPais: c.codpais ?? null,
        idEstrangeiro: c.cpfcgc ?? null,
      })) as ClienteX[];
    } catch {
      return [];
    }
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTermo(val);
    setAberto(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (val.trim().length >= 2) {
        setCarregando(true);
        setOpcoes(await buscar(val.trim()));
        setCarregando(false);
      } else {
        setOpcoes([]);
      }
    }, 350);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={termo}
          onChange={onChange}
          onFocus={() => opcoes.length > 0 && setAberto(true)}
          placeholder="Buscar cliente estrangeiro por nome..."
          className="w-full pl-8 pr-8 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-md text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
        />
        {carregando && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />}
      </div>
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-[80] w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-md shadow-lg max-h-56 overflow-auto">
          {opcoes.map((c) => (
            <button
              key={c.codCliente}
              onClick={() => { onPick(c); setTermo(''); setOpcoes([]); setAberto(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <span className="font-mono text-gray-500">{c.codCliente}</span> — {c.nome}
            </button>
          ))}
        </div>
      )}
      {aberto && !carregando && termo.trim().length >= 2 && opcoes.length === 0 && (
        <div className="absolute z-[80] w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-md shadow-lg p-2 text-center text-xs text-gray-500 dark:text-gray-400">
          Nenhum cliente estrangeiro encontrado
        </div>
      )}
    </div>
  );
};

export const VincularFornecedoresModal: React.FC<Props> = ({ aberto, importacaoId, onFechar, onVinculado }) => {
  const [lista, setLista] = useState<FornecedorVinculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setLoading(true);
    api
      .get(`/api/importacao/${importacaoId}/fornecedores`)
      .then((r) => setLista(r.data?.fornecedores || []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [aberto, importacaoId]);

  const vincular = async (nomeDie: string, c: ClienteX) => {
    setSalvando(nomeDie);
    try {
      const r = await api.post(`/api/importacao/${importacaoId}/fornecedores`, {
        nome_die: nomeDie,
        cod_cliente: c.codCliente,
      });
      const avisos: string[] = r.data?.avisos || [];
      setLista((prev) =>
        prev.map((f) =>
          f.nome_die === nomeDie
            ? { ...f, cod_cliente: c.codCliente, vinculado: true, status: 'learned', cliente: c, avisos }
            : f,
        ),
      );
      onVinculado(nomeDie, c.codCliente);
    } finally {
      setSalvando(null);
    }
  };

  if (!aberto) return null;

  const vinculados = lista.filter((f) => f.vinculado).length;
  const total = lista.length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-[#347AB6]">Vincular Fornecedores ao Cadastro</h3>
            {total > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${vinculados === total ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}>
                {vinculados}/{total} vinculados
              </span>
            )}
          </div>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Lista */}
        <div className="px-5 py-4 overflow-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando fornecedores...
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
              Nenhum fornecedor com adição nesta DI. Gere a hierarquia (reimporte a DI) antes de vincular.
            </p>
          ) : (
            lista.map((f) => {
              const badge = STATUS_BADGE[f.status];
              return (
                <div key={f.nome_die} className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                      Adição {String(f.primeira_adicao).padStart(3, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{f.nome_die}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>{badge.label}</span>
                      </div>

                      {/* Vinculado */}
                      {f.vinculado && f.cliente ? (
                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                          <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                          <span className="text-gray-900 dark:text-gray-100">
                            <span className="font-mono text-gray-500">{f.cliente.codCliente}</span> — {f.cliente.nome}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {/* Candidatos (sugestão / múltiplos) */}
                          {f.candidatos.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {f.candidatos.map((c) => (
                                <button
                                  key={c.codCliente}
                                  disabled={salvando === f.nome_die}
                                  onClick={() => vincular(f.nome_die, c)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-[#347AB6] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50"
                                >
                                  <Link2 size={11} />
                                  <span className="font-mono">{c.codCliente}</span> {c.nome}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Busca manual */}
                          <BuscaClienteX onPick={(c) => vincular(f.nome_die, c)} />
                        </div>
                      )}

                      {/* Avisos do destinatário exterior */}
                      {f.vinculado && f.avisos.length > 0 && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>{f.avisos.join(' · ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Trocar vínculo */}
                    {f.vinculado && (
                      <button
                        onClick={() =>
                          setLista((prev) => prev.map((x) => (x.nome_die === f.nome_die ? { ...x, vinculado: false } : x)))
                        }
                        className="text-[11px] text-gray-400 hover:text-[#347AB6] shrink-0"
                      >
                        Trocar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-zinc-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {vinculados === total && total > 0
              ? 'Todos os fornecedores vinculados — pronto para a Nota de Nacionalização.'
              : 'Vincule todos os fornecedores para liberar a Nota de Nacionalização.'}
          </span>
          <Button size="sm" onClick={onFechar} className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white">
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
};
