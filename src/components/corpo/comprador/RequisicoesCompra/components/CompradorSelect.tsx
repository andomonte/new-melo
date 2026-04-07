import React, { useState, useEffect } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';

interface Comprador {
  codcomprador: string;
  nome: string;
}

interface CompradorSelectProps {
  value?: string;
  onChange: (codcomprador: string, nome: string) => void;
  disabled?: boolean;
}

export const CompradorSelect: React.FC<CompradorSelectProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedComprador, setSelectedComprador] = useState<Comprador | null>(null);

  useEffect(() => {
    fetchCompradores();
  }, []);

  useEffect(() => {
    if (value && compradores.length > 0) {
      const comprador = compradores.find(c => c.codcomprador === value);
      setSelectedComprador(comprador || null);
    }
  }, [value, compradores]);

  const fetchCompradores = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/compras/compradores');
      setCompradores(response.data || []);
    } catch (error) {
      console.error('Erro ao buscar compradores:', error);
      setCompradores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompradorSelect = (comprador: Comprador) => {
    setSelectedComprador(comprador);
    onChange(comprador.codcomprador, comprador.nome);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={handleToggle}
        disabled={disabled}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {selectedComprador ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {selectedComprador.codcomprador}
              </span>
              <span className="text-gray-900 dark:text-gray-100 truncate">
                {selectedComprador.nome}
              </span>
            </div>
          ) : (
            <span className="text-gray-500">Selecione um comprador...</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="p-3 text-center text-sm text-gray-500">
              Carregando compradores...
            </div>
          )}
          
          {!loading && compradores.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum comprador encontrado
            </div>
          )}

          {compradores.map((comprador) => (
            <button
              key={comprador.codcomprador}
              className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none"
              onClick={() => handleCompradorSelect(comprador)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                  {comprador.codcomprador}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {comprador.nome}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};