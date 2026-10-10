/**
 * Painel guiado para gerar a entrada de uma DI (espelha o fluxo nacional):
 *   Passo 1 — Calcular Custos   → POST /api/importacao/:id/calcular-custos
 *   Passo 2 — Gerar Entrada     → POST /api/importacao/:id/gerar-entradas  (staging dbnfe_ent)
 *                                  + POST /api/entradas/gerar-por-chave      (dbent + estoque)
 *   Passo 3 — Confirmar Preço   → ConfirmarPrecoModal → POST /api/entradas/:codent/confirmar-preco
 *                                  (média ponderada + reprecificação de venda; fecha a entrada)
 *
 * O "confirmar preço" é o passo que FECHA a entrada (status 'F' / recebimento
 * PRECO_CONFIRMADO), exatamente como em Entradas de Mercadorias no nacional.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Calculator, PackagePlus, DollarSign, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import { ConfirmarPrecoModal } from '@/components/corpo/comprador/Entradas/components/ConfirmarPrecoModal';

interface GerarEntradaDetalheProps {
  isOpen: boolean;
  importacaoId?: number;
  onClose: () => void;
}

interface EntradaGerada {
  codent: string;
  numeroNF: string;
  confirmado: boolean;
}

export const GerarEntradaDetalhe: React.FC<GerarEntradaDetalheProps> = ({
  isOpen, importacaoId, onClose,
}) => {
  const [di, setDi] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [calculando, setCalculando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [entradas, setEntradas] = useState<EntradaGerada[]>([]);

  const [modalPreco, setModalPreco] = useState<EntradaGerada | null>(null);
  const [confirmandoPreco, setConfirmandoPreco] = useState(false);

  const carregar = useCallback(async () => {
    if (!importacaoId) return;
    setLoading(true);
    setErro(null);
    try {
      const resp = await api.get(`/api/importacao/${importacaoId}`);
      if (resp.data?.success) {
        const data = resp.data.data;
        setDi(data);
        // DI já com entrada gerada: recupera as faturas que já têm codent para
        // permitir (re)confirmar o preço.
        if (data.status === 'E') {
          const faturas = (data.entradas || []).filter((f: any) => f.codent);
          setEntradas(faturas.map((f: any) => ({
            codent: String(f.codent),
            numeroNF: String(f.id),
            confirmado: false,
          })));
        } else {
          setEntradas([]);
        }
      } else {
        setErro(resp.data?.message || 'Erro ao carregar DI');
      }
    } catch (e: any) {
      setErro(e.response?.data?.message || e.message || 'Erro ao carregar DI');
    } finally {
      setLoading(false);
    }
  }, [importacaoId]);

  useEffect(() => {
    if (isOpen && importacaoId) {
      setMsg(null);
      carregar();
    }
    if (!isOpen) {
      setDi(null);
      setEntradas([]);
      setErro(null);
      setMsg(null);
    }
  }, [isOpen, importacaoId, carregar]);

  const itensProd = (di?.itens || []).filter((i: any) => i.codprod);
  const custosCalculados =
    itensProd.length > 0 &&
    itensProd.every((i: any) => i.custo_unit_dolar != null && Number(i.custo_unit_dolar) !== 0);
  const statusN = di?.status === 'N';
  const entradaGerada = entradas.length > 0 || di?.status === 'E';

  const handleCalcular = async () => {
    if (!importacaoId) return;
    setCalculando(true);
    setErro(null);
    setMsg(null);
    try {
      const resp = await api.post(`/api/importacao/${importacaoId}/calcular-custos`);
      if (resp.data?.success) {
        setMsg(resp.data.message || 'Custos calculados.');
        await carregar();
      } else {
        setErro(resp.data?.message || 'Erro ao calcular custos');
      }
    } catch (e: any) {
      setErro(e.response?.data?.message || e.message || 'Erro ao calcular custos');
    } finally {
      setCalculando(false);
    }
  };

  const handleGerarEntrada = async () => {
    if (!importacaoId) return;
    setGerando(true);
    setErro(null);
    setMsg(null);
    try {
      // 1) staging dbnfe_ent (uma NFe por fatura, exec='C', natop ENTRADA_IMPORTACAO)
      const respGer = await api.post(`/api/importacao/${importacaoId}/gerar-entradas`);
      const nfes: Array<{ codnfe_ent: string }> = respGer.data?.nfes || [];
      if (!respGer.data?.success || nfes.length === 0) {
        setErro(respGer.data?.message || 'Nenhuma entrada gerada.');
        return;
      }

      // 2) dbent + estoque (gerar-por-chave reconhece a chave IMP)
      const geradas: EntradaGerada[] = [];
      for (const nfe of nfes) {
        const respChave = await api.post(`/api/entradas/gerar-por-chave`, { nfeId: nfe.codnfe_ent });
        if (respChave.data?.success && respChave.data?.entradaId) {
          geradas.push({
            codent: String(respChave.data.entradaId),
            numeroNF: String(respChave.data.numeroNF ?? respChave.data.entradaId),
            confirmado: false,
          });
        } else {
          setErro(respChave.data?.error || respChave.data?.message || `Falha ao gerar entrada para NFe ${nfe.codnfe_ent}`);
        }
      }
      setEntradas(geradas);
      setMsg(`${geradas.length} entrada(s) gerada(s) no estoque. Agora confirme o preço.`);
      // atualiza status local
      setDi((prev: any) => (prev ? { ...prev, status: 'E' } : prev));
    } catch (e: any) {
      setErro(e.response?.data?.error || e.response?.data?.message || e.message || 'Erro ao gerar entrada');
    } finally {
      setGerando(false);
    }
  };

  const handleConfirmarPreco = async (atualizarPrecoVenda: boolean, observacao: string) => {
    if (!modalPreco) return;
    setConfirmandoPreco(true);
    setErro(null);
    try {
      const resp = await api.post(`/api/entradas/${modalPreco.codent}/confirmar-preco`, {
        atualizarPrecoVenda,
        observacao,
      });
      if (resp.data?.success) {
        setEntradas((prev) => prev.map((e) =>
          e.codent === modalPreco.codent ? { ...e, confirmado: true } : e));
        setMsg(resp.data.message || 'Preço confirmado.');
        setModalPreco(null);
      } else {
        setErro(resp.data?.message || 'Erro ao confirmar preço');
      }
    } catch (e: any) {
      setErro(e.response?.data?.message || e.message || 'Erro ao confirmar preço');
    } finally {
      setConfirmandoPreco(false);
    }
  };

  if (!isOpen) return null;

  const StepBadge: React.FC<{ done: boolean; n: number }> = ({ done, n }) => (
    done
      ? <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
      : <span className="h-6 w-6 rounded-full bg-[#347AB6] text-white text-sm flex items-center justify-center font-semibold">{n}</span>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <PackagePlus className="h-5 w-5 text-[#347AB6] dark:text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Gerar Entrada — DI {di?.nro_di || importacaoId}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {itensProd.length} item(ns) · {(di?.entradas || []).length} fatura(s)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {erro && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{erro}</span>
                </div>
              )}
              {msg && (
                <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{msg}</span>
                </div>
              )}

              {/* Passo 1 — Calcular Custos */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StepBadge done={custosCalculados} n={1} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Calculator className="h-4 w-4" /> Calcular Custos
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Rateia despesas/impostos e define o custo por item (base da média).
                      </p>
                    </div>
                  </div>
                  {custosCalculados ? (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Calculado</span>
                  ) : (
                    <Button
                      onClick={handleCalcular}
                      disabled={calculando || !statusN}
                      className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                    >
                      {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular Custos'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Passo 2 — Gerar Entrada no estoque */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StepBadge done={entradaGerada} n={2} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <PackagePlus className="h-4 w-4" /> Gerar Entrada no estoque
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Cria a entrada (dbent) e lança a quantidade no estoque.
                      </p>
                    </div>
                  </div>
                  {entradaGerada ? (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {entradas.length > 0 ? `${entradas.length} entrada(s)` : 'Gerada'}
                    </span>
                  ) : (
                    <Button
                      onClick={handleGerarEntrada}
                      disabled={gerando || !custosCalculados || !statusN}
                      className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                    >
                      {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar Entrada'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Passo 3 — Confirmar Preço */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <StepBadge done={entradas.length > 0 && entradas.every((e) => e.confirmado)} n={3} />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Confirmar Preço
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Custo médio ponderado + recálculo do preço de venda. Fecha a entrada.
                    </p>
                  </div>
                </div>

                {entradas.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 pl-9">
                    Gere a entrada para habilitar a confirmação de preço.
                  </p>
                ) : (
                  <div className="space-y-2 pl-9">
                    {entradas.map((e) => (
                      <div
                        key={e.codent}
                        className="flex items-center justify-between gap-3 border border-gray-100 dark:border-zinc-700 rounded-md px-3 py-2"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Entrada <strong>{e.codent}</strong>
                        </span>
                        {e.confirmado ? (
                          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Confirmada
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            className="h-8 border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => setModalPreco(e)}
                          >
                            Confirmar Preço
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
          <Button variant="outline" onClick={onClose} className="dark:border-zinc-600 dark:text-gray-300">
            Fechar
          </Button>
        </div>
      </div>

      {/* Modal de Confirmar Preço (reusa a tela de Entradas de Mercadorias) */}
      {modalPreco && (
        <ConfirmarPrecoModal
          isOpen={!!modalPreco}
          onClose={() => setModalPreco(null)}
          onConfirm={handleConfirmarPreco}
          numeroNF={modalPreco.numeroNF}
          entradaId={modalPreco.codent}
          loading={confirmandoPreco}
        />
      )}
    </div>
  );
};
