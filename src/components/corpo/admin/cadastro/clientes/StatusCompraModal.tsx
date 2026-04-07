import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { X, ShoppingCart } from 'lucide-react';
import { Cliente } from '@/data/clientes/clientes';

interface StatusCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onSuccess: () => void;
}

const statusOptions = [
  { value: 'S', label: 'Ativo' },
  { value: 'N', label: 'Inativo' },
  { value: 'B', label: 'Bloqueado' },
  { value: 'P', label: 'Pendente' },
];

export function StatusCompraModal({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}: StatusCompraModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (isOpen && cliente) {
      fetchCurrentStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cliente]);

  const fetchCurrentStatus = async () => {
    if (!cliente) return;

    setLoadingStatus(true);
    try {
      const response = await fetch(
        `/api/clientes/${cliente.codcli}/status-compra`,
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar status');
      }

      const data = await response.json();
      setCurrentStatus(data.status);
      setSelectedStatus(data.status);
    } catch (_error) {
      toast.error('Falha ao carregar status atual');
      // Em caso de erro, define valores padrão
      setCurrentStatus('S');
      setSelectedStatus('S');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStatus) {
      toast.error('Selecione um status');
      return;
    }

    if (!cliente) {
      toast.error('Cliente não identificado');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/clientes/${cliente.codcli}/status-compra`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: selectedStatus }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar status');
      }

      toast.success(
        `Status de compra atualizado para ${
          statusOptions.find((s) => s.value === selectedStatus)?.label
        }`,
      );
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar status',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedStatus('');
    setCurrentStatus('');
    onClose();
  };

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="text-lg font-bold text-blue-600 dark:text-blue-300">
                Status de Compra
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Cliente: {cliente.codcli} - {cliente.nome}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50 dark:bg-zinc-900">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-md max-w-4xl mx-auto">
            <div className="space-y-8">
              {/* Status Atual */}
              {loadingStatus ? (
                <div className="text-center py-12 text-gray-500">
                  Carregando status atual...
                </div>
              ) : (
                <div className="p-6 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Status Atual:
                  </div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {statusOptions.find((s) => s.value === currentStatus)
                      ?.label || 'Não definido'}
                  </div>
                </div>
              )}

              {/* Novo Status */}
              <div className="grid gap-3">
                <Label htmlFor="status" className="text-lg font-semibold">
                  Novo Status de Compra
                </Label>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  disabled={loadingStatus || loading}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem
                        key={status.value}
                        value={status.value}
                        className="text-base py-3"
                      >
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Informação */}
              <div className="text-base text-gray-600 dark:text-gray-400 p-6 bg-gray-100 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h5 className="font-semibold mb-4 text-lg text-gray-800 dark:text-gray-200">
                  Descrição dos Status:
                </h5>
                <div className="space-y-3">
                  <div>
                    <strong className="text-green-600 dark:text-green-400">
                      Ativo (S):
                    </strong>
                    <span className="ml-2">
                      Cliente pode realizar compras normalmente
                    </span>
                  </div>
                  <div>
                    <strong className="text-gray-600 dark:text-gray-400">
                      Inativo (N):
                    </strong>
                    <span className="ml-2">
                      Cliente temporariamente sem permissão de compra
                    </span>
                  </div>
                  <div>
                    <strong className="text-red-600 dark:text-red-400">
                      Bloqueado (B):
                    </strong>
                    <span className="ml-2">
                      Cliente bloqueado por pendências
                    </span>
                  </div>
                  <div>
                    <strong className="text-yellow-600 dark:text-yellow-400">
                      Pendente (P):
                    </strong>
                    <span className="ml-2">Aguardando aprovação</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedStatus || loadingStatus}
          >
            {loading ? 'Atualizando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
