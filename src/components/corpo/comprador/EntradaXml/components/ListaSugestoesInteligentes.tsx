import React from 'react';
import { Sparkles, Package2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Produto {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  estoque: number;
  tipo: string;
  confianca: 'alta' | 'media';
}

interface ListaSugestoesInteligentesProps {
  sugestoes: Produto[];
  onSelecionarProduto: (produto: Produto) => void;
  onBuscarManualmente: () => void;
  onFechar: () => void;
}

export const ListaSugestoesInteligentes: React.FC<ListaSugestoesInteligentesProps> = ({
  sugestoes,
  onSelecionarProduto,
  onBuscarManualmente,
  onFechar
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Sugestões Inteligentes
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Produtos já associados anteriormente com este fornecedor
              </p>
            </div>
          </div>
          <Button
            onClick={onFechar}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista de sugestões */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {sugestoes.map((produto, index) => (
              <div
                key={`${produto.codprod}-${index}`}
                onClick={() => onSelecionarProduto(produto)}
                className={`
                  border-2 rounded-lg p-4 cursor-pointer transition-all
                  hover:shadow-md
                  ${produto.confianca === 'alta'
                    ? 'bg-green-50 border-green-300 hover:border-green-400 dark:bg-green-950/20 dark:border-green-800'
                    : 'bg-yellow-50 border-yellow-300 hover:border-yellow-400 dark:bg-yellow-950/20 dark:border-yellow-800'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-full shrink-0
                    ${produto.confianca === 'alta'
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400'
                    }
                  `}>
                    <Package2 className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`
                        text-xs font-semibold px-2 py-0.5 rounded
                        ${produto.confianca === 'alta'
                          ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }
                      `}>
                        {produto.confianca === 'alta' ? '⭐⭐⭐ Alta Confiança' : '⭐⭐ Média Confiança'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Código:</span>
                        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {produto.codprod}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Referência:</span>
                        <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {produto.referencia}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">Descrição:</span>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                          {produto.descricao}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Marca:</span>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {produto.marca}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Estoque:</span>
                        <p className={`font-semibold ${
                          produto.estoque > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {produto.estoque}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelecionarProduto(produto);
                      }}
                      size="sm"
                      className={
                        produto.confianca === 'alta'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }
                    >
                      Selecionar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {sugestoes.length} {sugestoes.length === 1 ? 'sugestão encontrada' : 'sugestões encontradas'}
            </p>
            <Button
              onClick={onBuscarManualmente}
              variant="outline"
              size="sm"
              className="border-gray-300 dark:border-gray-600"
            >
              Buscar Manualmente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
