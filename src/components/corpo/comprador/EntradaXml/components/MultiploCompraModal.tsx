import React, { useState } from 'react';
import { X, Calculator, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MultiploCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (novaQuantidade: number, senha: string) => void;
  quantidadeAtual: number;
  quantidadeNFe: number;
  produtoDescricao: string;
  multiplo: number;
  loading?: boolean;
}

export const MultiploCompraModal: React.FC<MultiploCompraModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  quantidadeAtual,
  quantidadeNFe,
  produtoDescricao,
  multiplo,
  loading = false
}) => {
  const [senha, setSenha] = useState('');
  const [senhaError, setSenhaError] = useState('');

  // Calcular o próximo múltiplo
  const calcularProximoMultiplo = (quantidade: number, mult: number): number => {
    if (mult <= 1) return quantidade;
    return Math.ceil(quantidade / mult) * mult;
  };

  const novaQuantidade = calcularProximoMultiplo(quantidadeNFe, multiplo);
  const diferenca = novaQuantidade - quantidadeAtual;

  const handleSubmit = () => {
    // Validar senha (aqui você pode implementar a validação real)
    if (!senha.trim()) {
      setSenhaError('Senha do gerente é obrigatória');
      return;
    }

    // Em produção, validar a senha via API
    if (senha !== 'admin123') { // Mock - remover em produção
      setSenhaError('Senha incorreta');
      return;
    }

    setSenhaError('');
    onConfirm(novaQuantidade, senha);
  };

  const handleSenhaChange = (value: string) => {
    setSenha(value);
    if (senhaError) setSenhaError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calculator className="h-6 w-6 text-orange-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Múltiplo de Compra
              </h2>
              <p className="text-sm text-gray-500">
                Ajuste automático de quantidade
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Produto Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Produto</h3>
            <p className="text-sm text-gray-700">{produtoDescricao}</p>
          </div>

          {/* Cálculo */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <label className="text-blue-700 font-medium">Quantidade NFe</label>
                <p className="text-lg font-bold text-blue-900">{quantidadeNFe}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <label className="text-purple-700 font-medium">Múltiplo</label>
                <p className="text-lg font-bold text-purple-900">{multiplo}</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-800">Cálculo Automático</span>
              </div>
              <div className="text-sm text-orange-700">
                <p>Quantidade atual do pedido: <strong>{quantidadeAtual}</strong></p>
                <p>Próximo múltiplo de {multiplo}: <strong>{novaQuantidade}</strong></p>
                <p>Quantidade a adicionar: <strong className="text-green-700">+{diferenca}</strong></p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Atenção</p>
              <p className="text-yellow-700 mt-1">
                Esta operação irá alterar automaticamente a quantidade do pedido de compra 
                para atender o múltiplo exigido pelo fornecedor.
              </p>
            </div>
          </div>

          {/* Senha do Gerente */}
          <div className="space-y-2">
            <Label htmlFor="senhaGerente" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-600" />
              Senha do Gerente *
            </Label>
            <Input
              id="senhaGerente"
              type="password"
              value={senha}
              onChange={(e) => handleSenhaChange(e.target.value)}
              placeholder="Digite a senha do gerente"
              className={senhaError ? 'border-red-300' : ''}
            />
            {senhaError && (
              <p className="text-sm text-red-600">{senhaError}</p>
            )}
            <p className="text-xs text-gray-500">
              Operação requer autorização gerencial
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !senha.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Aplicar Múltiplo
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};