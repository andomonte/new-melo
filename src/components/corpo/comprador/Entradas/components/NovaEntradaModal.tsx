import React, { useState } from 'react';
import {
  X,
  Package,
  FileText,
  Calendar,
  DollarSign,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface NovaEntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EntradaFormData {
  numeroNF: string;
  serie: string;
  fornecedorId: string;
  dataEmissao: string;
  dataEntrada: string;
  valorTotal: string;
  valorProdutos: string;
  valorIPI: string;
  valorICMS: string;
  baseICMS: string;
  cfop: string;
  observacoes: string;
  tipoOperacao: string;
}

export const NovaEntradaModal: React.FC<NovaEntradaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EntradaFormData>({
    numeroNF: '',
    serie: '001',
    fornecedorId: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    dataEntrada: new Date().toISOString().split('T')[0],
    valorTotal: '',
    valorProdutos: '',
    valorIPI: '0',
    valorICMS: '',
    baseICMS: '',
    cfop: '',
    observacoes: '',
    tipoOperacao: '',
  });

  const [errors, setErrors] = useState<Partial<EntradaFormData>>({});
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleInputChange = (field: keyof EntradaFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Limpar erro do campo quando usuário digitar
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<EntradaFormData> = {};

    // Validações obrigatórias baseadas no sistema legado
    if (!formData.numeroNF || formData.numeroNF.length !== 9) {
      newErrors.numeroNF = 'Número da NF deve ter 9 dígitos';
    }

    if (!formData.serie) {
      newErrors.serie = 'Série é obrigatória';
    }

    if (!formData.fornecedorId) {
      newErrors.fornecedorId = 'Fornecedor é obrigatório';
    }

    if (!formData.valorTotal || parseFloat(formData.valorTotal) <= 0) {
      newErrors.valorTotal = 'Valor total deve ser maior que zero';
    }

    if (!formData.valorProdutos || parseFloat(formData.valorProdutos) <= 0) {
      newErrors.valorProdutos = 'Valor dos produtos deve ser maior que zero';
    }

    if (!formData.cfop) {
      newErrors.cfop = 'CFOP é obrigatório';
    }

    if (!formData.valorICMS) {
      newErrors.valorICMS = 'Alíquota ICMS é obrigatória';
    }

    if (!formData.baseICMS) {
      newErrors.baseICMS = 'Base de cálculo ICMS é obrigatória';
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
        description: 'Entrada criada com sucesso',
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar entrada',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-[#347AB6]" size={24} />
            Nova Entrada de Mercadoria
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados da Nota Fiscal */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText size={20} />
              Dados da Nota Fiscal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="numeroNF">Número da NF *</Label>
                <Input
                  id="numeroNF"
                  value={formData.numeroNF}
                  onChange={(e) =>
                    handleInputChange('numeroNF', e.target.value)
                  }
                  placeholder="000000000"
                  maxLength={9}
                  className={errors.numeroNF ? 'border-red-500' : ''}
                />
                {errors.numeroNF && (
                  <span className="text-red-500 text-sm">
                    {errors.numeroNF}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="serie">Série *</Label>
                <Input
                  id="serie"
                  value={formData.serie}
                  onChange={(e) => handleInputChange('serie', e.target.value)}
                  placeholder="001"
                  className={errors.serie ? 'border-red-500' : ''}
                />
                {errors.serie && (
                  <span className="text-red-500 text-sm">{errors.serie}</span>
                )}
              </div>

              <div>
                <Label htmlFor="cfop">CFOP *</Label>
                <Select
                  value={formData.cfop}
                  onValueChange={(value) => handleInputChange('cfop', value)}
                >
                  <SelectTrigger
                    className={errors.cfop ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Selecione o CFOP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1102">
                      1102 - Compra para comercialização
                    </SelectItem>
                    <SelectItem value="1101">
                      1101 - Compra para industrialização
                    </SelectItem>
                    <SelectItem value="1116">
                      1116 - Compra para utilização na prestação de serviço
                    </SelectItem>
                    <SelectItem value="2102">
                      2102 - Compra para comercialização (interestadual)
                    </SelectItem>
                    <SelectItem value="2101">
                      2101 - Compra para industrialização (interestadual)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.cfop && (
                  <span className="text-red-500 text-sm">{errors.cfop}</span>
                )}
              </div>
            </div>
          </div>

          {/* Fornecedor */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 size={20} />
              Fornecedor
            </h3>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="fornecedorId">Fornecedor *</Label>
                <Select
                  value={formData.fornecedorId}
                  onValueChange={(value) =>
                    handleInputChange('fornecedorId', value)
                  }
                >
                  <SelectTrigger
                    className={errors.fornecedorId ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12345">
                      12345 - Fornecedor Exemplo Ltda
                    </SelectItem>
                    <SelectItem value="67890">
                      67890 - Outro Fornecedor S.A.
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.fornecedorId && (
                  <span className="text-red-500 text-sm">
                    {errors.fornecedorId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Datas */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Datas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataEmissao">Data de Emissão *</Label>
                <Input
                  id="dataEmissao"
                  type="date"
                  value={formData.dataEmissao}
                  onChange={(e) =>
                    handleInputChange('dataEmissao', e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="dataEntrada">Data de Entrada *</Label>
                <Input
                  id="dataEntrada"
                  type="date"
                  value={formData.dataEntrada}
                  onChange={(e) =>
                    handleInputChange('dataEntrada', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Valores
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label htmlFor="valorIPI">Valor do IPI</Label>
                <Input
                  id="valorIPI"
                  type="number"
                  step="0.01"
                  value={formData.valorIPI}
                  onChange={(e) =>
                    handleInputChange('valorIPI', e.target.value)
                  }
                  placeholder="0,00"
                />
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

              <div>
                <Label htmlFor="valorICMS">Alíquota ICMS (%) *</Label>
                <Input
                  id="valorICMS"
                  type="number"
                  step="0.01"
                  value={formData.valorICMS}
                  onChange={(e) =>
                    handleInputChange('valorICMS', e.target.value)
                  }
                  placeholder="0,00"
                  className={errors.valorICMS ? 'border-red-500' : ''}
                />
                {errors.valorICMS && (
                  <span className="text-red-500 text-sm">
                    {errors.valorICMS}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="baseICMS">Base Cálculo ICMS *</Label>
                <Input
                  id="baseICMS"
                  type="number"
                  step="0.01"
                  value={formData.baseICMS}
                  onChange={(e) =>
                    handleInputChange('baseICMS', e.target.value)
                  }
                  placeholder="0,00"
                  className={errors.baseICMS ? 'border-red-500' : ''}
                />
                {errors.baseICMS && (
                  <span className="text-red-500 text-sm">
                    {errors.baseICMS}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
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
              {loading ? 'Salvando...' : 'Salvar Entrada'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
