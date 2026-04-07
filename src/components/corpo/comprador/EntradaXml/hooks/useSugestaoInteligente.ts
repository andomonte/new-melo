import { useState } from 'react';

interface ProdutoSugerido {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  estoque: number;
  tipo: string;
  confianca: 'alta' | 'media';
}

interface SugestaoData {
  success: boolean;
  sugestao?: ProdutoSugerido;   // ÚNICA sugestão (backward compatibility)
  sugestoes?: ProdutoSugerido[]; // MÚLTIPLAS sugestões
  jaVisto: boolean;
  message?: string;
}

export const useSugestaoInteligente = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarSugestao = async (
    referenciaNFe: string,
    codCredor: string,
    codMarca?: string
  ): Promise<SugestaoData | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/entrada-xml/sugerir-produto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referenciaNFe,
          codCredor,
          codMarca
        })
      });

      const data: SugestaoData = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao buscar sugestão');
      }

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ Erro ao buscar sugestão:', errorMessage);
      setError(errorMessage);
      return null;

    } finally {
      setLoading(false);
    }
  };

  return {
    buscarSugestao,
    loading,
    error
  };
};
