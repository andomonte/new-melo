import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface EntradaDTO {
  id: string;
  numeroNF: string;
  serie: string;
  fornecedor: string;
  fornecedorNome: string;
  dataEmissao: string;
  dataEntrada: string;
  valorTotal: number;
  valorProdutos: number;
  status: 'P' | 'C' | 'F';
  chaveNFe?: string;
  tipoEntrada: 'MANUAL' | 'XML';
  observacoes?: string;
}

interface EditEntradaModalProps {
  isOpen: boolean;
  entrada: EntradaDTO;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditFormData {
  dataEntrada: string;
  valorTotal: string;
  valorProdutos: string;
  observacoes: string;
}

export const EditEntradaModal: React.FC<EditEntradaModalProps> = ({
  isOpen,
  entrada,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EditFormData>({
    dataEntrada: '',
    valorTotal: '',
    valorProdutos: '',
    observacoes: '',
  });

  const [errors, setErrors] = useState<Partial<EditFormData>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && entrada) {
      setFormData({
        dataEntrada:
          entrada.dataEntrada || new Date().toISOString().split('T')[0],
        valorTotal: entrada.valorTotal.toString(),
        valorProdutos: entrada.valorProdutos.toString(),
        observacoes: entrada.observacoes || '',
      });
    }
  }, [isOpen, entrada]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<EditFormData> = {};

    if (!formData.valorTotal || parseFloat(formData.valorTotal) <= 0) {
      newErrors.valorTotal = 'Valor total deve ser maior que zero';
    }

    if (!formData.valorProdutos || parseFloat(formData.valorProdutos) <= 0) {
      newErrors.valorProdutos = 'Valor dos produtos deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Erro de validação',
        description: 'Por favor, corrija os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: Implementar chamada para API

      toast({
        title: 'Sucesso',
        description: 'Entrada atualizada com sucesso',
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar entrada',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Função removida - não utilizada

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Edit3 className="text-[#347AB6]" size={24} />
            Editar Entrada - NF {entrada.numeroNF}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Informações Somente Leitura */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Informações da Nota Fiscal (Somente Leitura)
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Número:
                </span>
                <span className="ml-2 font-medium">{entrada.numeroNF}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Série:</span>
                <span className="ml-2 font-medium">{entrada.serie}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Fornecedor:
                </span>
                <span className="ml-2 font-medium">
                  {entrada.fornecedorNome}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                <span className="ml-2 font-medium">{entrada.tipoEntrada}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="dataEntrada">Data de Entrada</Label>
              <Input
                id="dataEntrada"
                type="date"
                value={formData.dataEntrada}
                onChange={(e) =>
                  handleInputChange('dataEntrada', e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valorProdutos">Valor dos Produtos *</Label>
                <Input
                  id="valorProdutos"
                  type="number"
                  step="0.01"
                  value={formData.valorProdutos}
                  onChange={(e) =>
                    handleInputChange('valorProdutos', e.target.value)
                  }
                  placeholder="0,00"
                  className={errors.valorProdutos ? 'border-red-500' : ''}
                />
                {errors.valorProdutos && (
                  <span className="text-red-500 text-sm">
                    {errors.valorProdutos}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="valorTotal">Valor Total *</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  step="0.01"
                  value={formData.valorTotal}
                  onChange={(e) =>
                    handleInputChange('valorTotal', e.target.value)
                  }
                  placeholder="0,00"
                  className={errors.valorTotal ? 'border-red-500' : ''}
                />
                {errors.valorTotal && (
                  <span className="text-red-500 text-sm">
                    {errors.valorTotal}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  handleInputChange('observacoes', e.target.value)
                }
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            {/* Aviso */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Atenção:</strong> Apenas alguns campos podem ser
                editados após a criação da entrada. Dados da nota fiscal e
                fornecedor não podem ser alterados.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
