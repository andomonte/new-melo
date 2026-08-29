import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

interface AutocompleteOption {
  value: string;
  label: string;
  data?: any;
}

interface AutocompleteProps {
  placeholder?: string;
  apiUrl: string;
  value: string | null;
  onChange: (value: string, option: AutocompleteOption | null) => void;
  disabled?: boolean;
  className?: string;
  mapResponse: (data: any) => AutocompleteOption[];
  resetKey?: string | number;
  /** Label inicial para exibir quando o value já vem preenchido (evita busca na API) */
  initialLabel?: string;
}

export function Autocomplete({
  placeholder = 'Buscar...',
  apiUrl,
  value,
  onChange,
  disabled = false,
  className = '',
  mapResponse,
  resetKey,
  initialLabel
}: AutocompleteProps) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<AutocompleteOption[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<AutocompleteOption | null>(null);
  const [modified, setModified] = useState(false);
  const initialValueRef = useRef<string | null | undefined>(undefined);
  const [isResetting, setIsResetting] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Reseta o destaque quando a lista de opções muda.
  useEffect(() => {
    setHighlight(-1);
  }, [opcoes]);

  // Reset completo do componente quando resetKey muda
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    // Só reseta se resetKey mudou de um valor definido para outro
    if (resetKey === undefined || resetKey === prevResetKeyRef.current) return;
    prevResetKeyRef.current = resetKey;

    setIsResetting(true);
    setBusca('');
    setOpcoes([]);
    setAberto(false);
    setCarregando(false);
    setOpcaoSelecionada(null);
    setTimeout(() => {
      setIsResetting(false);
    }, 0);
  }, [resetKey]);

  // Fechar quando clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar opções quando a busca muda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca.length >= 1 && aberto) {
        buscarOpcoes(busca);
      } else if (aberto) {
        buscarOpcoes('');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [busca, aberto]);

  // Atualizar campo quando value muda externamente
  useEffect(() => {
    if (isResetting) return;

    if (value && opcaoSelecionada?.value !== value) {
      // Se tem initialLabel, usar direto sem buscar na API
      if (initialLabel) {
        setOpcaoSelecionada({ value, label: initialLabel });
        setBusca(initialLabel);
      } else {
        buscarOpcoes(value);
      }
    } else if (!value && opcaoSelecionada) {
      setOpcaoSelecionada(null);
      setBusca('');
    }
  }, [value, isResetting, initialLabel]);

  const buscarOpcoes = async (termoBusca: string): Promise<AutocompleteOption[]> => {
    try {
      setCarregando(true);
      const url = termoBusca
        ? `${apiUrl}?search=${encodeURIComponent(termoBusca)}`
        : apiUrl;

      const response = await fetch(url);
      const data = await response.json();

      const opcoesFormatadas = mapResponse(data);
      setOpcoes(opcoesFormatadas);

      // Se temos um value mas não temos opcaoSelecionada, tentar encontrar
      if (value && !opcaoSelecionada) {
        const opcaoEncontrada = opcoesFormatadas.find(opt => opt.value === value);
        if (opcaoEncontrada) {
          setOpcaoSelecionada(opcaoEncontrada);
          setBusca(opcaoEncontrada.label);
        }
      }
      return opcoesFormatadas;
    } catch (error) {
      console.error('Erro ao buscar opções:', error);
      setOpcoes([]);
      return [];
    } finally {
      setCarregando(false);
    }
  };

  // Escolhe a melhor opção para o termo digitado: 1º match exato por código (value),
  // depois label que começa com o termo, senão a 1ª da lista.
  const melhorMatch = (lista: AutocompleteOption[], termo: string) => {
    const t = termo.trim().toLowerCase();
    if (!t) return lista[0] ?? null;
    return (
      lista.find((o) => String(o.value).toLowerCase() === t) ||
      lista.find((o) => o.label.trim().toLowerCase().startsWith(t)) ||
      lista[0] ||
      null
    );
  };

  // Enter: se há item destacado, seleciona; senão busca imediatamente (ignora o debounce)
  // e seleciona o melhor match — permite digitar "111" + Enter sem usar o mouse.
  const selecionarPorEnter = async () => {
    if (highlight >= 0 && opcoes[highlight]) {
      handleSelect(opcoes[highlight]);
      return;
    }
    // Sem item destacado: refaz a busca do termo atual (evita lista defasada pelo debounce)
    // e seleciona o melhor match.
    const termo = busca.trim();
    const lista = await buscarOpcoes(termo);
    const escolha = melhorMatch(lista, termo);
    if (escolha) handleSelect(escolha);
  };

  const handleSelect = (opcao: AutocompleteOption) => {
    if (isResetting) return;
    if (initialValueRef.current === undefined) initialValueRef.current = value;
    if (opcao.value !== initialValueRef.current) setModified(true);
    setOpcaoSelecionada(opcao);
    setBusca(opcao.label);
    setAberto(false);
    onChange(opcao.value, opcao);

    // Foca no próximo campo após seleção
    setTimeout(() => {
      const input = wrapperRef.current?.querySelector('input');
      if (input) {
        const form = input.closest('.form-compact, form, [role="dialog"]');
        if (!form) return;
        const focusable = Array.from(
          form.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])'
          )
        );
        const idx = focusable.indexOf(input);
        const next = focusable[idx + 1];
        if (next) {
          next.focus();
          if (next instanceof HTMLInputElement) next.select();
        }
      }
    }, 50);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isResetting) {
      console.log('🚫 Ignorando handleClear durante reset');
      return;
    }
    setOpcaoSelecionada(null);
    setBusca('');
    onChange('', null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setBusca(valor);
    
    // Se o campo for limpo completamente, limpar a seleção
    if (!valor && opcaoSelecionada) {
      if (isResetting) {
        console.log('🚫 Ignorando handleInputChange clear durante reset');
        return;
      }
      setOpcaoSelecionada(null);
      onChange('', null);
    }
    
    // Sempre abrir o dropdown quando o usuário digita
    if (!aberto) {
      setAberto(true);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={busca}
          onChange={handleInputChange}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              selecionarPorEnter();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!aberto) setAberto(true);
              setHighlight((h) => Math.min(h + 1, opcoes.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Escape') {
              setAberto(false);
            }
          }}
          disabled={disabled}
          className={`pl-7 pr-7 text-xs h-[30px] ${modified ? '!border-emerald-400 dark:!border-emerald-500/60 !bg-emerald-50/30 dark:!bg-emerald-900/10' : ''}`}
        />
        {opcaoSelecionada && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {aberto && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
          {carregando ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Carregando...
            </div>
          ) : opcoes.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Nenhum resultado encontrado
            </div>
          ) : (
            <div className="py-1">
              {opcoes.map((opcao, index) => (
                <button
                  key={index}
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => handleSelect(opcao)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                    highlight === index || opcaoSelecionada?.value === opcao.value ? 'bg-accent' : ''
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
