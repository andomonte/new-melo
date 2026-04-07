import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CentroCusto {
  cod_ccusto: string;
  descr: string;
  tipo: string;
}

interface CentroCustoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (centroCusto: CentroCusto) => void;
}

export const CentroCustoModal: React.FC<CentroCustoModalProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [filteredCentros, setFilteredCentros] = useState<CentroCusto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCentro, setSelectedCentro] = useState<CentroCusto | null>(null);

  useEffect(() => {
    if (isOpen) {
      carregarCentrosCusto();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = centrosCusto.filter(centro =>
        centro.cod_ccusto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        centro.descr.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCentros(filtered);
    } else {
      setFilteredCentros(centrosCusto);
    }
  }, [searchTerm, centrosCusto]);

  const carregarCentrosCusto = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cadastros/centros-custo');
      const data = await response.json();

      if (data.success) {
        setCentrosCusto(data.data);
        setFilteredCentros(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedCentro) {
      onSelect(selectedCentro);
      onClose();
      setSearchTerm('');
      setSelectedCentro(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Selecionar Centro de Custo
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Buscar por código ou descrição
              </Label>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o código ou descrição..."
                className="w-full"
              />
            </div>
            <Button
              onClick={carregarCentrosCusto}
              disabled={loading}
              className="mt-6"
              variant="outline"
            >
              <Search size={16} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCentros.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Nenhum centro de custo encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCentros.map((centro) => (
                <div
                  key={centro.cod_ccusto}
                  onClick={() => setSelectedCentro(centro)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCentro?.cod_ccusto === centro.cod_ccusto
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {centro.cod_ccusto}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300">
                          {centro.tipo === 'A' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {centro.descr}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-zinc-700 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedCentro}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Selecionar
          </Button>
        </div>
      </div>
    </div>
  );
};
