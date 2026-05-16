import { useCallback, useRef } from 'react';

/**
 * Hook para navegação entre campos de formulário com Enter.
 * Ao pressionar Enter em um input, foca no próximo campo.
 *
 * Uso:
 * ```tsx
 * const { formRef, handleKeyDown } = useFormNavigation();
 *
 * <form ref={formRef}>
 *   <input onKeyDown={handleKeyDown} />
 *   <input onKeyDown={handleKeyDown} />
 * </form>
 * ```
 */
export function useFormNavigation() {
  const formRef = useRef<HTMLDivElement | HTMLFormElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;

    // Não navegar se for textarea (Enter = nova linha)
    if (e.currentTarget.tagName === 'TEXTAREA') return;

    e.preventDefault();

    const form = formRef.current;
    if (!form) return;

    // Seleciona todos os campos focáveis dentro do form
    const focusable = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled]), button[type="submit"]'
      )
    );

    const currentIndex = focusable.indexOf(e.currentTarget as HTMLElement);
    if (currentIndex === -1) return;

    // Foca no próximo campo
    const next = focusable[currentIndex + 1];
    if (next) {
      next.focus();
      // Se for input, seleciona o conteúdo
      if (next instanceof HTMLInputElement) {
        next.select();
      }
    }
  }, []);

  return { formRef, handleKeyDown };
}
