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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  ArrowRightLeft,
  Loader2,
  Warehouse,
  Package,
  AlertCircle,
} from 'lucide-react';

interface Armazem {
  id_armazem: number;
  nome: string;
}

interface EstoqueArmazem {
  armId: number;
  armDescricao: string;
  qtest: number;
  qtestReservada: number;
  qtestDisponivel: number;
  bloqueado: boolean;
}

interface ProdutoEstoque {
  codprod: string;
  descr: string;
  armazens: EstoqueArmazem[];
}

interface ItemTransferencia {
  codprod: string;
  descr: string;
  estoqueTotal: number;
  estoqueReservado: number;
  estoqueOrigem: number; // disponível = total - reservado
  quantidade: number;
  selecionado: boolean;
}

interface TransferenciaArmazemMassaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Set<string>;
  onSuccess?: () => void;
}

export const TransferenciaArmazemMassaModal: React.FC<TransferenciaArmazemMassaModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  onSuccess,
}) => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoqueProdutos, setEstoqueProdutos] = useState<ProdutoEstoque[]>([]);
  const [armIdOrigem, setArmIdOrigem] = useState<string>('');
  const [armIdDestino, setArmIdDestino] = useState<string>('');
  const [itens, setItens] = useState<ItemTransferencia[]>([]);
  const [obs, setObs] = useState<string>('');
  const [quantidadeGlobal, setQuantidadeGlobal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingArmazens, setLoadingArmazens] = useState(false);
  const [loadingEstoque, setLoadingEstoque] = useState(false);
  const { toast } = useToast();

  // Carrega armazéns disponíveis
  useEffect(() => {
    if (!isOpen) return;

    const fetchArmazens = async () => {
      setLoadingArmazens(true);
      try {
        const response = await fetch('/api/armazem/get?perPage=100');
        if (!response.ok) throw new Error('Erro ao carregar armazéns');

        const data = await response.json();
        setArmazens(data.data || []);
      } catch (error) {
        console.error('Erro ao carregar armazéns:', error);
        toast({
          title: 'Erro ao carregar armazéns',
          description: 'Não foi possível carregar a lista de armazéns.',
          variant: 'destructive',
        });
      } finally {
        setLoadingArmazens(false);
      }
    };

    fetchArmazens();
  }, [isOpen, toast]);

  // Carrega estoque dos produtos quando abrir o modal
  useEffect(() => {
    if (!isOpen || selectedProducts.size === 0) return;

    const fetchEstoque = async () => {
      setLoadingEstoque(true);
      try {
        const codprods = Array.from(selectedProducts);
        const response = await fetch('/api/armazem/estoque-produto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codprods }),
        });

        if (!response.ok) throw new Error('Erro ao carregar estoque');

        const data = await response.json();
        setEstoqueProdutos(data.data || []);
      } catch (error) {
        console.error('Erro ao carregar estoque:', error);
        toast({
          title: 'Erro ao carregar estoque',
          description: 'Não foi possível carregar informações de estoque.',
          variant: 'destructive',
        });
      } finally {
        setLoadingEstoque(false);
      }
    };

    fetchEstoque();
  }, [isOpen, selectedProducts, toast]);

  // Armazéns que têm pelo menos um produto com estoque
  const armazensComEstoque = React.useMemo(() => {
    const armIds = new Set<number>();
    for (const produto of estoqueProdutos) {
      for (const arm of produto.armazens) {
        if (arm.qtestDisponivel > 0) {
          armIds.add(arm.armId);
        }
      }
    }
    return armazens.filter((a) => armIds.has(a.id_armazem));
  }, [armazens, estoqueProdutos]);

  // Se só tem 1 armazém com estoque, seleciona automaticamente
  useEffect(() => {
    if (armazensComEstoque.length === 1 && !armIdOrigem) {
      setArmIdOrigem(armazensComEstoque[0].id_armazem.toString());
    }
  }, [armazensComEstoque, armIdOrigem]);

  // Atualiza a lista de itens quando o armazém de origem muda
  useEffect(() => {
    if (!armIdOrigem) {
      setItens([]);
      return;
    }

    const armId = parseInt(armIdOrigem, 10);
    const novosItens: ItemTransferencia[] = [];

    // Para cada produto selecionado
    for (const codprod of selectedProducts) {
      const produtoEstoque = estoqueProdutos.find((p) => p.codprod === codprod);
      const estoqueArmazem = produtoEstoque?.armazens.find((a) => a.armId === armId);

      novosItens.push({
        codprod,
        descr: produtoEstoque?.descr || '',
        estoqueTotal: estoqueArmazem?.qtest || 0,
        estoqueReservado: estoqueArmazem?.qtestReservada || 0,
        estoqueOrigem: estoqueArmazem?.qtestDisponivel || 0,
        quantidade: 0,
        selecionado: (estoqueArmazem?.qtestDisponivel || 0) > 0,
      });
    }

    setItens(novosItens);
  }, [armIdOrigem, selectedProducts, estoqueProdutos]);

  // Conta produtos sem alocação
  const produtosSemAlocacao = React.useMemo(() => {
    const alocados = new Set(estoqueProdutos.map((p) => p.codprod));
    return Array.from(selectedProducts).filter((codprod) => !alocados.has(codprod));
  }, [selectedProducts, estoqueProdutos]);

  // Handler para aplicar quantidade global a todos os itens selecionados
  const handleAplicarParaTodos = () => {
    const qtd = parseFloat(quantidadeGlobal);
    if (isNaN(qtd) || qtd <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade válida maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    setItens((prev) =>
      prev.map((item) => {
        if (!item.selecionado) return item;
        // Limita pela quantidade disponível
        const qtdFinal = Math.min(qtd, item.estoqueOrigem);
        return { ...item, quantidade: qtdFinal };
      })
    );

    toast({
      title: 'Quantidade aplicada',
      description: `Quantidade ${qtd} aplicada aos itens selecionados.`,
    });
  };

  // Handler para aplicar "todo estoque" para todos os itens selecionados
  const handleTodoEstoqueParaTodos = () => {
    setItens((prev) =>
      prev.map((item) => {
        if (!item.selecionado) return item;
        return { ...item, quantidade: item.estoqueOrigem };
      })
    );

    toast({
      title: 'Todo estoque aplicado',
      description: 'Quantidade total disponível aplicada aos itens selecionados.',
    });
  };

  // Handler para alterar quantidade de um item específico
  const handleQuantidadeItem = (codprod: string, quantidade: string) => {
    const qtd = parseFloat(quantidade) || 0;
    setItens((prev) =>
      prev.map((item) => {
        if (item.codprod !== codprod) return item;
        return { ...item, quantidade: Math.min(qtd, item.estoqueOrigem) };
      })
    );
  };

  // Handler para selecionar/desselecionar item
  const handleToggleItem = (codprod: string) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.codprod !== codprod) return item;
        return { ...item, selecionado: !item.selecionado };
      })
    );
  };

  // Handler para selecionar/desselecionar todos
  const handleToggleTodos = () => {
    const todosSelecionados = itens.filter((i) => i.estoqueOrigem > 0).every((i) => i.selecionado);
    setItens((prev) =>
      prev.map((item) => ({
        ...item,
        selecionado: item.estoqueOrigem > 0 ? !todosSelecionados : false,
      }))
    );
  };

  // Calcula totais
  const itensSelecionados = itens.filter((i) => i.selecionado && i.quantidade > 0);
  const totalItens = itensSelecionados.length;
  const totalQuantidade = itensSelecionados.reduce((acc, item) => acc + item.quantidade, 0);

  const handleTransferir = async () => {
    if (!armIdOrigem) {
      toast({
        title: 'Armazém de origem não selecionado',
        description: 'Selecione o armazém de origem.',
        variant: 'destructive',
      });
      return;
    }

    if (!armIdDestino) {
      toast({
        title: 'Armazém de destino não selecionado',
        description: 'Selecione o armazém de destino.',
        variant: 'destructive',
      });
      return;
    }

    if (armIdOrigem === armIdDestino) {
      toast({
        title: 'Armazéns iguais',
        description: 'Origem e destino devem ser diferentes.',
        variant: 'destructive',
      });
      return;
    }

    if (totalItens === 0) {
      toast({
        title: 'Nenhum item para transferir',
        description: 'Selecione itens e informe quantidades para transferir.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const itensParaTransferir = itensSelecionados.map((item) => ({
        codprod: item.codprod,
        quantidade: item.quantidade,
      }));

      const response = await fetch('/api/armazem/transferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          armIdOrigem: parseInt(armIdOrigem, 10),
          armIdDestino: parseInt(armIdDestino, 10),
          itens: itensParaTransferir,
          obs: obs || undefined,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.message || resultado.error || 'Erro na transferência');
      }

      toast({
        title: 'Transferência realizada!',
        description: resultado.message,
      });

      // Limpar campos
      setArmIdOrigem('');
      setArmIdDestino('');
      setItens([]);
      setObs('');
      setQuantidadeGlobal('');

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Erro na transferência:', error);
      toast({
        title: 'Erro na transferência',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setArmIdOrigem('');
      setArmIdDestino('');
      setItens([]);
      setObs('');
      setQuantidadeGlobal('');
      setEstoqueProdutos([]);
      onClose();
    }
  };

  // Verifica se não há nenhum produto com estoque
  const nenhumProdutoComEstoque = armazensComEstoque.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência em Massa
          </DialogTitle>
          <DialogDescription>
            Transferir <strong>{selectedProducts.size}</strong> produto(s) entre armazéns
          </DialogDescription>
        </DialogHeader>

        {loadingArmazens || loadingEstoque ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : nenhumProdutoComEstoque ? (
          // Nenhum produto com estoque disponível
          <div className="py-6">
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Nenhum produto com estoque disponível
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Os {selectedProducts.size} produto(s) selecionado(s) não possuem estoque
                  disponível em nenhum armazém para transferência.
                </p>
                {produtosSemAlocacao.length > 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                    {produtosSemAlocacao.length} produto(s) não está(ão) alocado(s) em nenhum armazém.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Aviso de produtos sem alocação */}
            {produtosSemAlocacao.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>{produtosSemAlocacao.length}</strong> produto(s) não está(ão) alocado(s)
                  em nenhum armazém e não aparecerão na lista.
                </div>
              </div>
            )}

            {/* Seleção de Armazéns - Lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              {/* Armazém de Origem */}
              <div className="space-y-2">
                <Label>
                  Armazém de Origem <span className="text-red-500">*</span>
                </Label>
                {armazensComEstoque.length === 1 ? (
                  // Apenas 1 armazém - mostra como informativo
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">
                        {armazensComEstoque[0].nome}
                      </span>
                    </div>
                  </div>
                ) : (
                  // Múltiplos armazéns - mostra select
                  <Select value={armIdOrigem} onValueChange={setArmIdOrigem} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem..." />
                    </SelectTrigger>
                    <SelectContent>
                      {armazensComEstoque.map((arm) => (
                        <SelectItem key={arm.id_armazem} value={arm.id_armazem.toString()}>
                          {arm.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Armazém de Destino */}
              <div className="space-y-2">
                <Label>
                  Armazém de Destino <span className="text-red-500">*</span>
                </Label>
                <Select value={armIdDestino} onValueChange={setArmIdDestino} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {armazens
                      .filter((arm) => arm.id_armazem.toString() !== armIdOrigem)
                      .map((arm) => (
                        <SelectItem key={arm.id_armazem} value={arm.id_armazem.toString()}>
                          {arm.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Aplicar quantidade em massa e Observação */}
            {armIdOrigem && itens.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {/* Aplicar em Massa */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      Aplicar em Massa
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={quantidadeGlobal}
                      onChange={(e) => setQuantidadeGlobal(e.target.value)}
                      placeholder="Qtd..."
                      className="w-24 h-8"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAplicarParaTodos}
                      disabled={loading || !quantidadeGlobal}
                      className="h-8 text-xs"
                    >
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTodoEstoqueParaTodos}
                      disabled={loading}
                      className="h-8 text-xs"
                    >
                      Todo Estoque
                    </Button>
                  </div>
                </div>

                {/* Observação */}
                <div className="space-y-2">
                  <Label className="text-sm">Observação (opcional)</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Observação..."
                    rows={2}
                    disabled={loading}
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            )}

            {/* Lista de Itens */}
            {armIdOrigem && itens.length > 0 && (
              <div className="border rounded-lg">
                {/* Header da lista */}
                <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 border-b text-xs font-medium">
                  <div className="w-8">
                    <Checkbox
                      checked={itens.filter((i) => i.estoqueOrigem > 0).every((i) => i.selecionado)}
                      onCheckedChange={handleToggleTodos}
                      disabled={loading}
                    />
                  </div>
                  <div className="w-20">Código</div>
                  <div className="flex-1">Descrição</div>
                  <div className="w-20 text-center" title="Quantidade disponível para transferência (R = Reservado para vendas)">
                    Disp. (R)
                  </div>
                  <div className="w-28 text-center">Quantidade</div>
                </div>

                {/* Lista de itens */}
                <ScrollArea className="h-[200px]">
                  {itens.map((item) => (
                    <div
                      key={item.codprod}
                      className={`flex items-center gap-4 p-2 border-b last:border-b-0 text-sm ${
                        item.estoqueOrigem === 0 ? 'opacity-50 bg-gray-50 dark:bg-gray-900' : ''
                      }`}
                    >
                      <div className="w-8">
                        <Checkbox
                          checked={item.selecionado}
                          onCheckedChange={() => handleToggleItem(item.codprod)}
                          disabled={loading || item.estoqueOrigem === 0}
                        />
                      </div>
                      <div className="w-20 font-mono text-xs">{item.codprod}</div>
                      <div className="flex-1 text-xs truncate" title={item.descr}>
                        {item.descr || 'Sem descrição'}
                      </div>
                      <div className="w-20 text-center">
                        {item.estoqueOrigem > 0 ? (
                          <div>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {item.estoqueOrigem}
                            </span>
                            {item.estoqueReservado > 0 && (
                              <div className="text-[10px] text-orange-500" title={`${item.estoqueReservado} unid. reservadas para vendas`}>
                                (R: {item.estoqueReservado})
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-red-500 text-xs">0</span>
                            {item.estoqueReservado > 0 && (
                              <div className="text-[10px] text-orange-500">
                                (R: {item.estoqueReservado})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          min="0"
                          max={item.estoqueOrigem}
                          value={item.quantidade || ''}
                          onChange={(e) => handleQuantidadeItem(item.codprod, e.target.value)}
                          disabled={loading || !item.selecionado || item.estoqueOrigem === 0}
                          className="text-center h-7 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </ScrollArea>

                {/* Footer com totais */}
                <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-t text-sm">
                  <div>
                    <span className="text-muted-foreground">Itens: </span>
                    <strong>{totalItens}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <strong>{totalQuantidade}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso */}
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-2 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-orange-800 dark:text-orange-200">
                <div>A transferência afetará o estoque de <strong>{totalItens}</strong> produto(s) imediatamente.</div>
                <div className="mt-1 text-[10px] opacity-80">
                  <strong>(R)</strong> = Quantidade reservada para vendas em andamento (não pode ser transferida)
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {nenhumProdutoComEstoque ? 'Fechar' : 'Cancelar'}
          </Button>
          {!nenhumProdutoComEstoque && (
            <Button
              onClick={handleTransferir}
              disabled={loading || !armIdOrigem || !armIdDestino || totalItens === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transferir {totalItens} Produto(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
