import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface ComboboxInputProps {
  name?: string;
  label?: string;
  options: Option[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Texto de busca digitado (para busca remota/API) */
  onInputChange?: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  uppercase?: boolean;
  className?: string;
}

/**
 * Combobox de DIGITAR DIRETO (autocomplete), no mesmo padrão do módulo de
 * compras (Comprador/Fornecedor): o campo é o próprio input — sem a caixa de
 * busca separada dentro do dropdown. Drop-in do SelectPadrao `searchable`
 * (mesma API: options/value/onValueChange/onInputChange/required/error/loading).
 */
export default function ComboboxInput({
  name,
  label,
  options,
  value = '',
  onValueChange,
  onInputChange,
  required,
  error,
  disabled,
  placeholder = 'Digite para buscar...',
  loading = false,
  uppercase = false,
  className,
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modified, setModified] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialRef = useRef<string | undefined>(undefined);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  // Sincroniza o texto exibido com o valor selecionado (fora de digitação)
  useEffect(() => {
    if (initialRef.current === undefined && value) initialRef.current = value;
    setSearch(selectedLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedLabel]);

  // Fecha ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedIndex(-1);
        setSearch(selectedLabel); // volta a mostrar o selecionado
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [selectedLabel]);

  // Posição fixa (funciona dentro de scroll/modal)
  useEffect(() => {
    if (open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const abrirCima = window.innerHeight - rect.bottom < 220;
      setDropdownStyle({
        position: 'fixed',
        width: rect.width,
        left: rect.left,
        ...(abrirCima
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        zIndex: 9999,
      });
    }
  }, [open]);

  // Filtra: enquanto digita (search != selecionado) filtra por contém; senão lista tudo
  const termo = open && search !== selectedLabel ? search.trim() : '';
  const filtered = termo
    ? options.filter(
        (o) =>
          String(o.label).toLowerCase().includes(termo.toLowerCase()) ||
          String(o.value).toLowerCase().includes(termo.toLowerCase()),
      )
    : options;

  const selecionar = (opt: Option) => {
    if (initialRef.current === undefined) initialRef.current = value || '';
    if (opt.value !== initialRef.current) setModified(true);
    onValueChange?.(opt.value);
    setSearch(opt.label);
    setOpen(false);
    setSelectedIndex(-1);
  };

  const handleChange = (texto: string) => {
    setSearch(texto);
    if (!open) setOpen(true);
    onInputChange?.(texto);
    if (texto.length === 0 && !required) onValueChange?.('');
  };

  const limpar = () => {
    if (value !== initialRef.current) setModified(true);
    onValueChange?.('');
    setSearch('');
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => (p < filtered.length - 1 ? p + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => (p > 0 ? p - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filtered.length) {
        selecionar(filtered[selectedIndex]);
      } else if (filtered.length === 1) {
        selecionar(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSelectedIndex(-1);
      setSearch(selectedLabel);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn('space-y-1 text-gray-700 dark:text-gray-200', className)}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          id={name}
          type="text"
          role="combobox"
          autoComplete="off"
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            if (disabled) return;
            setOpen(true);
            e.currentTarget.select();
          }}
          className={cn(
            'flex h-9 w-full items-center rounded-md border px-3 py-2 pr-14 text-sm shadow-sm transition-colors',
            modified
              ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-900/10'
              : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800',
            'text-gray-900 dark:text-white',
            'focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            uppercase && 'uppercase',
          )}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {!required && value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={limpar}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => !disabled && setOpen((o) => !o)}
            className="text-gray-400 dark:text-gray-300"
            disabled={disabled}
          >
            <CaretSortIcon className="h-4 w-4" />
          </button>
        </div>

        {open && (
          <div
            className="rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg"
            style={dropdownStyle}
          >
            <div className="max-h-52 overflow-y-auto p-1">
              {loading ? (
                <div className="px-2 py-3 text-xs text-center text-gray-500 dark:text-gray-400">
                  Carregando...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-2 py-3 text-xs text-center text-gray-500 dark:text-gray-400">
                  {termo ? 'Nenhum resultado encontrado' : 'Digite para buscar...'}
                </div>
              ) : (
                filtered
                  .filter(
                    (item, i, arr) =>
                      arr.findIndex((o) => o.value === item.value) === i,
                  )
                  .map((option, index) => (
                    <div
                      key={`${option.value}-${index}`}
                      onClick={() => selecionar(option)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'relative flex items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer',
                        index === selectedIndex
                          ? 'bg-gray-100 dark:bg-zinc-700'
                          : '',
                        value === option.value
                          ? 'text-blue-600 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-100',
                        uppercase && 'uppercase',
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {value === option.value && (
                        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                          <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        </span>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
