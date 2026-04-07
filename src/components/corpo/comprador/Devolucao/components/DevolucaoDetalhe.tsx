/**
 * Modal de detalhe de uma devolução
 * Mostra info geral + tabela de itens
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DefaultButton } from '@/components/common/Buttons';
import api from '@/components/services/api';

interface DevolucaoDetalheProps {
  isOpen: boolean;
  devolucaoId?: number;
  onClose: () => void;
}

interface DevolucaoItem {
  id: number;
  produto_cod: string;
  produto_nome: string;
  unidade: string;
  qtd_esperada: number;
  qtd_recebida: number;
  qtd_devolucao: number;
  motivo: string;
  observacao: string;
}

interface DevolucaoData {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  fornecedor: string;
  nfe_numero: string;
  nfe_serie: string;
  status: string;
  total_itens: number;
  qtd_total_devolucao: number;
  observacao: string;
  created_by: string;
  created_at: string;
  itens: DevolucaoItem[];
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDENTE: { label: 'Pendente', variant: 'secondary' },
  EM_PROCESSAMENTO: { label: 'Em Processamento', variant: 'default' },
  CONCLUIDA: { label: 'Concluída', variant: 'outline' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};

export const DevolucaoDetalhe: React.FC<DevolucaoDetalheProps> = ({
  isOpen,
  devolucaoId,
  onClose,
}) => {
  const [data, setData] = useState<DevolucaoData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !devolucaoId) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/devolucao/${devolucaoId}`);
        if (response.data?.success) {
          setData(response.data.data);
        }
      } catch (err) {
        console.error('Erro ao carregar devolução:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, devolucaoId]);

  if (!isOpen) return null;

  const fmtDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const fmtQtd = (v: number) => {
    const num = parseFloat(String(v)) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const statusInfo = data ? (STATUS_MAP[data.status] || { label: data.status, variant: 'secondary' as const }) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-2">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Devolução #{data?.id || devolucaoId}
            </h2>
            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando...</span>
            </div>
          ) : data ? (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fornecedor</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.fornecedor || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">NFe</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {data.nfe_numero ? `${data.nfe_numero}/${data.nfe_serie}` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Nº Entrada</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.numero_entrada || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Data</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmtDate(data.created_at)}</p>
                </div>
              </div>

              {/* Tabela de itens */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-zinc-700">
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-center">Qtd Esperada</th>
                      <th className="px-3 py-2 text-center">Qtd Recebida</th>
                      <th className="px-3 py-2 text-center">Qtd Devolução</th>
                      <th className="px-3 py-2 text-center">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itens.map((item) => (
                      <tr key={item.id} className="border-t border-gray-200 dark:border-zinc-700">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.produto_cod}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[250px]">{item.produto_nome}</div>
                        </td>
                        <td className="px-3 py-2 text-center">{fmtQtd(item.qtd_esperada)}</td>
                        <td className="px-3 py-2 text-center">{fmtQtd(item.qtd_recebida)}</td>
                        <td className="px-3 py-2 text-center font-medium text-red-600 dark:text-red-400">
                          {fmtQtd(item.qtd_devolucao)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="secondary">{item.motivo}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Observacao */}
              {data.observacao && (
                <div className="mt-4">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Observação</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{data.observacao}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-500">Devolução não encontrada.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end">
          <DefaultButton
            text="Fechar"
            size="sm"
            variant="secondary"
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
};
