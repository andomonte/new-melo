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
import { Package, Loader2, Eye } from 'lucide-react';
import { Produto } from '@/data/produtos/produtos';

interface ProdutosRelacionadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
  onZoom?: (produto: any) => void;
}

interface ProdutoRelacionado {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  qtd: number;
  prVenda: number;
  prCompra: number;
  prCustoAtual: number;
}

export const ProdutosRelacionadosModal: React.FC<
  ProdutosRelacionadosModalProps
> = ({ isOpen, onClose, produto, onZoom }) => {
  const [loading, setLoading] = useState(false);
  const [relacionados, setRelacionados] = useState<ProdutoRelacionado[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && produto) {
      fetchRelacionados();
    }
  }, [isOpen, produto]);

  const fetchRelacionados = async () => {
    if (!produto) return;

    setLoading(true);
    try {
      const response = await fetch('/api/produtos/relacionados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codprod: produto.codprod,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar produtos relacionados');
      }

      const data = await response.json();
      console.log('📦 Dados de Relacionados recebidos:', data);
      console.log('📦 Total de relacionados:', data.relacionados?.length || 0);

      setRelacionados(data.relacionados || []);

      if (data.message) {
        console.log('ℹ️ Mensagem da API:', data.message);
        toast({
          title: 'Informação',
          description: data.message,
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos relacionados:', error);
      toast({
        title: 'Erro ao carregar produtos relacionados',
        description: error.message,
        variant: 'destructive',
      });
      setRelacionados([]);
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

  const handleZoomProduto = (rel: ProdutoRelacionado) => {
    if (onZoom) {
      onZoom({
        codprod: rel.codprod,
        ref: rel.referencia,
        descr: rel.descricao,
        codmarca: rel.marca,
        qtest: rel.qtd,
        prvenda: rel.prVenda,
      });
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos Relacionados
          </DialogTitle>
          <DialogDescription>
            Produtos complementares/acessórios de: {produto.codprod} -{' '}
            {produto.descr}
          </DialogDescription>
        </DialogHeader>

        {/* Tabela de Produtos Relacionados */}
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
                  <th className="p-2 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {relacionados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-4 text-center text-muted-foreground"
                    >
                      {loading
                        ? 'Carregando...'
                        : 'Nenhum produto relacionado cadastrado'}
                    </td>
                  </tr>
                ) : (
                  relacionados.map((rel, index) => (
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="p-2 font-mono">{rel.referencia}</td>
                      <td className="p-2">{rel.marca}</td>
                      <td className="p-2 text-xs">{rel.descricao}</td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          rel.qtd > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {rel.qtd.toFixed(0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(rel.prVenda)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(rel.prCompra)}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(rel.prCustoAtual)}
                      </td>
                      <td className="p-2 text-center">
                        {onZoom && (
                          <button
                            onClick={() => handleZoomProduto(rel)}
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
        {relacionados.length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Total de produtos relacionados:</strong>{' '}
              {relacionados.length}
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              Estes produtos são complementares ou acessórios que podem ser
              sugeridos junto com o produto principal.
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
