import React from 'react';
import { Lightbulb, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Produto {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  estoque: number;
  confianca: 'alta' | 'media';
}

interface SugestaoInteligenteAlertProps {
  produto: Produto;
  onAceitar: () => void;
  onRecusar: () => void;
}

export const SugestaoInteligenteAlert: React.FC<SugestaoInteligenteAlertProps> = ({
  produto,
  onAceitar,
  onRecusar
}) => {
  const isAltaConfianca = produto.confianca === 'alta';

  return (
    <div className={`
      border-2 rounded-lg p-4 mb-4
      ${isAltaConfianca
        ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800'
        : 'bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-800'
      }
    `}>
      <div className="flex items-start gap-3">
        <div className={`
          p-2 rounded-full
          ${isAltaConfianca
            ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400'
          }
        `}>
          {isAltaConfianca ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <Lightbulb className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className={`
              font-semibold text-sm
              ${isAltaConfianca
                ? 'text-green-800 dark:text-green-200'
                : 'text-yellow-800 dark:text-yellow-200'
              }
            `}>
              {isAltaConfianca
                ? '⭐⭐⭐ Sugestão Inteligente (Alta Confiança)'
                : '⭐⭐ Sugestão Inteligente (Média Confiança)'
              }
            </h4>
          </div>

          <p className={`
            text-xs mb-3
            ${isAltaConfianca
              ? 'text-green-700 dark:text-green-300'
              : 'text-yellow-700 dark:text-yellow-300'
            }
          `}>
            {isAltaConfianca
              ? 'Você já associou este produto deste fornecedor anteriormente. Deseja usar o mesmo produto?'
              : 'Produto similar foi encontrado com este fornecedor. Deseja verificar?'
            }
          </p>

          <div className={`
            bg-white dark:bg-gray-900 rounded p-3 mb-3 border
            ${isAltaConfianca
              ? 'border-green-200 dark:border-green-800'
              : 'border-yellow-200 dark:border-yellow-800'
            }
          `}>
            <div className="grid grid-cols-2 gap-2 text-xs">
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

          <div className="flex gap-2">
            <Button
              onClick={onAceitar}
              size="sm"
              className={
                isAltaConfianca
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Aceitar Sugestão
            </Button>
            <Button
              onClick={onRecusar}
              size="sm"
              variant="outline"
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
