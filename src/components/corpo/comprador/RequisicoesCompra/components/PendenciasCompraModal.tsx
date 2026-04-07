/**
 * Modal de Relatório de Pendências de Compra
 *
 * Exibe grid com todos os itens pendentes de recebimento
 * Similar à aba tabPendencia do sistema legado
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
  TrendingUp,
  X
} from 'lucide-react';
import api from '@/components/services/api';
import { useToast } from '@/hooks/use-toast';

interface PendenciaItem {
  ordemId: number;
  dataOrdem: string;
  statusOrdem: string;
  previsaoChegada: string | null;
  requisicao: string;
  codFornecedor: string;
  fornecedor: string;
  comprador: string | null;
  localEntrega: string | null;
  localDestino: string | null;
  codProduto: string;
  referencia: string;
  descricao: string;
  aplicacao: string | null;
  codMarca: string | null;
  marca: string | null;
  codGrupo: string | null;
  grupo: string | null;
  qtdPedida: number;
  qtdAtendida: number;
  qtdFechada: number;
  pendencia: number;
  estoque: number;
  reservado: number;
  disponivel: number;
  precoUnit: number;
  valorTotal: number;
  valorPendente: number;
}

interface Totais {
  totalItens: number;
  totalPendencia: number;
  valorTotalPendente: number;
}

interface Filtros {
  filiais: string[];
  marcas: { codmarca: string; descr: string }[];
}

interface PendenciasCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PendenciasCompraModal({ isOpen, onClose }: PendenciasCompraModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pendencias, setPendencias] = useState<PendenciaItem[]>([]);
  const [totais, setTotais] = useState<Totais>({ totalItens: 0, totalPendencia: 0, valorTotalPendente: 0 });
  const [filtrosDisponiveis, setFiltrosDisponiveis] = useState<Filtros>({ filiais: [], marcas: [] });

  // Filtros
  const [filialSelecionada, setFilialSelecionada] = useState<string>('TODAS');
  const [marcaSelecionada, setMarcaSelecionada] = useState<string>('');
  const [buscaReferencia, setBuscaReferencia] = useState<string>('');

  // Paginacao
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Carregar dados
  const carregarPendencias = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('statusOrdem', 'A');
      params.append('page', page.toString());
      params.append('perPage', perPage.toString());

      if (filialSelecionada && filialSelecionada !== 'TODAS') {
        params.append('filial', filialSelecionada);
      }
      if (marcaSelecionada) {
        params.append('marca', marcaSelecionada);
      }

      const response = await api.get(`/api/compras/ordens/pendencias?${params.toString()}`);

      if (response.data.success) {
        setPendencias(response.data.data || []);
        setTotais(response.data.totais || { totalItens: 0, totalPendencia: 0, valorTotalPendente: 0 });
        setFiltrosDisponiveis(response.data.filtros || { filiais: [], marcas: [] });
        setTotalPages(response.data.meta?.totalPages || 1);
        setTotalItems(response.data.meta?.total || 0);
      } else {
        toast({
          title: 'Erro',
          description: response.data.error || 'Erro ao carregar pendencias',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar pendencias:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao conectar com o servidor',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, perPage, filialSelecionada, marcaSelecionada, toast]);

  useEffect(() => {
    if (isOpen) {
      carregarPendencias();
    }
  }, [isOpen, carregarPendencias]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setPage(1);
      setFilialSelecionada('TODAS');
      setMarcaSelecionada('');
      setBuscaReferencia('');
    }
  }, [isOpen]);

  // Filtrar por referencia localmente
  const pendenciasFiltradas = buscaReferencia
    ? pendencias.filter(p =>
        p.referencia?.toLowerCase().includes(buscaReferencia.toLowerCase()) ||
        p.descricao?.toLowerCase().includes(buscaReferencia.toLowerCase()) ||
        p.codProduto?.toLowerCase().includes(buscaReferencia.toLowerCase())
      )
    : pendencias;

  // Exportar para Excel
  const handleExportarExcel = async () => {
    try {
      toast({
        title: 'Gerando relatório...',
        description: 'Aguarde, exportando pendências para Excel'
      });

      const params = new URLSearchParams();
      params.append('statusOrdem', 'A');
      if (filialSelecionada && filialSelecionada !== 'TODAS') {
        params.append('filial', filialSelecionada);
      }
      if (marcaSelecionada) {
        params.append('marca', marcaSelecionada);
      }

      const response = await fetch(`/api/compras/ordens/pendencias-excel?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pendencias-compra-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao exportar relatório',
        variant: 'destructive'
      });
    }
  };

  // Formatar data
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-[95vw] h-[90vh] flex flex-col shadow-2xl">
        {/* Header do Modal */}
        <div className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 p-4 rounded-t-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-amber-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Relatório de Pendências de Compra
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Filtro Filial */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Filial:</label>
              <select
                value={filialSelecionada}
                onChange={(e) => {
                  setFilialSelecionada(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
              >
                <option value="TODAS">Todas</option>
                {filtrosDisponiveis.filiais.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Filtro Marca */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Marca:</label>
              <select
                value={marcaSelecionada}
                onChange={(e) => {
                  setMarcaSelecionada(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todas</option>
                {filtrosDisponiveis.marcas.map(m => (
                  <option key={m.codmarca} value={m.codmarca}>{m.descr}</option>
                ))}
              </select>
            </div>

            {/* Busca por referencia */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar referência..."
                value={buscaReferencia}
                onChange={(e) => setBuscaReferencia(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Botoes */}
            <div className="flex items-center gap-2">
              <button
                onClick={carregarPendencias}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={handleExportarExcel}
                disabled={loading || pendencias.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total de Itens</p>
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{totais.totalItens}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Package className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400">Unidades Pendentes</p>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{totais.totalPendencia.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Valor Total Pendente</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-300">{formatCurrency(totais.valorTotalPendente)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-700 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Ordem</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Data</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Previsão</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Fornecedor</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Local</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Referência</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Descrição</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Marca</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Pedido</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Atendido</th>
                <th className="px-3 py-2 text-right font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30">Pendência</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Estoque</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Valor Pend.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando pendências...
                  </td>
                </tr>
              ) : pendenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhuma pendência encontrada
                  </td>
                </tr>
              ) : (
                pendenciasFiltradas.map((item, index) => (
                  <tr
                    key={`${item.ordemId}-${item.codProduto}-${index}`}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                  >
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {item.ordemId}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {formatDate(item.dataOrdem)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {formatDate(item.previsaoChegada)}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={item.fornecedor}>
                      {item.fornecedor}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {item.localEntrega || '-'}
                    </td>
                    <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-medium">
                      {item.referencia}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[250px] truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {item.marca || '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                      {item.qtdPedida}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {item.qtdAtendida}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                      {item.pendencia}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {item.estoque}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600 dark:text-green-400 font-medium">
                      {formatCurrency(item.valorPendente)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        <div className="bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 px-4 py-3 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Mostrando {pendenciasFiltradas.length} de {totalItems} itens
            </div>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
              </select>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-1.5 border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
