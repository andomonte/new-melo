import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { Search } from 'lucide-react';
import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectPadraoProps {
  name?: string;
  options: Option[];
  /** Label exibida acima do select */
  label?: string;
  /** Valor controlado */
  value?: string;
  /** Valor padrão (não controlado) */
  defaultValue?: string;
  /** Callback ao mudar valor */
  onValueChange?: (value: string) => void;
  /** Campo obrigatório — mostra * e esconde "Limpar seleção" */
  required?: boolean;
  /** Mensagem de erro */
  error?: string;
  /** Desabilitar */
  disabled?: boolean;
  /** Placeholder */
  placeholder?: string;
  /** Ativa campo de busca dentro do dropdown (para listas grandes) */
  searchable?: boolean;
  /** Modo compacto — largura fixa, altura menor */
  compact?: boolean;
  /** Texto em maiúsculas */
  uppercase?: boolean;
  /** className extra no wrapper */
  className?: string;
  /** Callback quando o texto de busca muda (para busca remota/API) */
  onInputChange?: (value: string) => void;
}

/**
 * Select padrão do sistema.
 * Substitui SelectInput, SelectInput2, SelectInputFixo e SearchableSelect.
 *
 * - Dark/light mode ✅
 * - Posição dinâmica (cima/baixo) ✅
 * - Limpar seleção (quando !required) ✅
 * - Campo de busca (searchable) ✅
 * - Destaque campo modificado (verde) ✅ (via select.tsx base)
 * - Enter → próximo campo ✅ (via select.tsx base)
 * - Label + error ✅
 */
export default function SelectPadrao({
  name,
  options,
  label,
  value,
  defaultValue,
  onValueChange,
  required,
  error,
  disabled,
  placeholder = 'Selecione...',
  searchable = false,
  compact = false,
  uppercase = false,
  className,
  onInputChange,
}: SelectPadraoProps) {
  // Modo searchable: renderiza dropdown customizado com campo de busca
  if (searchable) {
    return (
      <div className={cn('space-y-1 text-gray-700 dark:text-gray-200', className)}>
        {label && (
          <Label htmlFor={name}>
            {label}
            {required && <span className="text-red-500"> *</span>}
          </Label>
        )}
        <SearchableDropdown
          value={value || defaultValue || ''}
          onValueChange={(val) => onValueChange?.(val)}
          onInputChange={onInputChange}
          options={options}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          uppercase={uppercase}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // Modo padrão: usa Radix Select
  const currentValue = value !== undefined ? value : defaultValue;
  const handleChange = (val: string) => {
    onValueChange?.(val === '__CLEAR__' ? '' : val);
  };

  return (
    <div className={cn('space-y-1 text-gray-700 dark:text-gray-200', className)}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        {...(value !== undefined ? { value } : defaultValue ? { defaultValue } : {})}
        name={name}
        onValueChange={handleChange}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          id={name}
          disabled={disabled}
          className={cn(
            compact
              ? 'w-56 h-9 pr-2 px-3 py-1 text-sm truncate'
              : 'flex h-9 w-full items-center justify-between px-3 py-1 text-sm',
            uppercase && 'uppercase',
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!required && (
            <SelectItem
              value="__CLEAR__"
              className="text-gray-400 dark:text-gray-500"
            >
              — Limpar seleção —
            </SelectItem>
          )}
          {options?.filter((item, index, arr) => arr.findIndex(o => o.value === item.value) === index).map((item, index) => (
            <SelectItem
              key={`${item.value}-${index}`}
              value={item.value}
              className={cn(uppercase && 'uppercase')}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ============================================================
// Dropdown com busca integrada (substitui SearchableSelect)
// ============================================================

function SearchableDropdown({
  value,
  onValueChange,
  onInputChange,
  options,
  disabled,
  required,
  placeholder,
  uppercase,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onInputChange?: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  required?: boolean;
  placeholder: string;
  uppercase?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modified, setModified] = React.useState(false);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const initialValueRef = React.useRef<string | undefined>(undefined);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Captura valor inicial
  React.useEffect(() => {
    if (initialValueRef.current === undefined && value) {
      initialValueRef.current = value;
    }
  }, [value]);

  // Fechar ao clicar fora
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcula posição fixa (funciona dentro de scroll/modal)
  React.useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 180;

      setDropdownStyle({
        position: 'fixed',
        width: rect.width,
        left: rect.left,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        zIndex: 9999,
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  const handleSelect = (optionValue: string) => {
    if (initialValueRef.current === undefined) initialValueRef.current = value || '';
    if (optionValue !== initialValueRef.current) setModified(true);

    onValueChange(optionValue);
    setOpen(false);
    setSearch('');

    // Foca no próximo campo
    setTimeout(() => {
      const trigger = wrapperRef.current?.querySelector('button') as HTMLElement;
      if (!trigger) return;
      const form = trigger.closest('.form-compact, form, [role="dialog"]');
      if (!form) return;
      const focusable = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled]), button[role="combobox"]:not([disabled])',
        ),
      );
      const idx = focusable.indexOf(trigger);
      const next = focusable[idx + 1];
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) next.select();
      }
    }, 50);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border px-3 py-2 text-sm shadow-sm transition-colors',
          modified
            ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-900/10'
            : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          uppercase && 'uppercase',
        )}
      >
        <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
          {selectedLabel || placeholder}
        </span>
        <CaretSortIcon className="h-4 w-4 text-gray-400 dark:text-gray-300 shrink-0" />
      </button>

      {open && (
        <div
          className="rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg"
          style={dropdownStyle}
        >
          {/* Campo de busca */}
          <div className="p-1.5 border-b border-gray-200 dark:border-zinc-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); onInputChange?.(e.target.value); }}
                placeholder="Pesquisar..."
                className="w-full pl-7 pr-2 py-1 text-xs rounded border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setSearch('');
                  }
                  if (e.key === 'Enter' && filtered.length === 1) {
                    handleSelect(filtered[0].value);
                  }
                }}
              />
            </div>
          </div>

          {/* Lista de opções */}
          <div className="max-h-36 overflow-y-auto p-1">
            {/* Limpar seleção */}
            {value && !required && (
              <div
                onClick={() => handleSelect('')}
                className="relative flex items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <span>— Limpar seleção —</span>
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-center text-gray-500 dark:text-gray-400">
                Nenhum resultado encontrado
              </div>
            ) : (
              filtered.filter((item, index, arr) => arr.findIndex(o => o.value === item.value) === index).map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'relative flex items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer',
                    'hover:bg-gray-100 dark:hover:bg-zinc-700',
                    value === option.value
                      ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300'
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
  );
}
