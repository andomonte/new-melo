import React, { useState, useEffect } from 'react';
import { Lightbulb, Sparkles, TrendingUp, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Sugestao {
  reqId: string;
  reqIdComposto: string;
  fornecedor: string;
  quantidade: number;
  quantidadeAtendida: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  confianca: number;
  motivo: string;
  dataRequisicao: string;
  status: string;
}

interface SugestoesAutomaticasProps {
  produtoCod: string;
  fornecedorCod?: string;
  quantidadeNecessaria?: number;
  onSelectSugestao: (sugestao: Sugestao) => void;
  onClose?: () => void;
}

export const SugestoesAutomaticas: React.FC<SugestoesAutomaticasProps> = ({
  produtoCod,
  fornecedorCod,
  quantidadeNecessaria = 0,
  onSelectSugestao,
  onClose
}) => {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedSugestoes, setSelectedSugestoes] = useState<string[]>([]);

  const buscarSugestoes = async () => {
    if (!produtoCod) return;

    setLoading(true);
    try {
      const response = await fetch('/api/entrada-xml/buscar-sugestoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          produtoCod,
          fornecedorCod,
          limite: 10
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSugestoes(data.sugestoes);

        // Se houver sugestões com alta confiança, pré-selecionar
        const sugestoesAltaConfianca = data.sugestoes
          .filter((s: Sugestao) => s.confianca >= 0.7)
          .slice(0, 1);

        if (sugestoesAltaConfianca.length > 0) {
          setSelectedSugestoes(sugestoesAltaConfianca.map((s: Sugestao) => s.reqId));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarSugestoes();
  }, [produtoCod, fornecedorCod]);

  const getConfiancaColor = (confianca: number) => {
    if (confianca >= 0.8) return 'text-green-600';
    if (confianca >= 0.5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfiancaLabel = (confianca: number) => {
    if (confianca >= 0.8) return 'Alta';
    if (confianca >= 0.5) return 'Média';
    return 'Baixa';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSelectSugestao = (sugestao: Sugestao) => {
    if (selectedSugestoes.includes(sugestao.reqId)) {
      setSelectedSugestoes(selectedSugestoes.filter(id => id !== sugestao.reqId));
    } else {
      setSelectedSugestoes([...selectedSugestoes, sugestao.reqId]);
    }
  };

  const handleApplySugestoes = () => {
    const sugestoesParaAplicar = sugestoes.filter(s =>
      selectedSugestoes.includes(s.reqId)
    );

    sugestoesParaAplicar.forEach(sugestao => {
      onSelectSugestao(sugestao);
    });

    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-blue-500 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-gray-600">Buscando sugestões inteligentes...</p>
        </div>
      </div>
    );
  }

  if (sugestoes.length === 0) {
    return (
      <div className="text-center p-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Nenhuma sugestão encontrada para este produto</p>
        <p className="text-sm text-gray-500 mt-2">
          Produto: {produtoCod}
        </p>
      </div>
    );
  }

  const sugestoesToShow = showAll ? sugestoes : sugestoes.slice(0, 3);
  const sugestaoMaisConfiavel = sugestoes[0];

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-800">
            Sugestões Inteligentes
          </h3>
          <Badge variant="secondary">
            {sugestoes.length} sugestão{sugestoes.length !== 1 ? 'ões' : ''}
          </Badge>
        </div>

        {selectedSugestoes.length > 0 && (
          <Button
            size="sm"
            onClick={handleApplySugestoes}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Aplicar {selectedSugestoes.length} Selecionada{selectedSugestoes.length !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Sugestão Principal (Alta Confiança) */}
      {sugestaoMaisConfiavel && sugestaoMaisConfiavel.confianca >= 0.7 && (
        <Card className="p-4 border-2 border-green-400 bg-green-50">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">
                Melhor Sugestão
              </span>
              <Badge className="bg-green-600">
                {(sugestaoMaisConfiavel.confianca * 100).toFixed(0)}% Confiança
              </Badge>
            </div>

            <Button
              size="sm"
              variant={selectedSugestoes.includes(sugestaoMaisConfiavel.reqId) ? "default" : "outline"}
              onClick={() => handleSelectSugestao(sugestaoMaisConfiavel)}
            >
              {selectedSugestoes.includes(sugestaoMaisConfiavel.reqId) ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Selecionado
                </>
              ) : (
                'Selecionar'
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Requisição:</span>
              <span className="font-medium">{sugestaoMaisConfiavel.reqIdComposto}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Fornecedor:</span>
              <span className="font-medium">{sugestaoMaisConfiavel.fornecedor}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Quantidade Disponível:</span>
              <span className="font-medium text-green-600">
                {sugestaoMaisConfiavel.quantidadeDisponivel.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Valor Unitário:</span>
              <span className="font-medium">{formatCurrency(sugestaoMaisConfiavel.valorUnitario)}</span>
            </div>

            {/* Barra de progresso da quantidade */}
            {quantidadeNecessaria > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Atende sua necessidade:</span>
                  <span>
                    {Math.min(100, (sugestaoMaisConfiavel.quantidadeDisponivel / quantidadeNecessaria) * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (sugestaoMaisConfiavel.quantidadeDisponivel / quantidadeNecessaria) * 100)}
                  className="h-2"
                />
              </div>
            )}

            <div className="text-xs text-gray-500 mt-2">
              <span className="italic">{sugestaoMaisConfiavel.motivo}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Outras Sugestões */}
      <div className="space-y-2">
        {sugestoesToShow
          .filter(s => s.reqId !== sugestaoMaisConfiavel?.reqId || sugestaoMaisConfiavel.confianca < 0.7)
          .map((sugestao) => (
          <Card
            key={sugestao.reqId}
            className={`p-3 cursor-pointer transition-all ${
              selectedSugestoes.includes(sugestao.reqId)
                ? 'border-blue-400 bg-blue-50'
                : 'hover:border-gray-300'
            }`}
            onClick={() => handleSelectSugestao(sugestao)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{sugestao.reqIdComposto}</span>
                  <Badge
                    variant="outline"
                    className={getConfiancaColor(sugestao.confianca)}
                  >
                    {getConfiancaLabel(sugestao.confianca)}
                  </Badge>
                  {selectedSugestoes.includes(sugestao.reqId) && (
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="block text-gray-500">Fornecedor</span>
                    <span className="font-medium">{sugestao.fornecedor}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Disponível</span>
                    <span className="font-medium text-green-600">
                      {sugestao.quantidadeDisponivel.toFixed(0)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-500">Valor Unit.</span>
                    <span className="font-medium">
                      {formatCurrency(sugestao.valorUnitario)}
                    </span>
                  </div>
                </div>

                {sugestao.motivo && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    {sugestao.motivo}
                  </p>
                )}
              </div>

              <div className="text-right ml-3">
                <div className={`text-2xl font-bold ${getConfiancaColor(sugestao.confianca)}`}>
                  {(sugestao.confianca * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">confiança</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Botão para mostrar mais */}
      {sugestoes.length > 3 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Mostrar menos' : `Ver mais ${sugestoes.length - 3} sugestões`}
          </Button>
        </div>
      )}

      {/* Dica de uso */}
      {sugestoes.some(s => s.confianca >= 0.7) && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <strong>Dica:</strong> As sugestões são baseadas em associações anteriores e padrões de compra.
            Sugestões com alta confiança têm maior probabilidade de serem corretas.
          </div>
        </div>
      )}
    </div>
  );
};