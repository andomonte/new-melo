import { RefObject, useEffect } from 'react';

/**
 * Habilita a rolagem por TECLADO no conteúdo de um modal (além do mouse).
 *
 * Modais têm um container com `overflow-y-auto`, mas o browser só rola por
 * teclado o elemento que está focado — e o container normalmente não recebe
 * foco. Este hook escuta as teclas de rolagem enquanto o modal está aberto e
 * rola o container informado, sem roubar o foco de inputs (a digitação em
 * campos continua normal) nem quebrar botões (Espaço sobre um botão ainda o
 * aciona).
 *
 * Uso:
 *   const scrollRef = useRef<HTMLDivElement>(null);
 *   useScrollTecladoModal(scrollRef, isOpen);
 *   ...
 *   <div ref={scrollRef} className="max-h-[90vh] overflow-y-auto"> ... </div>
 *
 * Teclas: ↑/↓ (linha), PageUp/PageDown (página), Home/End (topo/fim),
 * Espaço / Shift+Espaço (página abaixo/acima).
 */
export function useScrollTecladoModal(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el) return;

      // Não interfere na digitação em campos de formulário.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      const linha = 48;
      const pagina = Math.max(el.clientHeight - 60, 60);
      let dy = 0;

      switch (e.key) {
        case 'ArrowDown':
          dy = linha;
          break;
        case 'ArrowUp':
          dy = -linha;
          break;
        case 'PageDown':
          dy = pagina;
          break;
        case 'PageUp':
          dy = -pagina;
          break;
        case ' ': {
          // Espaço sobre um botão/link deve acioná-lo, não rolar.
          if (
            target &&
            (target.tagName === 'BUTTON' ||
              target.tagName === 'A' ||
              target.getAttribute('role') === 'button')
          ) {
            return;
          }
          dy = e.shiftKey ? -pagina : pagina;
          break;
        }
        case 'Home':
          if (el.scrollHeight <= el.clientHeight) return;
          e.preventDefault();
          el.scrollTo({ top: 0 });
          return;
        case 'End':
          if (el.scrollHeight <= el.clientHeight) return;
          e.preventDefault();
          el.scrollTo({ top: el.scrollHeight });
          return;
        default:
          return;
      }

      // Só age (e bloqueia o padrão) se realmente há o que rolar.
      if (el.scrollHeight <= el.clientHeight) return;
      e.preventDefault();
      el.scrollBy({ top: dy });
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, ref]);
}
