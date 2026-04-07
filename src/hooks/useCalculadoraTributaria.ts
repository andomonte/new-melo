// src/hooks/useCalculadoraTributaria.ts
/**
 * Hook para facilitar o uso da Calculadora Tributária do Governo
 * no processo de vendas
 */

import { useState, useCallback } from 'react';

export interface ProdutoVenda {
  codProd: string;
  descricao?: string;
  ncm?: string;
  quantidade: number;
  valorUnitario: number;
}

export interface ImpostoCalculado {
  tipo: string;
  aliquota: number;
  base: number;
  valor: number;
}

export interface ResultadoCalculoImpostos {
  sucesso: boolean;
  produto: {
    codigo: string;
    descricao: string;
    ncm: string;
    cest?: string;
    unidade?: string;
  };
  operacao: {
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    ufOrigem: string;
    ufDestino: string;
  };
  impostos: ImpostoCalculado[];
  totalImpostos: number;
  valorTotalComImpostos: number;
  erro?: string;
}

export function useCalculadoraTributaria() {
  const [isCalculando, setIsCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCalculoImpostos | null>(
    null
  );

  /**
   * Calcula os impostos para um produto usando a API do governo
   */
  const calcularImpostos = useCallback(
    async (
      produto: ProdutoVenda,
      opcoes?: {
        codCli?: string;
        ufOrigem?: string;
        ufDestino?: string;
        tipoOperacao?: 'venda' | 'importacao' | 'industrializacao';
        finalidade?: 'consumo' | 'revenda' | 'industrializacao';
        regimeTributario?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
      }
    ): Promise<ResultadoCalculoImpostos | null> => {
      setIsCalculando(true);
      setErro(null);
      setResultado(null);

      try {
        const response = await fetch('/api/impostos/calculadora-governo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codProd: produto.codProd,
            quantidade: produto.quantidade,
            valorUnitario: produto.valorUnitario,
            codCli: opcoes?.codCli,
            ufOrigem: opcoes?.ufOrigem,
            ufDestino: opcoes?.ufDestino,
            tipoOperacao: opcoes?.tipoOperacao || 'venda',
            finalidade: opcoes?.finalidade || 'consumo',
            regimeTributario: opcoes?.regimeTributario || 'simples_nacional',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao calcular impostos');
        }

        const data: ResultadoCalculoImpostos = await response.json();
        
        if (!data.sucesso) {
          throw new Error(data.erro || 'Erro ao calcular impostos');
        }

        setResultado(data);
        return data;
      } catch (error) {
        const mensagemErro =
          error instanceof Error ? error.message : 'Erro desconhecido';
        setErro(mensagemErro);
        console.error('Erro ao calcular impostos:', error);
        return null;
      } finally {
        setIsCalculando(false);
      }
    },
    []
  );

  /**
   * Limpa o estado do hook
   */
  const limpar = useCallback(() => {
    setResultado(null);
    setErro(null);
    setIsCalculando(false);
  }, []);

  /**
   * Calcula o percentual total de impostos sobre o valor do produto
   */
  const calcularPercentualImpostos = useCallback(
    (resultado: ResultadoCalculoImpostos | null): number => {
      if (!resultado || resultado.operacao.valorTotal === 0) return 0;
      return (
        (resultado.totalImpostos / resultado.operacao.valorTotal) * 100
      );
    },
    []
  );

  return {
    calcularImpostos,
    isCalculando,
    erro,
    resultado,
    limpar,
    calcularPercentualImpostos,
  };
}
