/**
 * Modal para selecionar pagamentos antecipados que podem ser usados
 * para configurar cobrança de uma NFe antes de associá-la a uma ordem
 */

import React, { useState, useEffect } from 'react';
import { X, DollarSign, CheckCircle, Clock, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { NFeDTO } from '../types';

interface PagamentoAntecipado {
  ordem_id: number;
  req_id_composto: string;
  valor: number;
  vencimento: string;
  data_emissao: string;
  status: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  cod_pgto: string;
}

interface NFeInfo {
  numero: string;
  valor_total: number;
  fornecedor_cnpj: string;
  fornecedor_nome: string;
}

interface SelecionarPagamentosAntecipadosProps {
  isOpen: boolean;
  onClose: () => void;
  nfe: NFeDTO;
  onProsseguir: (ordensIds: number[], valorTotalAntecipado: number) => void;
  onSemPagamentos: () => void;
}

export const SelecionarPagamentosAntecipados: React.FC<SelecionarPagamentosAntecipadosProps> = ({
  isOpen,
  onClose,
  nfe,
  onProsseguir,
  onSemPagamentos
}) => {
  const { toast } = useToast();
  const [pagamentos, setPagamentos] = useState<PagamentoAntecipado[]>([]);
  const [nfeInfo, setNfeInfo] = useState<NFeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && nfe?.id) {
      buscarPagamentos();
    }
  }, [isOpen, nfe?.id]);

  const buscarPagamentos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/entrada-xml/buscar-pagamentos-antecipados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfeId: nfe.id })
      });

      const data = await response.json();

      if (data.success) {
        setPagamentos(data.data.pagamentos || []);
        setNfeInfo(data.data.nfe_info || null);

        // Se não encontrou pagamentos, chamar callback
        if (!data.data.pagamentos || data.data.pagamentos.length === 0) {
          toast({
            title: 'Nenhum pagamento antecipado encontrado',
            description: 'Não foram encontradas ordens com pagamento antecipado para este fornecedor.',
            variant: 'default'
          });
          onSemPagamentos();
        }
      } else {
        toast({
          title: 'Erro ao buscar pagamentos',
          description: data.error || 'Erro desconhecido',
          variant: 'destructive'
        });
        onSemPagamentos();
      }
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pagamentos antecipados',
        variant: 'destructive'
      });
      onSemPagamentos();
    } finally {
      setLoading(false);
    }
  };

  const toggleSelecao = (ordemId: number) => {
    setSelecionados(prev => {
      const novos = new Set(prev);
      if (novos.has(ordemId)) {
        novos.delete(ordemId);
      } else {
        novos.add(ordemId);
      }
      return novos;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === pagamentosFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pagamentosFiltrados.map(p => p.ordem_id)));
    }
  };

  const calcularTotalSelecionado = () => {
    return pagamentos
      .filter(p => selecionados.has(p.ordem_id))
      .reduce((acc, p) => acc + p.valor, 0);
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle size={12} />
            Pago
          </span>
        );
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock size={12} />
            Pendente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  const handleProsseguir = () => {
    if (selecionados.size === 0) {
      toast({
        title: 'Selecione ao menos um pagamento',
        description: 'Você precisa selecionar ao menos um pagamento antecipado para prosseguir.',
        variant: 'destructive'
      });
      return;
    }

    const ordensIds = Array.from(selecionados);
    const valorTotal = calcularTotalSelecionado();
    onProsseguir(ordensIds, valorTotal);
  };

  // Filtrar pagamentos pela busca
  const pagamentosFiltrados = pagamentos.filter(p => {
    const termo = searchTerm.toLowerCase();
    return (
      p.ordem_id.toString().includes(termo) ||
      p.req_id_composto.toLowerCase().includes(termo) ||
      p.fornecedor_nome.toLowerCase().includes(termo) ||
      formatarValor(p.valor).toLowerCase().includes(termo)
    );
  });

  if (!isOpen) return null;

  // Se não há pagamentos e não está carregando, não mostra o modal
  if (!loading && pagamentos.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DollarSign className="text-green-500" size={28} />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Selecionar Pagamentos Antecipados
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                NFe {nfe.numeroNF}/{nfe.serie} - {nfeInfo?.fornecedor_nome || nfe.emitente}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Resumo */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor da NFe</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatarValor(nfeInfo?.valor_total || nfe.valorTotal || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pagamentos Disponíveis</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {pagamentos.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Selecionados</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {selecionados.size}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Selecionado</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatarValor(calcularTotalSelecionado())}
              </p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por ordem, valor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : pagamentosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <AlertCircle size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Nenhum pagamento encontrado</p>
              <p className="text-sm">Tente ajustar os filtros de busca</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selecionados.size === pagamentosFiltrados.length && pagamentosFiltrados.length > 0}
                        onChange={toggleTodos}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ordem
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data Emissão
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {pagamentosFiltrados.map((pagamento) => (
                    <tr
                      key={pagamento.ordem_id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer ${
                        selecionados.has(pagamento.ordem_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => toggleSelecao(pagamento.ordem_id)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selecionados.has(pagamento.ordem_id)}
                          onChange={() => toggleSelecao(pagamento.ordem_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            #{pagamento.ordem_id}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Req. {pagamento.req_id_composto}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatarValor(pagamento.valor)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatarData(pagamento.vencimento)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatarData(pagamento.data_emissao)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(pagamento.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Aviso de diferença de valor */}
        {selecionados.size > 0 && (
          <div className="px-6 pb-4">
            {calcularTotalSelecionado() < (nfeInfo?.valor_total || nfe.valorTotal || 0) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Valor dos pagamentos selecionados é menor que o valor da NFe
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Diferença: {formatarValor((nfeInfo?.valor_total || nfe.valorTotal || 0) - calcularTotalSelecionado())}
                      {' '}- Você poderá parcelar o restante na próxima tela.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {calcularTotalSelecionado() > (nfeInfo?.valor_total || nfe.valorTotal || 0) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">
                      Valor dos pagamentos selecionados excede o valor da NFe
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Excesso: {formatarValor(calcularTotalSelecionado() - (nfeInfo?.valor_total || nfe.valorTotal || 0))}
                      {' '}- O valor antecipado será usado proporcionalmente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <Button onClick={onSemPagamentos} variant="outline">
            Pular (sem antecipado)
          </Button>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleProsseguir}
              disabled={selecionados.size === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Prosseguir ({selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
