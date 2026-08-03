import React, { useEffect, useState, useCallback } from 'react';
import { X, Search, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OrdemLista {
  orc_id: string | number;
  orc_data?: string;
  orc_status?: string;
  req_id_composto?: string;
  fornecedor_completo?: string;
  fornecedor_nome?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Layout = 'bosch' | 'sabo' | 'randon' | 'mahle';

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: 'bosch', label: 'Bosch (TXT)' },
  { value: 'sabo', label: 'Sabo (TXT)' },
  { value: 'randon', label: 'Randon (CSV)' },
  { value: 'mahle', label: 'Mahle (Excel)' },
];

const statusLabel = (s?: string) =>
  ({ A: 'Aberta', F: 'Fechada', C: 'Cancelada', P: 'Pendente', E: 'Em Processamento' } as Record<string, string>)[
    s || ''
  ] || s || '';

export const ExportarPedidoFornecedorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [busca, setBusca] = useState('');
  const [ordens, setOrdens] = useState<OrdemLista[]>([]);
  const [loading, setLoading] = useState(false);
  // Só carrega a lista APÓS o usuário pesquisar (evita trazer tudo ao abrir).
  const [jaBuscou, setJaBuscou] = useState(false);
  // Layout escolhido por ordem (default Bosch).
  const [layoutPorOrdem, setLayoutPorOrdem] = useState<Record<string, Layout>>({});

  const carregar = useCallback(async (termo: string) => {
    // Busca só com filtro: campo vazio volta ao estado inicial (lista vazia).
    if (!termo) {
      setOrdens([]);
      setJaBuscou(false);
      return;
    }
    setLoading(true);
    setJaBuscou(true);
    try {
      // status=A → somente ordens ABERTAS
      const url = `/api/ordens/list?perPage=50&page=1&status=A${termo ? `&search=${encodeURIComponent(termo)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrdens(data?.data || []);
    } catch (e) {
      console.error('Erro ao buscar ordens:', e);
      setOrdens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ao abrir, começa com a lista vazia — a busca só acontece após o filtro.
  useEffect(() => {
    if (isOpen) {
      setBusca('');
      setOrdens([]);
      setJaBuscou(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getLayout = (id: string | number): Layout => layoutPorOrdem[String(id)] || 'bosch';

  const exportar = (id: string | number) => {
    const layout = getLayout(id);
    window.open(`/api/compras/ordens/${id}/exportar-pedido-fornecedor?layout=${layout}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-[#347AB6]" />
            <h3 className="text-lg font-semibold text-[#347AB6]">Exportar Pedido Fornecedor</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Busca */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                autoFocus
                placeholder="Pesquisar por ordem, fornecedor ou data..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && carregar(busca.trim())}
                className="pl-10"
              />
            </div>
            <Button onClick={() => carregar(busca.trim())} className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white">
              Pesquisar
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Selecione o layout do fornecedor e clique em Exportar. A referência usa a de fábrica do fornecedor
            (com fallback para a nossa) e a quantidade vem da ordem.
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : !jaBuscou ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              Digite um filtro (ordem, fornecedor ou data) e clique em Pesquisar.
            </div>
          ) : ordens.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">Nenhuma ordem encontrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left">Ordem</th>
                  <th className="px-3 py-2 text-left">Requisição</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left w-28">Data</th>
                  <th className="px-3 py-2 text-left w-24">Status</th>
                  <th className="px-3 py-2 text-left w-40">Layout</th>
                  <th className="px-3 py-2 text-center w-28">Ação</th>
                </tr>
              </thead>
              <tbody>
                {ordens.map((o) => (
                  <tr key={String(o.orc_id)} className="border-t border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/60">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{o.orc_id}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{o.req_id_composto || '-'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[260px]" title={o.fornecedor_completo || o.fornecedor_nome}>
                      {o.fornecedor_completo || o.fornecedor_nome || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {o.orc_data ? new Date(o.orc_data).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{statusLabel(o.orc_status)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={getLayout(o.orc_id)}
                        onChange={(e) =>
                          setLayoutPorOrdem((prev) => ({ ...prev, [String(o.orc_id)]: e.target.value as Layout }))
                        }
                        className="w-full border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100"
                      >
                        {LAYOUTS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        onClick={() => exportar(o.orc_id)}
                        className="bg-green-600 hover:bg-green-700 text-white h-8"
                      >
                        <FileDown size={14} className="mr-1" />
                        Exportar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportarPedidoFornecedorModal;
