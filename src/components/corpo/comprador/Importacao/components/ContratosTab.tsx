/**
 * Tab "Contratos de Câmbio" da Declaração de Importação
 * Contratos vêm do XML ou do Contas a Pagar Internacional.
 *
 * O XML pode trazer contratos em moedas diferentes (USD, EUR, CNY...). Tudo é
 * convertido para dólar (coluna "Valor (U$$)"), pois o motor de custo usa USD:
 *   Valor(U$$) = Valor(BRL) / Taxa Dólar     [Taxa Dólar = dólar->BRL]
 *   Valor(BRL) = Valor(Moeda) × Taxa Câmbio  [Taxa Câmbio = moeda do contrato->BRL]
 *
 * A Taxa Dólar é buscada no Contas a Pagar (ao vincular o título); se faltar,
 * pode ser buscada pela cotação do dia da DI ou digitada manualmente.
 */

import React, { useState } from 'react';
import { Trash2, DollarSign, Search, CalendarSearch, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import type { ContratoCambio, OrigemTaxa } from '../types/importacao';
import { useContratosTotais } from '../hooks/useContratoModal';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import { fmtUSD, fmtBRL, fmtTaxa, fmtDate } from '../utils/formatters';
import { BuscarContaPagarModal, type TituloSelecionado } from './BuscarContaPagarModal';

/** 'YYYY-MM-DD' a partir de um ISO (com ou sem hora). */
const soData = (d?: string) => (d ? String(d).slice(0, 10) : '');

/** Selo de origem da taxa (câmbio/dólar), para o usuário saber de onde veio. */
const ORIGEM_INFO: Record<OrigemTaxa, { label: string; full: string; cls: string }> = {
  CAP: {
    label: 'CAP',
    full: 'Contas a Pagar',
    cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  XML: {
    label: 'XML',
    full: 'Veio do XML da DI',
    cls: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-600',
  },
  PTAX: {
    label: 'PTAX',
    full: 'Banco Central (PTAX)',
    cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  MERCADO: {
    label: 'Mercado',
    full: 'Cotação de mercado (AwesomeAPI)',
    cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  MANUAL: {
    label: 'Manual',
    full: 'Digitada manualmente',
    cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
};

const OrigemBadge: React.FC<{ origem?: OrigemTaxa }> = ({ origem }) => {
  if (!origem || !ORIGEM_INFO[origem]) return null;
  const { label, full, cls } = ORIGEM_INFO[origem];
  return (
    <span
      title={full}
      className={`inline-flex shrink-0 px-1 py-0.5 rounded text-[9px] leading-none font-medium border ${cls}`}
    >
      {label}
    </span>
  );
};

interface ContratosTabProps {
  contratos: ContratoCambio[];
  onAdd: (contrato: ContratoCambio) => void;
  onRemove: (index: number) => void;
  onUpdate?: (index: number, patch: Partial<ContratoCambio>) => void;
  dataDi?: string; // data da DI, usada para buscar a cotação do dólar
  readOnly?: boolean;
  taxaDolarMedio?: number;
}

const moedaSimbolo = (m?: string) =>
  m === 'EUR' ? '€' : m === 'USD' ? '$' : m === 'CNY' ? '¥' : (m || 'USD');

export const ContratosTab: React.FC<ContratosTabProps> = ({
  contratos,
  onAdd,
  onRemove,
  onUpdate,
  dataDi,
  readOnly = false,
  taxaDolarMedio,
}) => {
  const totais = useContratosTotais(contratos, taxaDolarMedio);
  const [modalAberto, setModalAberto] = useState(false);
  const [buscandoCotacao, setBuscandoCotacao] = useState<number | null>(null);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  // Modal de busca de cotação (data editável)
  const [cotacaoModal, setCotacaoModal] = useState<{
    idx: number; tipo: 'cambio' | 'dolar'; moeda: string; data: string; origemData: string;
  } | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const copiarContrato = async (idx: number, contrato: string) => {
    try {
      await navigator.clipboard.writeText(contrato);
      setCopiado(idx);
      setTimeout(() => setCopiado((v) => (v === idx ? null : v)), 1200);
    } catch { /* clipboard indisponível */ }
  };

  const titulosVinculados = contratos
    .filter((c) => c.id_titulo_pagar)
    .map((c) => String(c.id_titulo_pagar));

  const handleTitulosSelecionados = (titulos: TituloSelecionado[]) => {
    for (const t of titulos) {
      const moeda = t.moeda || 'USD';
      // Para título em USD, a taxa do título já é a taxa do dólar (origem CAP).
      const taxaUsd = moeda === 'USD' ? t.taxa_dolar : undefined;
      const vlUsd = moeda === 'USD' ? t.vl_merc_dolar : undefined;
      onAdd({
        id_importacao: 0,
        contrato: t.contrato,
        data: t.data,
        taxa_dolar: t.taxa_dolar,        // moeda -> BRL
        vl_merc_dolar: t.vl_merc_dolar,  // valor na moeda
        vl_reais: t.vl_reais,
        moeda,
        taxa_usd: taxaUsd,
        vl_usd: vlUsd,
        origem_cambio: 'CAP',
        origem_taxa: moeda === 'USD' ? 'CAP' : undefined,
        id_titulo_pagar: parseInt(t.id_titulo_pagar) || undefined,
      });
    }
    setModalAberto(false);
  };

  const avisar = (message: string) =>
    pedirConfirmacao(() => {}, { title: 'Atenção', message, type: 'warning', somenteOk: true });

  // Data da cotação = dia do câmbio (data do título, quando veio do Contas a Pagar)
  // ou, na falta, a data da DI. O dólar-bridge usa o MESMO dia do câmbio.
  const dataCotacao = (c: ContratoCambio) => soData(c.data) || soData(dataDi);

  // Executa a busca no PTAX e aplica como Taxa Câmbio (moeda->BRL) ou Taxa Dólar.
  const executarCotacao = async (idx: number, tipo: 'cambio' | 'dolar', moeda: string, data: string) => {
    if (!onUpdate) return;
    setBuscandoCotacao(idx);
    try {
      const res = await api.get(`/api/cotacao/moeda?moeda=${moeda}&data=${data}`);
      if (res.data?.found && res.data?.taxa > 0) {
        // Origem reflete a fonte real: PTAX (Banco Central) ou Mercado (AwesomeAPI).
        const origem: OrigemTaxa = res.data.fonte === 'AWESOME' ? 'MERCADO' : 'PTAX';
        if (tipo === 'cambio') onUpdate(idx, { taxa_dolar: res.data.taxa, origem_cambio: origem });
        else onUpdate(idx, { taxa_usd: res.data.taxa, origem_taxa: origem });
      } else {
        avisar(`Cotação ${moeda} não encontrada para a data. Digite a taxa manualmente.`);
      }
    } catch {
      avisar('Não foi possível buscar a cotação. Digite a taxa manualmente.');
    } finally {
      setBuscandoCotacao(null);
    }
  };

  // Clique no botão: abre o modal com a data (padrão DI) editável antes de buscar.
  const buscarCotacao = (idx: number, c: ContratoCambio, tipo: 'cambio' | 'dolar') => {
    if (!onUpdate) return;
    const data = dataCotacao(c);
    const moeda = tipo === 'cambio' ? (c.moeda || 'USD') : 'USD';
    if (!data) {
      avisar('Informe a Data da DI (aba Dados Gerais) para buscar a cotação.');
      return;
    }
    const origemData = soData(c.data) ? 'data do pagamento (Contas a Pagar)' : 'data da DI (XML)';
    setCotacaoModal({ idx, tipo, moeda, data, origemData });
  };

  const confirmarBuscaCotacao = () => {
    if (!cotacaoModal) return;
    const { idx, tipo, moeda, data } = cotacaoModal;
    setCotacaoModal(null);
    executarCotacao(idx, tipo, moeda, data);
  };

  const setTaxaCambio = (idx: number, valor: string) => {
    if (!onUpdate) return;
    const n = parseFloat(valor);
    onUpdate(idx, { taxa_dolar: isNaN(n) ? 0 : n, origem_cambio: isNaN(n) ? undefined : 'MANUAL' });
  };

  const setTaxaUsd = (idx: number, valor: string) => {
    if (!onUpdate) return;
    const n = parseFloat(valor);
    onUpdate(idx, { taxa_usd: isNaN(n) ? undefined : n, origem_taxa: isNaN(n) ? undefined : 'MANUAL' });
  };

  const podeEditar = !readOnly && !!onUpdate;

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-4">
        <IndicadorCard titulo="Total Contratos (USD)" valor={fmtUSD(totais.totalUSD)} />
        <IndicadorCard titulo="Total Contratos (BRL)" valor={fmtBRL(totais.totalBRL)} />
        <IndicadorCard
          titulo="Dólar Médio Ponderado"
          valor={totais.dolarMedio > 0 ? fmtTaxa(totais.dolarMedio) : '-'}
        />
      </div>

      {/* Aviso de moeda estrangeira sem taxa do dólar */}
      {totais.pendentesTaxa > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {totais.pendentesTaxa} contrato(s) em moeda estrangeira sem <b>Taxa Dólar</b> — o valor
            em dólar não entra no total. Busque a cotação pela data da DI ou digite a taxa.
          </span>
        </div>
      )}

      {/* Header + ações */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Contratos de Câmbio ({contratos.length})
        </h3>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1"
          >
            <Search size={14} />
            Buscar no Contas a Pagar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="border border-gray-300 dark:border-zinc-600 rounded-lg overflow-x-auto">
        <div className="min-w-[1180px]">
          {/* Header da tabela */}
          <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
            <div className="flex gap-2 px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200">
              <div className="w-32">Nº Contrato</div>
              <div className="w-20">Data</div>
              <div className="w-14 text-center">Moeda</div>
              <div className="w-28 text-right">Valor (Moeda)</div>
              <div className="w-44 text-right">Taxa Câmbio</div>
              <div className="w-44 text-right">Taxa Dólar</div>
              <div className="w-28 text-right">Valor (U$$)</div>
              <div className="flex-1 text-right">Valor (BRL)</div>
              {!readOnly && <div className="w-12 text-center">Ações</div>}
            </div>
          </div>

          {/* Corpo */}
          <div className="min-h-[120px]">
            {contratos.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhum contrato de câmbio adicionado
                  </p>
                  {!readOnly && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Use "Buscar no Contas a Pagar" para vincular títulos
                    </p>
                  )}
                </div>
              </div>
            ) : (
              contratos.map((c, idx) => {
                const estrangeira = !!c.moeda && c.moeda !== 'USD';
                const semTaxa = estrangeira && (c.vl_usd == null || !c.taxa_usd);
                const brl = c.vl_reais ?? (c.vl_merc_dolar || 0) * (c.taxa_dolar || 0);
                return (
                  <div
                    key={idx}
                    className={`flex gap-2 px-4 py-3 text-sm border-b border-gray-100 dark:border-zinc-700 transition-colors items-center ${
                      semTaxa
                        ? 'bg-amber-50/70 dark:bg-amber-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="w-32 flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
                      <span className="truncate">{c.contrato}</span>
                      {c.id_titulo_pagar && (
                        <span className="text-[10px] text-gray-400 shrink-0">#{c.id_titulo_pagar}</span>
                      )}
                      <button
                        type="button"
                        title="Copiar nº do contrato"
                        onClick={() => copiarContrato(idx, c.contrato)}
                        className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-400 hover:text-[#347AB6] shrink-0"
                      >
                        {copiado === idx ? (
                          <Check size={12} className="text-green-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                    <div className="w-20 text-gray-600 dark:text-gray-300">{fmtDate(c.data)}</div>
                    <div className="w-14 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          estrangeira
                            ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                            : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {c.moeda || 'USD'}
                      </span>
                    </div>
                    <div className="w-28 text-right text-gray-900 dark:text-gray-100">
                      {moedaSimbolo(c.moeda)}{' '}
                      {(c.vl_merc_dolar || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>

                    {/* Taxa Câmbio (moeda -> BRL): input + buscar + origem, tudo na linha */}
                    <div className="w-44 flex items-center justify-end gap-1">
                      {podeEditar ? (
                        <>
                          <input
                            type="number"
                            step="0.0001"
                            value={c.taxa_dolar || ''}
                            placeholder="0.0000"
                            onChange={(e) => setTaxaCambio(idx, e.target.value)}
                            className="h-7 w-16 text-right text-xs rounded border px-1 bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-zinc-600"
                          />
                          <button
                            type="button"
                            title={`Buscar cotação ${c.moeda || 'USD'} (PTAX)`}
                            onClick={() => buscarCotacao(idx, c, 'cambio')}
                            disabled={buscandoCotacao === idx}
                            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[#347AB6] disabled:opacity-50 shrink-0"
                          >
                            {buscandoCotacao === idx ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CalendarSearch size={14} />
                            )}
                          </button>
                          <OrigemBadge origem={c.origem_cambio} />
                        </>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300">
                          {c.taxa_dolar ? fmtTaxa(c.taxa_dolar) : '-'}
                        </span>
                      )}
                    </div>

                    {/* Taxa Dólar (bridge USD -> BRL): input + buscar + origem, tudo na linha */}
                    <div className="w-44 flex items-center justify-end gap-1">
                      {podeEditar ? (
                        <>
                          <input
                            type="number"
                            step="0.0001"
                            value={c.taxa_usd ?? ''}
                            placeholder="0.0000"
                            onChange={(e) => setTaxaUsd(idx, e.target.value)}
                            className={`h-7 w-16 text-right text-xs rounded border px-1 bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 ${
                              semTaxa
                                ? 'border-amber-400 dark:border-amber-600'
                                : 'border-gray-300 dark:border-zinc-600'
                            }`}
                          />
                          <button
                            type="button"
                            title="Buscar cotação do dólar (PTAX)"
                            onClick={() => buscarCotacao(idx, c, 'dolar')}
                            disabled={buscandoCotacao === idx}
                            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[#347AB6] disabled:opacity-50 shrink-0"
                          >
                            {buscandoCotacao === idx ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CalendarSearch size={14} />
                            )}
                          </button>
                          <OrigemBadge origem={c.origem_taxa} />
                        </>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300">
                          {c.taxa_usd ? fmtTaxa(c.taxa_usd) : '-'}
                        </span>
                      )}
                    </div>

                    {/* Valor (U$$) */}
                    <div className="w-28 text-right font-medium">
                      {c.vl_usd != null ? (
                        <span className="text-green-600 dark:text-green-400">{fmtUSD(c.vl_usd)}</span>
                      ) : estrangeira ? (
                        <span className="text-amber-600 dark:text-amber-400 text-xs">taxa?</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          {fmtUSD(c.vl_merc_dolar)}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-right font-medium text-gray-900 dark:text-gray-100">
                      {fmtBRL(brl)}
                    </div>

                    {!readOnly && (
                      <div className="w-12 flex items-center justify-center">
                        <button
                          onClick={() => onRemove(idx)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal de busca */}
      <BuscarContaPagarModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onConfirmar={handleTitulosSelecionados}
        contratosExistentes={titulosVinculados}
      />

      {/* Modal de busca de cotação (data editável) */}
      {cotacaoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCotacaoModal(null)} />
          <div className="relative w-full max-w-md rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {cotacaoModal.tipo === 'cambio'
                  ? `Buscar cotação ${cotacaoModal.moeda}`
                  : 'Buscar cotação do dólar'}
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                A taxa {cotacaoModal.tipo === 'cambio' ? `de câmbio (${cotacaoModal.moeda})` : 'do dólar'}{' '}
                será buscada no Banco Central (PTAX) na data abaixo.
              </p>
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Data da cotação
                </span>
                <input
                  type="date"
                  value={cotacaoModal.data}
                  onChange={(e) => setCotacaoModal((m) => (m ? { ...m, data: e.target.value } : m))}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm text-gray-800 dark:text-gray-100"
                />
                <span className="mt-1 block text-[11px] text-gray-400">
                  Padrão: {cotacaoModal.origemData}. Pode ajustar (ex.: data do pagamento, se diferente da DI).
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-zinc-700">
              <Button variant="outline" size="sm" onClick={() => setCotacaoModal(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!/^\d{4}-\d{2}-\d{2}$/.test(cotacaoModal.data)}
                onClick={confirmarBuscaCotacao}
                className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
              >
                Buscar
              </Button>
            </div>
          </div>
        </div>
      )}

      {ConfirmacaoSalvarModal}
    </div>
  );
};

/** Card indicador simples */
const IndicadorCard: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
    <div className="text-xs text-gray-500 dark:text-gray-400">{titulo}</div>
    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{valor}</div>
  </div>
);
