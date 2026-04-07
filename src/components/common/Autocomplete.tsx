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
  resetKey?: string | number; // Nova prop para forçar reset
}

export function Autocomplete({
  placeholder = 'Buscar...',
  apiUrl,
  value,
  onChange,
  disabled = false,
  className = '',
  mapResponse,
  resetKey
}: AutocompleteProps) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<AutocompleteOption[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<AutocompleteOption | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Reset completo do componente quando resetKey muda
  useEffect(() => {
    console.log('🔄 Autocomplete reset triggered, resetKey:', resetKey, 'current value:', value);
    setIsResetting(true);
    setBusca('');
    setOpcoes([]);
    setAberto(false);
    setCarregando(false);
    setOpcaoSelecionada(null);
    // Pequeno delay para garantir que o reset seja processado
    setTimeout(() => {
      setIsResetting(false);
      console.log('✅ Autocomplete reset complete, isResetting:', false);
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
    // Não processar mudanças de value durante reset
    if (isResetting) {
      console.log('🚫 Ignorando mudança de value durante reset, value:', value);
      return;
    }
    
    console.log('📥 Value changed externally:', value, 'current selected:', opcaoSelecionada?.value);
    // Se o value mudou externamente (não por seleção nossa)
    if (value && opcaoSelecionada?.value !== value) {
      console.log('🔍 Buscando opção para value:', value);
      // Buscar a opção com o valor atual
      buscarOpcoes(value);
    } else if (!value && opcaoSelecionada) {
      // Se o value foi limpo externamente, limpar nossa seleção
      console.log('🧹 Limpando seleção porque value foi limpo');
      setOpcaoSelecionada(null);
      setBusca('');
    }
  }, [value, isResetting]);

  const buscarOpcoes = async (termoBusca: string) => {
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
    } catch (error) {
      console.error('Erro ao buscar opções:', error);
      setOpcoes([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleSelect = (opcao: AutocompleteOption) => {
    console.log('handleSelect chamado:', opcao);
    if (isResetting) {
      console.log('🚫 Ignorando handleSelect durante reset');
      return;
    }
    console.log('Vai chamar onChange com:', opcao.value);
    setOpcaoSelecionada(opcao);
    setBusca(opcao.label);
    setAberto(false);
    onChange(opcao.value, opcao);
    console.log('onChange foi chamado');
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={busca}
          onChange={handleInputChange}
          onFocus={() => setAberto(true)}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {opcaoSelecionada && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-4 w-4" />
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
                  onClick={() => handleSelect(opcao)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                    opcaoSelecionada?.value === opcao.value ? 'bg-accent' : ''
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
