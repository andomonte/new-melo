'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  User,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Calendar,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ItemVenda {
  codprod: string;
  ref: string;
  descr: string;
  qtd: number;
  prunit: number;
  prvenda_original: number;
  desconto_valor: number;
  desconto_percentual: number;
  total_item: number;
}

interface HistoricoCompra {
  codvenda: string;
  data: string;
  total: number;
  status: string;
}

interface TituloFinanceiro {
  documento: string;
  dt_venc: string;
  valor: number;
  dias_atraso: number;
  status: string;
}

interface AnaliseCliente {
  codcli: string;
  nome: string;
  nomefant: string;
  cpfcgc: string;
  status: string;
  tipo: string;
  limite: number;
  debito: number;
  limite_disponivel: number;
  atraso_permitido: number;
  claspgto: string;
  faixafin: string;
  media_compras_3m: number;
  maior_compra_12m: number;
  total_compras_12m: number;
  qtd_compras_12m: number;
  ultima_compra_data: string | null;
  ultima_compra_valor: number;
  dias_desde_ultima_compra: number | null;
  titulos_vencer: number;
  titulos_vencidos: number;
  atraso_medio: number;
  maior_atraso: number;
  qtd_titulos_abertos: number;
  qtd_titulos_vencidos: number;
  historico_compras: HistoricoCompra[];
  titulos_abertos: TituloFinanceiro[];
  score: 'BOM' | 'REGULAR' | 'RUIM' | 'NOVO';
  score_detalhes: string[];
  cliente_ativo: boolean;
}

interface AnaliseData {
  venda: {
    codvenda: string;
    nrovenda: string;
    data: string;
    total: number;
    status: string;
    bloqueada: string;
    tipo: string;
    obs: string;
    obsfat: string;
    codvend: string;
  };
  itens: ItemVenda[];
  cliente: AnaliseCliente;
  resumo_desconto: {
    total_desconto: number;
    percentual_medio: number;
    maior_desconto_percentual: number;
  };
}

interface ModalAnaliseLiberacaoProps {
  isOpen: boolean;
  onClose: () => void;
  codvenda: string;
  onLiberar: () => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

const ScoreBadge: React.FC<{ score: string }> = ({ score }) => {
  const configs = {
    BOM: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-200', icon: CheckCircle },
    REGULAR: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-200', icon: AlertCircle },
    RUIM: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-200', icon: XCircle },
    NOVO: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-200', icon: User },
  };
  const config = configs[score as keyof typeof configs] || configs.NOVO;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}>
      <Icon size={16} />
      {score}
    </span>
  );
};

const ModalAnaliseLiberacao: React.FC<ModalAnaliseLiberacaoProps> = ({
  isOpen,
  onClose,
  codvenda,
  onLiberar,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnaliseData | null>(null);
  const [activeTab, setActiveTab] = useState<'itens' | 'cliente' | 'financeiro' | 'historico'>('itens');

  useEffect(() => {
    if (isOpen && codvenda) {
      fetchAnalise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, codvenda]);

  const fetchAnalise = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/vendas/analise-liberacao?codvenda=${codvenda}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar análise');
      }
      const result = await response.json();
      setData(result);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar a análise.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { key: 'itens', label: 'Itens da Venda', icon: ShoppingCart },
    { key: 'cliente', label: 'Dados do Cliente', icon: User },
    { key: 'financeiro', label: 'Situação Financeira', icon: DollarSign },
    { key: 'historico', label: 'Histórico', icon: Clock },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[96vw] h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Análise para Liberação - Venda {codvenda}
            </h2>
            {data && <ScoreBadge score={data.cliente.score} />}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando análise...</span>
          </div>
        )}

        {/* Conteúdo */}
        {!loading && data && (
          <>
            {/* Resumo Superior */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {/* Valor da Venda */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor da Venda</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(data.venda.total)}
                  </p>
                </div>

                {/* Total Desconto */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Desconto</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(data.resumo_desconto.total_desconto)}
                  </p>
                </div>

                {/* % Médio Desconto */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">% Médio Desconto</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {data.resumo_desconto.percentual_medio.toFixed(1)}%
                  </p>
                </div>

                {/* Limite Disponível */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Limite Disponível</p>
                  <p className={`text-lg font-bold ${data.cliente.limite_disponivel > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(data.cliente.limite_disponivel)}
                  </p>
                </div>

                {/* Títulos Vencidos */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Títulos Vencidos</p>
                  <p className={`text-lg font-bold ${data.cliente.titulos_vencidos > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(data.cliente.titulos_vencidos)}
                  </p>
                </div>

                {/* Cliente Ativo */}
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status Cliente</p>
                  <p className={`text-lg font-bold ${data.cliente.cliente_ativo ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {data.cliente.cliente_ativo ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>

              {/* Alertas do Score */}
              {data.cliente.score_detalhes.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Pontos de Atenção:</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 list-disc list-inside">
                        {data.cliente.score_detalhes.map((detalhe, idx) => (
                          <li key={idx}>{detalhe}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-zinc-700 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo das Tabs */}
            <div className="flex-1 overflow-auto p-6">
              {/* Tab: Itens da Venda */}
              {activeTab === 'itens' && (
                <div className="overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">REF</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descrição</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço Original</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço Vendido</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">% Desconto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                      {data.itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.codprod}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.ref}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.descr}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">{item.qtd}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">{formatCurrency(item.prvenda_original)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.prunit)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${item.desconto_percentual > 10 ? 'text-red-600 dark:text-red-400' : item.desconto_percentual > 5 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {item.desconto_percentual > 0 ? `${item.desconto_percentual.toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(item.total_item)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: Dados do Cliente */}
              {activeTab === 'cliente' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <User size={20} />
                      Informações Básicas
                    </h3>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Código:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.codcli}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Razão Social:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.nome}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Nome Fantasia:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.nomefant || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">CNPJ/CPF:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.cpfcgc || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Status:</span>
                        <span className={`font-medium ${data.cliente.status === 'S' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {data.cliente.status === 'S' ? 'Ativo' : data.cliente.status === 'N' ? 'Inativo' : data.cliente.status || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <CreditCard size={20} />
                      Informações de Crédito
                    </h3>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Limite de Crédito:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(data.cliente.limite)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Débito Atual:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(data.cliente.debito)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Limite Disponível:</span>
                        <span className={`font-medium ${data.cliente.limite_disponivel > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(data.cliente.limite_disponivel)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Atraso Permitido:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.atraso_permitido} dias</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Classificação Pgto:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{data.cliente.claspgto || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Situação Financeira */}
              {activeTab === 'financeiro' && (
                <div className="space-y-6">
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Títulos a Vencer</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(data.cliente.titulos_vencer)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{data.cliente.qtd_titulos_abertos - data.cliente.qtd_titulos_vencidos} título(s)</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Títulos Vencidos</p>
                      <p className={`text-xl font-bold ${data.cliente.titulos_vencidos > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {formatCurrency(data.cliente.titulos_vencidos)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{data.cliente.qtd_titulos_vencidos} título(s)</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Atraso Médio</p>
                      <p className={`text-xl font-bold ${data.cliente.atraso_medio > 30 ? 'text-red-600 dark:text-red-400' : data.cliente.atraso_medio > 15 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {data.cliente.atraso_medio} dias
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Maior Atraso</p>
                      <p className={`text-xl font-bold ${data.cliente.maior_atraso > 60 ? 'text-red-600 dark:text-red-400' : data.cliente.maior_atraso > 30 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {data.cliente.maior_atraso} dias
                      </p>
                    </div>
                  </div>

                  {/* Tabela de títulos */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <FileText size={20} />
                      Títulos em Aberto
                    </h3>
                    {data.cliente.titulos_abertos.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum título em aberto</p>
                    ) : (
                      <div className="overflow-auto max-h-64">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                          <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Documento</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vencimento</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dias Atraso</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                            {data.cliente.titulos_abertos.map((titulo, idx) => (
                              <tr key={idx} className={titulo.dias_atraso > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{titulo.documento}</td>
                                <td className="px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300">{formatDate(titulo.dt_venc)}</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(titulo.valor)}</td>
                                <td className={`px-4 py-2 text-sm text-center font-semibold ${titulo.dias_atraso > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {titulo.dias_atraso > 0 ? titulo.dias_atraso : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    titulo.status === 'VENCIDO'
                                      ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                                  }`}>
                                    {titulo.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Histórico */}
              {activeTab === 'historico' && (
                <div className="space-y-6">
                  {/* Estatísticas de compras */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Média Compras (3 meses)</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(data.cliente.media_compras_3m)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Maior Compra (12 meses)</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.cliente.maior_compra_12m)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Compras (12 meses)</p>
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(data.cliente.total_compras_12m)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{data.cliente.qtd_compras_12m} compras</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Última Compra</p>
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatDate(data.cliente.ultima_compra_data)}</p>
                      {data.cliente.dias_desde_ultima_compra !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">há {data.cliente.dias_desde_ultima_compra} dias</p>
                      )}
                    </div>
                  </div>

                  {/* Tabela de histórico */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <Calendar size={20} />
                      Últimas Compras
                    </h3>
                    {data.cliente.historico_compras.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma compra registrada</p>
                    ) : (
                      <div className="overflow-auto max-h-64">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                          <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código Venda</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                            {data.cliente.historico_compras.map((compra, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{compra.codvenda}</td>
                                <td className="px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300">{formatDate(compra.data)}</td>
                                <td className="px-4 py-2 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(compra.total)}</td>
                                <td className="px-4 py-2 text-sm text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    compra.status === 'F' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
                                    compra.status === 'B' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' :
                                    compra.status === 'N' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' :
                                    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                  }`}>
                                    {compra.status === 'F' ? 'Faturada' :
                                     compra.status === 'B' ? 'Bloqueada' :
                                     compra.status === 'N' ? 'Normal' :
                                     compra.status || '-'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com ações */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {data.venda.obs && <p><strong>Obs:</strong> {data.venda.obs}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={onLiberar}
                  className="px-6 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Liberar Venda
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModalAnaliseLiberacao;
