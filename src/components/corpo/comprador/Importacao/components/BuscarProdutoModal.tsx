/**
 * Modal de busca de produto para associar a itens da importação
 * Reutiliza endpoint /api/entrada-xml/produtos/search
 * Padrão visual do ContratoModal (raw tailwind, sem shadcn Dialog)
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';

interface Produto {
  id: string;
  referencia: string;
  descricao: string;
  codigoBarras?: string;
  marca: string;
  estoque: number;
}

interface BuscarProdutoModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSelecionar: (codprod: string, descricao: string) => void;
  descricaoItem?: string;
}

export const BuscarProdutoModal: React.FC<BuscarProdutoModalProps> = ({
  aberto,
  onFechar,
  onSelecionar,
  descricaoItem,
}) => {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (aberto) {
      setBusca('');
      setResultados([]);
      setBuscou(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aberto]);

  const buscar = async (termo: string) => {
    if (!termo.trim() || termo.trim().length < 2) {
      setResultados([]);
      setBuscou(false);
      return;
    }

    setBuscando(true);
    setBuscou(true);

    try {
      const response = await api.get(`/api/entrada-xml/produtos/search?search=${encodeURIComponent(termo.trim())}`);
      if (response.data?.success) {
        setResultados(response.data.data || []);
      }
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const handleBuscaChange = (valor: string) => {
    setBusca(valor);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => buscar(valor), 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      buscar(busca);
    }
  };

  const handleSelecionar = (produto: Produto) => {
    onSelecionar(produto.id, produto.descricao);
    onFechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200 dark:border-zinc-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Buscar Produto
            </h3>
            {descricaoItem && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[400px]">
                Item: {descricaoItem}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Busca */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              ref={inputRef}
              placeholder="Buscar por código, descrição ou código de barras..."
              value={busca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 text-sm pl-9"
            />
            {buscando && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#347AB6]" />
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-auto min-h-0">
          {!buscou ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Search className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Digite para buscar produtos
                </p>
              </div>
            </div>
          ) : buscando ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-[#347AB6]" />
            </div>
          ) : resultados.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Package className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhum produto encontrado
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Header da tabela */}
              <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600 sticky top-0">
                <div className="flex gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <div className="w-24">Código</div>
                  <div className="flex-1 min-w-0">Descrição</div>
                  <div className="w-28">Marca</div>
                  <div className="w-20 text-right">Estoque</div>
                  <div className="w-20" />
                </div>
              </div>

              {/* Linhas */}
              {resultados.map((produto) => (
                <div
                  key={produto.id}
                  className="flex gap-2 items-center px-4 py-2.5 text-xs border-b border-gray-100 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  onClick={() => handleSelecionar(produto)}
                >
                  <div className="w-24 font-mono font-medium text-gray-900 dark:text-gray-100">
                    {produto.id}
                  </div>
                  <div className="flex-1 min-w-0 text-gray-600 dark:text-gray-300 truncate">
                    {produto.descricao}
                  </div>
                  <div className="w-28 text-gray-500 dark:text-gray-400 truncate">
                    {produto.marca}
                  </div>
                  <div className="w-20 text-right text-gray-900 dark:text-gray-100">
                    {produto.estoque}
                  </div>
                  <div className="w-20 flex justify-end">
                    <Button
                      size="sm"
                      className="h-6 text-xs bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelecionar(produto);
                      }}
                    >
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-zinc-700 shrink-0">
          <Button variant="outline" size="sm" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};
