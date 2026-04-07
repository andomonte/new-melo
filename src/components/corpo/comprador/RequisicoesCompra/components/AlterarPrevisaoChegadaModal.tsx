import React, { useState } from 'react';
import { X, Calendar, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

interface AlterarPrevisaoChegadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordemId: number;
  previsaoAtual?: string;
  onSuccess: () => void;
}

export default function AlterarPrevisaoChegadaModal({
  isOpen,
  onClose,
  ordemId,
  previsaoAtual,
  onSuccess
}: AlterarPrevisaoChegadaModalProps) {
  const [novaPrevisao, setNovaPrevisao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen && previsaoAtual) {
      // Converter data para formato yyyy-MM-dd para o input
      try {
        const date = new Date(previsaoAtual);
        if (!isNaN(date.getTime())) {
          setNovaPrevisao(date.toISOString().split('T')[0]);
        }
      } catch {
        setNovaPrevisao('');
      }
    } else if (isOpen) {
      setNovaPrevisao('');
    }
    setMotivo('');
    setError('');
  }, [isOpen, previsaoAtual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novaPrevisao) {
      setError('Nova previsão é obrigatória');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ordens/alterarPrevisaoChegada', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ordemId,
          novaPrevisao,
          motivo: motivo || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao alterar previsão');
      }

      toast({
        title: "Sucesso",
        description: "Previsão de chegada alterada com sucesso!",
        variant: "default"
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || 'Erro interno do servidor';
      setError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="text-orange-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Alterar Previsão de Chegada
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ordem de Compra
            </label>
            <input
              type="text"
              value={ordemId}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nova Previsão de Chegada *
            </label>
            <DatePicker
              selected={novaPrevisao ? new Date(novaPrevisao + 'T00:00:00') : null}
              onChange={(date) => {
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setNovaPrevisao(`${year}-${month}-${day}`);
                } else {
                  setNovaPrevisao('');
                }
              }}
              dateFormat="dd/MM/yyyy"
              locale={ptBR}
              placeholderText="Selecione a data"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivo da Alteração (Opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da alteração..."
              disabled={loading}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}