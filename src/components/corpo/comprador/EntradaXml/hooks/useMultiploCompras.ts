import { useState } from 'react';

export interface MultiploComprasData {
  ordemId: string;
  produtoId: string;
  novaQuantidade: number;
  usuario: string;
  senha: string;
}

export interface MultiploComprasResponse {
  success: boolean;
  message: string;
}

export const useMultiploCompras = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alterarQuantidadeOrdem = async (data: MultiploComprasData): Promise<MultiploComprasResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/entrada-xml/multiplo-compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na alteração');
      }

      const result = await response.json();
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validarAlteracao = (
    quantidadeAtual: number,
    novaQuantidade: number,
    quantidadeAtendida: number = 0
  ) => {
    const validationErrors: string[] = [];

    if (novaQuantidade <= 0) {
      validationErrors.push('Nova quantidade deve ser maior que zero');
    }

    if (novaQuantidade === quantidadeAtual) {
      validationErrors.push('Nova quantidade deve ser diferente da atual');
    }

    if (quantidadeAtendida > 0) {
      validationErrors.push('Não é possível alterar ordem já parcialmente atendida');
    }

    return {
      isValid: validationErrors.length === 0,
      errors: validationErrors
    };
  };

  const clearError = () => setError(null);

  return {
    loading,
    error,
    alterarQuantidadeOrdem,
    validarAlteracao,
    clearError
  };
};