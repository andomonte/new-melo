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

interface MudarClasseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClients: Set<string>;
  onSuccess: () => void;
}

interface ClassePagamento {
  codcc: string;
  descr: string;
}

export function MudarClasseModal({
  isOpen,
  onClose,
  selectedClients,
  onSuccess,
}: MudarClasseModalProps) {
  const [classes, setClasses] = useState<ClassePagamento[]>([]);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
    }
  }, [isOpen]);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch('/api/cClientes/get?perPage=999');
      if (!response.ok) throw new Error('Erro ao buscar classes');
      const data = await response.json();
      setClasses(data.data || []);
    } catch (_error) {
      toast.error('Falha ao carregar classes de pagamento');
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClasse) {
      toast.error('Selecione uma classe de pagamento');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/clientes/bulk-update-classe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteCodes: Array.from(selectedClients),
          codcc: selectedClasse,
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
      setSelectedClasse('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedClasse('');
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
              Alterar Classe de Pagamento
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
                <Label htmlFor="classe">Nova Classe de Pagamento</Label>
                <Select
                  value={selectedClasse}
                  onValueChange={setSelectedClasse}
                  disabled={loadingClasses}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingClasses ? 'Carregando...' : 'Selecione a classe'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classe) => (
                      <SelectItem key={classe.codcc} value={classe.codcc}>
                        {classe.codcc} - {classe.descr}
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
          <Button onClick={handleSubmit} disabled={loading || !selectedClasse}>
            {loading ? 'Atualizando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
