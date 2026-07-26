import { useEffect, useRef, useState } from 'react';

/**
 * Classe que a página deve aplicar (via `rowClassName`) na linha selecionada.
 * O hook usa essa classe para rolar a linha ativa até ficar visível quando o
 * usuário navega com as setas.
 */
export const CLASSE_LINHA_ATIVA = 'linha-tabela-ativa';

/**
 * Atalho de teclado extra para uma tabela navegável.
 *
 * - `key`: tecla (ex.: 'Delete', 'v', 'n'). Comparação case-insensitive.
 * - `ctrl`: se true, exige Ctrl/Cmd pressionado; se false/omitido, exige que
 *   Ctrl/Cmd NÃO estejam pressionados.
 * - `precisaLinha`: se true (padrão), só dispara quando há uma linha selecionada.
 *   Use false para atalhos globais (ex.: Ctrl+N para "novo").
 * - `handler`: recebe a linha selecionada (ou undefined se `precisaLinha` false
 *   e nada selecionado) e o índice.
 */
export interface AtalhoTabela<T> {
  key: string;
  ctrl?: boolean;
  precisaLinha?: boolean;
  handler: (row: T | undefined, index: number) => void;
}

interface OpcoesNavegacao<T> {
  /** Linhas atualmente exibidas na página. */
  data: T[] | undefined | null;
  /**
   * Quando false, todos os atalhos são ignorados. Use para desativar a
   * navegação enquanto há um modal aberto na tela. Padrão: true.
   */
  ativo?: boolean;
  /** Ação ao pressionar Enter sobre a linha selecionada (ex.: abrir edição). */
  onEnter?: (row: T, index: number) => void;
  /** Atalhos adicionais específicos da tela (Delete, Ctrl+N, etc.). */
  atalhos?: AtalhoTabela<T>[];
  /** Navegação circular (do fim volta pro início). Padrão: false. */
  loop?: boolean;
}

/**
 * Navegação de tabela por teclado, no estilo Delphi (pouco mouse).
 *
 * - Setas ↑/↓ movem a linha selecionada (funcionam mesmo com foco no input
 *   de busca).
 * - Enter dispara `onEnter` na linha selecionada (fora de inputs).
 * - Atalhos extras (`atalhos`) só disparam fora de inputs.
 *
 * O hook NÃO renderiza nada: ele gerencia o índice `linhaSelecionada` e o
 * listener global. A página liga o índice ao grid via as props `rowClassName`
 * (destaque) e `onRowClick` (sincroniza a seleção pelo mouse) do DataTablePadrao.
 *
 * @example
 * const { linhaSelecionada, setLinhaSelecionada } = useNavegacaoTecladoTabela({
 *   data: promocoes.data,
 *   ativo: !cadastrarOpen && !editarOpen,
 *   onEnter: (row) => handleEditar(row),
 *   atalhos: [
 *     { key: 'Delete', handler: (row) => handleExcluir(row) },
 *     { key: 'n', ctrl: true, precisaLinha: false, handler: () => setNovoOpen(true) },
 *   ],
 * });
 */
export function useNavegacaoTecladoTabela<T>({
  data,
  ativo = true,
  onEnter,
  atalhos = [],
  loop = false,
}: OpcoesNavegacao<T>) {
  const [linhaSelecionada, setLinhaSelecionada] = useState<number>(-1);

  // Refs mantêm o listener estável (registrado uma vez) sempre com valores atuais.
  const selRef = useRef(linhaSelecionada);
  selRef.current = linhaSelecionada;
  const dataRef = useRef(data);
  dataRef.current = data;
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const atalhosRef = useRef(atalhos);
  atalhosRef.current = atalhos;
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!ativoRef.current) return;

      const linhas = dataRef.current;
      if (!linhas || linhas.length === 0) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const emInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const sel = selRef.current;
      const ultima = linhas.length - 1;

      // Setas funcionam mesmo com foco no input de busca.
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLinhaSelecionada((prev) => {
          if (prev < 0) return 0;
          const next = prev + 1;
          if (next > ultima) return loopRef.current ? 0 : ultima;
          return next;
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLinhaSelecionada((prev) => {
          if (prev < 0) return 0;
          const next = prev - 1;
          if (next < 0) return loopRef.current ? ultima : 0;
          return next;
        });
        return;
      }

      // Demais atalhos só fora de campos de digitação.
      if (emInput) return;

      const linhaValida = sel >= 0 && sel <= ultima;

      if (e.key === 'Enter' && linhaValida && onEnterRef.current) {
        e.preventDefault();
        onEnterRef.current(linhas[sel], sel);
        return;
      }

      for (const at of atalhosRef.current) {
        const ctrlOk = at.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        if (e.key.toLowerCase() !== at.key.toLowerCase() || !ctrlOk) continue;
        const precisaLinha = at.precisaLinha !== false;
        if (precisaLinha && !linhaValida) continue;
        e.preventDefault();
        at.handler(linhaValida ? linhas[sel] : undefined, sel);
        return;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Rola a linha selecionada para dentro da área visível ao navegar pelas setas.
  useEffect(() => {
    if (linhaSelecionada < 0) return;
    const el = document.querySelector(`.${CLASSE_LINHA_ATIVA}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [linhaSelecionada]);

  return { linhaSelecionada, setLinhaSelecionada };
}
