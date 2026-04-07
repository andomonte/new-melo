import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link2, Loader2, Eye } from 'lucide-react';
import { Produto } from '@/data/produtos/produtos';

interface ProdutosEquivalentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
  onZoom?: (produto: any) => void;
}

interface ProdutoEquivalente {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  qtd: number;
  prVenda: number;
  prCompra: number;
  prCustoAtual: number;
  prFabr: number;
}

export const ProdutosEquivalentesModal: React.FC<
  ProdutosEquivalentesModalProps
> = ({ isOpen, onClose, produto, onZoom }) => {
  const [loading, setLoading] = useState(false);
  const [equivalentes, setEquivalentes] = useState<ProdutoEquivalente[]>([]);
  const [codgpe, setCodgpe] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && produto) {
      fetchEquivalentes();
    }
  }, [isOpen, produto]);

  const fetchEquivalentes = async () => {
    if (!produto) return;

    setLoading(true);
    try {
      const response = await fetch('/api/produtos/equivalentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codprod: produto.codprod,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar produtos equivalentes');
      }

      const data = await response.json();
      console.log('🔗 Dados de Equivalentes recebidos:', data);
      console.log('🔗 Total de equivalentes:', data.equivalentes?.length || 0);
      console.log('🔗 CODGPE:', data.codgpe);

      setEquivalentes(data.equivalentes || []);
      setCodgpe(data.codgpe || '');

      if (data.message) {
        console.log('ℹ️ Mensagem da API:', data.message);
        toast({
          title: 'Informação',
          description: data.message,
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos equivalentes:', error);
      toast({
        title: 'Erro ao carregar produtos equivalentes',
        description: error.message,
        variant: 'destructive',
      });
      setEquivalentes([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleZoomProduto = (equiv: ProdutoEquivalente) => {
    if (onZoom) {
      onZoom({
        codprod: equiv.codprod,
        ref: equiv.referencia,
        descr: equiv.descricao,
        codmarca: equiv.marca,
        qtest: equiv.qtd,
        prvenda: equiv.prVenda,
      });
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Produtos Equivalentes
          </DialogTitle>
          <DialogDescription>
            Produtos que podem substituir: {produto.codprod} - {produto.descr}
            {codgpe && (
              <span className="block mt-1 text-xs">
                Grupo de Equivalência: <strong>{codgpe}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tabela de Produtos Equivalentes */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="p-2 text-left">REFERÊNCIA</th>
                  <th className="p-2 text-left">MARCA</th>
                  <th className="p-2 text-left">DESCRIÇÃO</th>
                  <th className="p-2 text-right">QTDE</th>
                  <th className="p-2 text-right">PR. VENDA</th>
                  <th className="p-2 text-right">PR. COMPRA</th>
                  <th className="p-2 text-right">PR. CUSTO</th>
                  <th className="p-2 text-right">PR. FÁBRICA</th>
                  <th className="p-2 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {equivalentes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-4 text-center text-muted-foreground"
                    >
                      {loading
                        ? 'Carregando...'
                        : 'Nenhum produto equivalente cadastrado'}
                    </td>
                  </tr>
                ) : (
                  equivalentes.map((equiv, index) => (
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="p-2 font-mono">{equiv.referencia}</td>
                      <td className="p-2">{equiv.marca}</td>
                      <td className="p-2 text-xs">{equiv.descricao}</td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          equiv.qtd > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {equiv.qtd.toFixed(0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(equiv.prVenda)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(equiv.prCompra)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(equiv.prCustoAtual)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(equiv.prFabr)}
                      </td>
                      <td className="p-2 text-center">
                        {onZoom && (
                          <button
                            onClick={() => handleZoomProduto(equiv)}
                            className="inline-flex items-center justify-center p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                            title="Zoom do produto"
                          >
                            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Informação adicional */}
        {equivalentes.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Total de produtos equivalentes:</strong> {equivalentes.length}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Estes produtos podem ser usados como substitutos no momento da venda
              ou compra.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
