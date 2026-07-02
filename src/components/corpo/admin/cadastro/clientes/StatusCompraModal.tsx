import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, ShoppingCart, Loader2 } from 'lucide-react';
import { Cliente } from '@/data/clientes/clientes';

interface StatusCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onSuccess?: () => void;
}

interface StatusCompraDados {
  ultimaCompraData: string | null;
  maiorCompraData: string | null;
  maiorCompraTotal: number;
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function StatusCompraModal({
  isOpen,
  onClose,
  cliente,
}: StatusCompraModalProps) {
  const [dados, setDados] = useState<StatusCompraDados | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && cliente) {
      (async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/clientes/${cliente.codcli}/status-compra`,
          );
          if (!response.ok) throw new Error('Erro ao buscar dados');
          setDados(await response.json());
        } catch (_error) {
          toast.error('Falha ao carregar informações de compra');
          setDados(null);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isOpen, cliente]);

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-lg flex flex-col overflow-hidden">
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
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 bg-gray-50 dark:bg-zinc-900">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Última compra */}
              <div className="p-5 bg-white dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Data da Última Compra
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {dados?.ultimaCompraData || 'Sem compras'}
                </div>
              </div>

              {/* Maior compra */}
              <div className="p-5 bg-white dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Maior Compra
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {dados?.maiorCompraData
                    ? `${dados.maiorCompraData} — R$ ${brl(dados.maiorCompraTotal)}`
                    : 'Sem compras'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
