import { useEffect, useState } from 'react';

/**
 * Carrega a lista de um lookup (equivalente aos botões "..." de consulta das
 * telas do Delphi). Mantém o array vazio em caso de erro para o <select> nunca
 * quebrar a renderização do formulário.
 */
export function useLookup<T>(carregar: () => Promise<T[]>): T[] {
  const [itens, setItens] = useState<T[]>([]);

  useEffect(() => {
    let ativo = true;
    carregar()
      .then((lista) => ativo && setItens(lista))
      .catch((erro) => {
        console.error('Erro ao carregar lookup:', erro);
        if (ativo) setItens([]);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return itens;
}

/** Opções S/N — combos de duas posições usados em UF e Conta no Delphi. */
export const OPCOES_SIM_NAO = [
  { value: 'S', label: 'Sim' },
  { value: 'N', label: 'Não' },
];
