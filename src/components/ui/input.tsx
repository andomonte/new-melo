import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function focusNextField(el: HTMLElement) {
  const form = el.closest('.form-compact, form, [role="dialog"]');
  if (!form) return;

  const focusable = Array.from(
    form.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])'
    )
  );

  const idx = focusable.indexOf(el);
  if (idx === -1) return;

  const next = focusable[idx + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', onKeyDown, onChange, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        e.preventDefault();
        focusNextField(e.currentTarget);
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      // Para input date: ao selecionar data pelo calendário, foca no próximo
      if (type === 'date' && e.target.value) {
        setTimeout(() => focusNextField(e.target), 100);
      }
    };

    return (
      <input
        type={type}
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-600',
          'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white',
          'px-3 py-1 text-sm transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-gray-400 dark:placeholder:text-zinc-500',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/50 focus-visible:border-blue-400 dark:focus-visible:ring-blue-400/40 dark:focus-visible:border-blue-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
