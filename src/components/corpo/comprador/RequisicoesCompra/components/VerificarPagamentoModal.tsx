import React, { useState, useEffect } from 'react';
import { X, DollarSign, CheckCircle, XCircle, Clock, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrdemCompraDTO } from '@/types/compras/requisition';
import { useToast } from '@/hooks/use-toast';

interface Parcela {
  id: number;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  status: string;
  banco: string;
  tipo_documento: string;
  prazo_dias: number;
  valor_pago: number;
  pagamento_realizado: boolean;
  pagamento_cancelado: boolean;
  data_emissao: string;
  observacao_pagamento: string;
  cod_pgto: string;
  is_entrada?: boolean;
  total_parcelas_normais?: number;
}

interface VerificarPagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemCompraDTO;
  onSuccess?: () => void;
}

export const VerificarPagamentoModal: React.FC<VerificarPagamentoModalProps> = ({
  isOpen,
  onClose,
  ordem,
  onSuccess
}) => {
  const { toast } = useToast();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      buscarParcelas();
    }
  }, [isOpen, ordem.orc_id]);

  const buscarParcelas = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ordens/${ordem.orc_id}/parcelas`);
      const data = await response.json();

      if (data.success) {
        setParcelas(data.data);
      } else {
        toast({
          title: 'Erro ao buscar parcelas',
          description: data.error || 'Erro desconhecido',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao buscar parcelas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as parcelas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (parcela: Parcela) => {
    if (parcela.pagamento_cancelado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <XCircle size={12} />
          Cancelado
        </span>
      );
    }

    if (parcela.pagamento_realizado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle size={12} />
          Pago
        </span>
      );
    }

    const dataVencimento = new Date(parcela.data_vencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataVencimento < hoje) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
          <Clock size={12} />
          Vencido
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
        <Clock size={12} />
        Pendente
      </span>
    );
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

  const calcularTotalParcelas = () => {
    return parcelas.reduce((acc, p) => acc + p.valor_parcela, 0);
  };

  const calcularTotalPago = () => {
    return parcelas.reduce((acc, p) => acc + (p.pagamento_realizado ? p.valor_pago : 0), 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DollarSign className="text-blue-500" size={28} />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Verificação de Pagamento
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ordem de Compra #{ordem.orc_id} - {ordem.fornecedor_nome}
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total da Ordem</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatarValor(ordem.orc_valor_total || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Parcelas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatarValor(calcularTotalParcelas())}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Pago</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatarValor(calcularTotalPago())}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Parcelas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {parcelas.filter(p => !p.is_entrada).length}
              </p>
            </div>
          </div>
        </div>

        {/* Grid de Parcelas */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : parcelas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <DollarSign size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Nenhuma parcela configurada</p>
              <p className="text-sm">Configure o pagamento primeiro</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Parcela
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data Pagamento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Banco
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Comprovante
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {parcelas.map((parcela) => {
                    // Determinar label da parcela
                    let labelParcela = '';
                    if (parcela.is_entrada) {
                      labelParcela = 'Pagamento Antecipado';
                    } else {
                      labelParcela = `${parcela.numero_parcela}/${parcela.total_parcelas_normais || parcelas.length}`;
                    }

                    return (
                    <tr key={parcela.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {labelParcela}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatarValor(parcela.valor_parcela)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatarData(parcela.data_vencimento)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {parcela.pagamento_realizado ? formatarData(parcela.data_emissao) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(parcela)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {parcela.banco || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {parcela.tipo_documento || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {parcela.pagamento_realizado ? (
                          <button
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                            onClick={() => {
                              toast({
                                title: 'Comprovante de Pagamento',
                                description: `Parcela: ${parcela.is_entrada ? 'Pagamento Antecipado' : `${parcela.numero_parcela}/${parcela.total_parcelas_normais}`}\nValor: ${formatarValor(parcela.valor_pago)}\nData: ${formatarData(parcela.data_emissao)}\nBanco: ${parcela.banco}\nDocumento: ${parcela.tipo_documento}\n\nCod. Pagamento: ${parcela.cod_pgto}`
                              });
                            }}
                          >
                            <Eye size={16} />
                            Visualizar
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Observações */}
          {parcelas.length > 0 && parcelas.some(p => p.observacao_pagamento) && (
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Observações</h4>
              {parcelas
                .filter(p => p.observacao_pagamento)
                .map((parcela, idx) => {
                  const labelParcela = parcela.is_entrada
                    ? 'Pagamento Antecipado'
                    : `Parcela ${parcela.numero_parcela}`;

                  return (
                    <p key={idx} className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                      <strong>{labelParcela}:</strong> {parcela.observacao_pagamento}
                    </p>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
