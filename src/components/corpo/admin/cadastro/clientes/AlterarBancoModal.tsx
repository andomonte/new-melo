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
import { X } from 'lucide-react';

interface AlterarBancoModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClients: Set<string>;
  onSuccess: () => void;
}

interface Banco {
  banco: string;
  nome: string;
}

export function AlterarBancoModal({
  isOpen,
  onClose,
  selectedClients,
  onSuccess,
}: AlterarBancoModalProps) {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [selectedBanco, setSelectedBanco] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingBancos, setLoadingBancos] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBancos();
    }
  }, [isOpen]);

  const fetchBancos = async () => {
    setLoadingBancos(true);
    try {
      const response = await fetch('/api/bancos/get?perPage=9999');
      if (!response.ok) throw new Error('Erro ao buscar bancos');
      const result = await response.json();
      setBancos(result.data || []);
    } catch (_error) {
      toast.error('Falha ao carregar bancos');
    } finally {
      setLoadingBancos(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBanco) {
      toast.error('Selecione um banco');
      return;
    }

    setLoading(true);
    try {
      // Campo banco em dbclien é VARCHAR(1), enviar apenas primeiro caractere
      const bancoCode = selectedBanco.substring(0, 1);

      const response = await fetch('/api/clientes/bulk-update-banco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteCodes: Array.from(selectedClients),
          banco: bancoCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar clientes');
      }

      const result = await response.json();

      toast.success(`${result.updated} cliente(s) atualizado(s)`);

      onSuccess();
      onClose();
      setSelectedBanco('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedBanco('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-md flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
          <div>
            <h4 className="text-lg font-bold text-blue-600 dark:text-blue-300">
              Alterar Banco de Cliente
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {selectedClients.size} cliente(s) selecionado(s)
            </p>
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
        <div className="p-6 bg-gray-50 dark:bg-zinc-900">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-md">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="banco">Novo Banco</Label>
                <Select
                  value={selectedBanco}
                  onValueChange={setSelectedBanco}
                  disabled={loadingBancos}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingBancos ? 'Carregando...' : 'Selecione o banco'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map((banco) => (
                      <SelectItem key={banco.banco} value={banco.banco}>
                        {banco.banco} - {banco.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedBanco}>
            {loading ? 'Atualizando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
