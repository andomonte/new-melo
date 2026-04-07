/**
 * Modal para buscar títulos internacionais do Contas a Pagar
 * e adicioná-los como contratos de câmbio na DI
 *
 * Fluxo: buscar → selecionar vários (chips) → confirmar
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import { fmtBRL, fmtTaxa } from '../utils/formatters';

interface TituloInternacional {
  id: string;
  cod_credor: string;
  nome_credor: string;
  moeda: string;
  taxa_conversao: number;
  valor_moeda: number;
  valor_pgto: number;
  nro_contrato: string;
  nro_invoice: string;
  dt_venc: string;
  status: string;
  parcela_atual: string | null;
}

export interface TituloSelecionado {
  id_titulo_pagar: string;
  contrato: string;
  moeda: string;
  taxa_dolar: number;
  vl_merc_dolar: number;
  vl_reais: number;
  data: string;
  fornecedor: string;
}

interface BuscarContaPagarModalProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (titulos: TituloSelecionado[]) => void;
  contratosExistentes?: string[]; // cod_pgto já vinculados
}

export const BuscarContaPagarModal: React.FC<BuscarContaPagarModalProps> = ({
  aberto,
  onFechar,
  onConfirmar,
  contratosExistentes = [],
}) => {
  const [busca, setBusca] = useState('');
  const [titulos, setTitulos] = useState<TituloInternacional[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Map<string, TituloInternacional>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset ao abrir
  useEffect(() => {
    if (aberto) {
      setBusca('');
      setTitulos([]);
      setSelecionados(new Map());
      fetchTitulos('');
    }
  }, [aberto]);

  const fetchTitulos = useCallback(async (termo: string) => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ limit: '50', status: 'pendente_parcial' });
      if (termo) params.set('search', termo);

      const res = await api.get(`/api/contas-pagar/internacionais?${params}`);
      const lista = (res.data.contas_pagar || []) as TituloInternacional[];

      // Filtrar os que já estão vinculados
      const jaVinculados = new Set(contratosExistentes);
      setTitulos(lista.filter((t) => !jaVinculados.has(t.id)));
    } catch {
      setTitulos([]);
    } finally {
      setCarregando(false);
    }
  }, [contratosExistentes]);

  const handleBuscaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusca(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchTitulos(val), 400);
  };

  const toggleSelecao = (titulo: TituloInternacional) => {
    setSelecionados((prev) => {
      const novo = new Map(prev);
      if (novo.has(titulo.id)) {
        novo.delete(titulo.id);
      } else {
        novo.set(titulo.id, titulo);
      }
      return novo;
    });
  };

  const handleConfirmar = () => {
    const resultado: TituloSelecionado[] = Array.from(selecionados.values()).map((t) => ({
      id_titulo_pagar: t.id,
      contrato: t.nro_contrato || t.id,
      moeda: t.moeda || 'USD',
      taxa_dolar: t.taxa_conversao || 0,
      vl_merc_dolar: t.valor_moeda || 0,
      vl_reais: t.valor_pgto || 0,
      data: t.dt_venc || '',
      fornecedor: t.nome_credor || '',
    }));
    onConfirmar(resultado);
  };

  if (!aberto) return null;

  const fmtMoeda = (moeda: string, valor: number) => {
    const simbolo = moeda === 'EUR' ? '€' : moeda === 'USD' ? '$' : moeda;
    return `${simbolo} ${valor.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const statusBadge = (status: string) => {
    if (status === 'pendente') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (status === 'pago_parcial') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h3 className="text-lg font-bold text-[#347AB6]">Buscar Titulos Internacionais</h3>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={handleBuscaChange}
              placeholder="Buscar por codigo, fornecedor, contrato, invoice..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
              autoFocus
            />
          </div>
        </div>

        {/* Chips de selecionados */}
        {selecionados.size > 0 && (
          <div className="px-5 py-2 border-b border-gray-200 dark:border-zinc-700 shrink-0">
            <div className="flex flex-wrap gap-2">
              {Array.from(selecionados.values()).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#347AB6]/10 text-[#347AB6] dark:bg-blue-900/30 dark:text-blue-400 border border-[#347AB6]/20 dark:border-blue-800"
                >
                  {t.nro_contrato || t.id} - {t.moeda} {t.valor_moeda?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <button
                    onClick={() => toggleSelecao(t)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
          ) : titulos.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
              Nenhum titulo internacional encontrado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                <tr className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <th className="w-10 py-2 px-2" />
                  <th className="text-left py-2 px-2">Titulo</th>
                  <th className="text-left py-2 px-2">Fornecedor</th>
                  <th className="text-left py-2 px-2">Contrato</th>
                  <th className="text-center py-2 px-2">Moeda</th>
                  <th className="text-right py-2 px-2">Valor (Moeda)</th>
                  <th className="text-right py-2 px-2">Taxa</th>
                  <th className="text-right py-2 px-2">Valor (BRL)</th>
                  <th className="text-center py-2 px-2">Vencimento</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((t) => {
                  const sel = selecionados.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => toggleSelecao(t)}
                      className={`border-b border-gray-100 dark:border-zinc-700 cursor-pointer transition-colors ${
                        sel
                          ? 'bg-[#347AB6]/5 dark:bg-blue-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <td className="py-2 px-2 text-center">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          sel
                            ? 'bg-[#347AB6] border-[#347AB6]'
                            : 'border-gray-300 dark:border-zinc-600'
                        }`}>
                          {sel && <Check size={12} className="text-white" />}
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-gray-900 dark:text-gray-100">
                        {t.id}
                        {t.parcela_atual && (
                          <span className="ml-1 text-[10px] text-gray-400">({t.parcela_atual})</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300 truncate max-w-[180px]">
                        {t.nome_credor || t.cod_credor}
                      </td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300">
                        {t.nro_contrato || '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300">
                          {t.moeda || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                        {t.valor_moeda ? fmtMoeda(t.moeda, t.valor_moeda) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">
                        {t.taxa_conversao ? fmtTaxa(t.taxa_conversao) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
                        {fmtBRL(t.valor_pgto)}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-300">
                        {t.dt_venc ? new Date(t.dt_venc + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadge(t.status)}`}>
                          {t.status === 'pendente' ? 'Pendente' : t.status === 'pago_parcial' ? 'Parcial' : t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-zinc-700 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selecionados.size > 0
              ? `${selecionados.size} titulo(s) selecionado(s)`
              : `${titulos.length} titulo(s) encontrado(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selecionados.size === 0}
              onClick={handleConfirmar}
              className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              Adicionar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
