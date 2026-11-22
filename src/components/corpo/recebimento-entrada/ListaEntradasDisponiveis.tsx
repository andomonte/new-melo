/**
 * Entradas que podem ser recebidas agora — lista com busca por número da nota,
 * chave, fornecedor (nome/CNPJ) ou número da entrada. "Receber" inicia o
 * recebimento direto da lista (sem precisar digitar/escanear a chave).
 */
import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, PackageCheck, Loader2, X } from 'lucide-react';
import {
  EntradaDisponivel,
  getEntradasDisponiveis,
} from '@/data/recebimento-entrada/recebimentoEntradaService';

interface Props {
  /** recarrega quando muda (ex.: depois de finalizar um recebimento) */
  versao: number;
  bloqueado: boolean;
  onReceber: (e: EntradaDisponivel) => Promise<void>;
  formatCurrency: (v: number) => string;
}

const dataBR = (s?: string | null) => {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
};

const ListaEntradasDisponiveis: React.FC<Props> = ({ versao, bloqueado, onReceber, formatCurrency }) => {
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  const [lista, setLista] = useState<EntradaDisponivel[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [recebendo, setRecebendo] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro('');
    getEntradasDisponiveis(buscaDeb)
      .then((r) => vivo && setLista(r))
      .catch((e) => vivo && setErro(e?.response?.data?.error || 'Não foi possível carregar as entradas.'))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [buscaDeb, versao, recarregar]);

  const receber = async (e: EntradaDisponivel) => {
    if (bloqueado || recebendo) return;
    setRecebendo(e.codent);
    try {
      await onReceber(e);
    } finally {
      setRecebendo(null);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700">
      <div className="p-3 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row gap-2 sm:items-center">
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
          <PackageCheck className="w-4 h-4 text-emerald-600" />
          Entradas para receber
          <span className="text-xs font-normal text-gray-500">({lista.length}{lista.length === 100 ? '+' : ''})</span>
        </h2>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nº da nota, chave, fornecedor ou CNPJ"
            className="w-full pl-9 pr-9 py-2 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setRecarregar((n) => n + 1)}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-600 text-sm"
          title="Atualizar lista"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {bloqueado && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20">
          Finalize o recebimento em andamento para iniciar outro.
        </div>
      )}
      {erro && <div className="px-3 py-3 text-sm text-red-600">{erro}</div>}

      <div className="divide-y divide-gray-100 dark:divide-zinc-700">
        {lista.map((e) => (
          <div key={e.codent} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-gray-900 dark:text-white">
                  NF {e.nfe_numero}
                  {e.nfe_serie ? `/${e.nfe_serie}` : ''}
                </span>
                <span className="text-xs text-gray-500">Entrada {e.codent}</span>
                {!e.preco_confirmado && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">preço pendente</span>
                )}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {e.fornecedor}
                {e.cnpj ? <span className="text-xs text-gray-500"> · {e.cnpj}</span> : null}
              </div>
              <div className="text-xs text-gray-500">
                {e.data_emissao ? `Emissão ${dataBR(e.data_emissao)} · ` : ''}
                {e.qtd_itens} {e.qtd_itens === 1 ? 'item' : 'itens'} · {formatCurrency(e.valor_total)}
              </div>
            </div>
            <button
              onClick={() => receber(e)}
              disabled={bloqueado || !!recebendo}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40"
            >
              {recebendo === e.codent ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Receber
            </button>
          </div>
        ))}
        {!carregando && !erro && lista.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">
            {buscaDeb ? 'Nenhuma entrada encontrada para esta busca.' : 'Nenhuma entrada aguardando recebimento.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListaEntradasDisponiveis;
