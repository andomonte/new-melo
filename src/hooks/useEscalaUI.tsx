import { useCallback, useEffect, useState } from 'react';

/**
 * Escala da interface.
 *
 * O root (`html`) usa `font-size: var(--ui-scale, 100%)`, então 100% = o
 * tamanho de fonte que o usuário configurou no navegador/Windows. Este hook
 * apenas MULTIPLICA essa preferência — não a substitui —, para quem usa escala
 * alta no Windows e ainda assim quer a grade mais compacta (ou o contrário).
 *
 * Como toda a UI está em rem, mexer no root escala fontes, alturas de campo e
 * espaçamentos juntos, sem cortar texto dentro dos inputs.
 */
export const CHAVE_ESCALA_UI = 'sysmelo:ui-scale';

export const ESCALAS_UI = [
  { valor: 87.5, label: 'Compacta' },
  { valor: 100, label: 'Padrão' },
  { valor: 112.5, label: 'Ampliada' },
  { valor: 125, label: 'Grande' },
] as const;

const PADRAO = 100;

const ehValida = (v: number) => ESCALAS_UI.some((e) => e.valor === v);

function aplicar(valor: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ui-scale', `${valor}%`);
}

export function useEscalaUI() {
  const [escala, setEscalaState] = useState<number>(PADRAO);

  // Lê a preferência salva. O valor já foi aplicado antes da pintura pelo
  // script inline do _document (evita flash) — aqui só sincronizamos o estado.
  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE_ESCALA_UI));
      if (salvo && ehValida(salvo)) {
        setEscalaState(salvo);
        aplicar(salvo);
      }
    } catch {
      /* localStorage indisponível — segue no padrão */
    }
  }, []);

  const setEscala = useCallback((valor: number) => {
    if (!ehValida(valor)) return;
    setEscalaState(valor);
    aplicar(valor);
    try {
      localStorage.setItem(CHAVE_ESCALA_UI, String(valor));
    } catch {
      /* sem persistência, mas a escala vale para a sessão */
    }
  }, []);

  return { escala, setEscala, escalas: ESCALAS_UI };
}
