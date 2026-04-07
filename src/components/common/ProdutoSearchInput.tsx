import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import api from '@/components/services/api';

interface Produto {
  codprod: string;
  descr: string;
  ref?: string;
}

interface ProdutoSearchInputProps {
  name: string;
  label: string;
  value?: string;
  onChange: (codigo: string, produto?: Produto) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const ProdutoSearchInput: React.FC<ProdutoSearchInputProps> = ({
  name,
  label,
  value = '',
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = 'Digite o código ou nome do produto...',
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [produtoNome, setProdutoNome] = useState('');
  const [produtoInvalido, setProdutoInvalido] = useState(false);
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sugestionBoxRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Sincronizar valor externo apenas uma vez
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Não incluir inputValue para evitar loop infinito

  // Buscar produto por código
  const buscarProdutoPorCodigo = async (codigo: string) => {
    if (!codigo || !/^\d+$/.test(codigo)) return;

    try {
      setLoading(true);
      setProdutoInvalido(false);
      const response = await api.get(`/api/produtos/get/${codigo}`);
      const produto = response.data;

      if (produto && produto.codprod) {
        setProdutoNome(produto.descr);
        setProdutoInvalido(false);
        onChange(codigo, produto);
      } else {
        setProdutoNome('');
        setProdutoInvalido(true);
        onChange('');
      }
    } catch (error: any) {
      console.error('Erro ao buscar produto:', error);
      // Se o erro for 404, o produto não existe
      if (error.response?.status === 404) {
        setProdutoInvalido(true);
        setProdutoNome('');
        onChange('');
      } else {
        setProdutoNome('');
        setProdutoInvalido(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Buscar sugestões
  const buscarSugestoes = async (termo: string) => {
    if (!termo || termo.length < 2) {
      setSugestoes([]);
      setShowSugestoes(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/api/produtos/busca-autocomplete', {
        params: {
          search: termo,
          perPage: 10,
        },
      });

      const produtos = response.data.data || [];
      setSugestoes(produtos);
      setShowSugestoes(produtos.length > 0);
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      setSugestoes([]);
      setShowSugestoes(false);
    } finally {
      setLoading(false);
    }
  };

  // Lidar com mudanças no input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Limpar validação enquanto usuário digita
    setProdutoInvalido(false);
    setProdutoNome('');

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!newValue) {
      setProdutoNome('');
      setProdutoInvalido(false);
      setSugestoes([]);
      setShowSugestoes(false);
      onChange('');
      return;
    }

    // Debounce de 500ms
    timeoutRef.current = setTimeout(() => {
      const isNumeric = /^\d+$/.test(newValue);

      if (isNumeric) {
        buscarProdutoPorCodigo(newValue);
        setShowSugestoes(false);
      } else if (newValue.length >= 2) {
        buscarSugestoes(newValue);
        setProdutoNome('');
        setProdutoInvalido(false);
      } else {
        setSugestoes([]);
        setShowSugestoes(false);
        setProdutoNome('');
        setProdutoInvalido(false);
      }
    }, 500);
  };

  // Selecionar uma sugestão
  const selecionarSugestao = (produto: Produto) => {
    setInputValue(produto.codprod);
    setProdutoNome(produto.descr);
    setProdutoInvalido(false);
    setShowSugestoes(false);
    onChange(produto.codprod, produto);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sugestionBoxRef.current &&
        !sugestionBoxRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSugestoes(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Limpar timeout ao desmontar
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col space-y-1 relative">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <Input
          ref={inputRef}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${
            error || produtoInvalido
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : produtoNome
              ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
              : ''
          }`}
          autoComplete="off"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          ) : produtoInvalido ? (
            <span className="text-red-500 text-xl">✗</span>
          ) : produtoNome ? (
            <span className="text-green-500 text-xl">✓</span>
          ) : (
            <Search size={16} className="text-gray-400" />
          )}
        </div>

        {/* Dropdown de sugestões */}
        {showSugestoes && sugestoes.length > 0 && (
          <div
            ref={sugestionBoxRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {sugestoes.map((produto) => (
              <div
                key={produto.codprod}
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                onClick={() => selecionarSugestao(produto)}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {produto.codprod} - {produto.descr}
                </div>
                {produto.ref && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ref: {produto.ref}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mostrar nome do produto encontrado */}
      {produtoNome && !produtoInvalido && (
        <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
          ✓ {produtoNome}
        </div>
      )}

      {/* Mostrar mensagem de produto inválido */}
      {produtoInvalido && inputValue && (
        <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          ✗ Produto não encontrado com o código &quot;{inputValue}&quot;
        </div>
      )}

      {/* Mensagem de erro */}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
};

export default ProdutoSearchInput;
