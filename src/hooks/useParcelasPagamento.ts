import { useState, useEffect } from 'react';

export interface ParcelaPagamento {
  id: number;
  data: string;
  dia: number;
  codvenda: string;
}

export interface ParcelaInput {
  dia: number;
}

/**
 * Hook para gerenciar parcelas de pagamento
 */
export function useParcelasPagamento(codvenda?: string) {
  const [parcelas, setParcelas] = useState<ParcelaPagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar parcelas de uma venda
  const buscarParcelas = async (codigoVenda: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/faturamento/gerenciar-parcelas?codvenda=${codigoVenda}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar parcelas');
      }

      const data = await response.json();
      setParcelas(data.parcelas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Salvar parcelas para uma venda
  const salvarParcelas = async (codigoVenda: string, novasParcelas: ParcelaInput[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/faturamento/gerenciar-parcelas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codvenda: codigoVenda,
          parcelas: novasParcelas,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar parcelas');
      }

      // Recarrega as parcelas após salvar
      await buscarParcelas(codigoVenda);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLoading(false);
    }
  };

  // Atualizar uma parcela específica
  const atualizarParcela = async (id: number, novoDia: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/faturamento/atualizar-parcela', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          dia: novoDia,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar parcela');
      }

      // Recarrega as parcelas após atualizar
      if (codvenda) {
        await buscarParcelas(codvenda);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLoading(false);
    }
  };

  // Remover todas as parcelas de uma venda
  const removerParcelas = async (codigoVenda: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/faturamento/gerenciar-parcelas?codvenda=${codigoVenda}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover parcelas');
      }

      setParcelas([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLoading(false);
    }
  };

  // Remover uma parcela específica
  const removerParcela = async (id: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/faturamento/remover-parcela?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover parcela');
      }

      // Recarrega as parcelas após remover
      if (codvenda) {
        await buscarParcelas(codvenda);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLoading(false);
    }
  };

  // Buscar parcelas automaticamente quando codvenda muda
  useEffect(() => {
    if (codvenda) {
      buscarParcelas(codvenda);
    } else {
      setParcelas([]);
    }
  }, [codvenda]);

  return {
    parcelas,
    loading,
    error,
    buscarParcelas,
    salvarParcelas,
    atualizarParcela,
    removerParcelas,
    removerParcela,
  };
}