import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, X, TrendingUp, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Divergencia {
  id: number;
  reqId: string;
  produto: string;
  descricaoProduto?: string;
  precoOC: number;
  precoNFe: number;
  diferencaPercentual: number;
  nivelAlerta: 'MEDIO' | 'ALTO' | 'CRITICO';
  dataOcorrencia: string;
  status: string;
  justificativa?: string;
}

interface DivergenciasPrecoAlertProps {
  reqId?: string;
  autoLoad?: boolean;
  onClose?: () => void;
}

export const DivergenciasPrecoAlert: React.FC<DivergenciasPrecoAlertProps> = ({
  reqId,
  autoLoad = true,
  onClose
}) => {
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [resumo, setResumo] = useState({
    total: 0,
    criticas: 0,
    altas: 0,
    medias: 0,
    valorTotalImpacto: 0
  });

  const buscarDivergencias = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/entrada-xml/consultar-divergencias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reqId,
          status: 'PENDENTE'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDivergencias(data.divergencias);
        setResumo(data.resumo);

        // NÃO auto-expandir, deixar usuario decidir
        // Sempre começar colapsado para economizar espaço
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Erro ao buscar divergências:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      buscarDivergencias();
    }
  }, [reqId, autoLoad]);

  const getAlertColor = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO':
        return 'bg-red-500';
      case 'ALTO':
        return 'bg-orange-500';
      case 'MEDIO':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getAlertIcon = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'ALTO':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'MEDIO':
        return <Info className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!divergencias.length && !loading) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Resumo Compacto */}
      {resumo.total > 0 && (
        <div
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            resumo.criticas > 0
              ? 'border-red-400 bg-red-50'
              : resumo.altas > 0
              ? 'border-orange-400 bg-orange-50'
              : 'border-yellow-400 bg-yellow-50'
          }`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {resumo.criticas > 0 ? (
                <AlertTriangle className="h-6 w-6 text-red-500" />
              ) : resumo.altas > 0 ? (
                <AlertCircle className="h-6 w-6 text-orange-500" />
              ) : (
                <Info className="h-6 w-6 text-yellow-500" />
              )}

              <div>
                <h3 className="font-semibold text-gray-800">
                  Divergências de Preço Detectadas
                </h3>
                <p className="text-sm text-gray-600">
                  {resumo.total} divergência{resumo.total !== 1 ? 's' : ''} encontrada{resumo.total !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Badges de resumo */}
              {resumo.criticas > 0 && (
                <Badge variant="destructive">
                  {resumo.criticas} Crítica{resumo.criticas !== 1 ? 's' : ''}
                </Badge>
              )}
              {resumo.altas > 0 && (
                <Badge className="bg-orange-500">
                  {resumo.altas} Alta{resumo.altas !== 1 ? 's' : ''}
                </Badge>
              )}
              {resumo.medias > 0 && (
                <Badge className="bg-yellow-500">
                  {resumo.medias} Média{resumo.medias !== 1 ? 's' : ''}
                </Badge>
              )}

              {/* Impacto financeiro */}
              {resumo.valorTotalImpacto > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-semibold">
                    Impacto: {formatCurrency(resumo.valorTotalImpacto)}
                  </span>
                </div>
              )}

              {/* Indicador de expansão */}
              <div className="flex items-center gap-2 text-gray-600">
                {showDetails ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>

              {onClose && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detalhes Expandidos */}
      {showDetails && divergencias.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-bold text-red-700 dark:text-red-400 text-base mb-3">
            Detalhes das Divergências:
          </h4>

          <div className="space-y-2">
            {divergencias.map((div) => (
              <div
                key={div.id}
                className={`border rounded-lg p-3 ${
                  div.nivelAlerta === 'CRITICO'
                    ? 'border-red-300 bg-red-50'
                    : div.nivelAlerta === 'ALTO'
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-yellow-300 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(div.nivelAlerta)}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">
                          Produto {div.produto}
                        </span>
                        {div.descricaoProduto && (
                          <span className="text-sm text-gray-600">
                            - {div.descricaoProduto}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Preço OC:</span>
                          <span className="font-medium ml-2">
                            {formatCurrency(div.precoOC)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Preço NFe:</span>
                          <span className="font-medium ml-2">
                            {formatCurrency(div.precoNFe)}
                          </span>
                        </div>
                      </div>

                      {div.reqId && (
                        <div className="text-xs text-gray-500 mt-1">
                          Requisição: {div.reqId}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp
                        className={`h-4 w-4 ${
                          div.precoNFe > div.precoOC ? 'text-red-500' : 'text-green-500'
                        }`}
                      />
                      <span
                        className={`font-bold text-sm ${
                          div.nivelAlerta === 'CRITICO'
                            ? 'text-red-600'
                            : div.nivelAlerta === 'ALTO'
                            ? 'text-orange-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {div.diferencaPercentual.toFixed(1)}%
                      </span>
                    </div>

                    <Badge className={getAlertColor(div.nivelAlerta)}>
                      {div.nivelAlerta}
                    </Badge>
                  </div>
                </div>

                {div.justificativa && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Justificativa:</span> {div.justificativa}
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-2">
                  Detectado em: {div.dataOcorrencia}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};