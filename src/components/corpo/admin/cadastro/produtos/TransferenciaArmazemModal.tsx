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

interface TransferenciaArmazemModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: {
    codprod: string;
    descr?: string;
  } | null;
  onSuccess?: () => void;
}

export const TransferenciaArmazemModal: React.FC<TransferenciaArmazemModalProps> = ({
  isOpen,
  onClose,
  produto,
  onSuccess,
}) => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoqueInfo, setEstoqueInfo] = useState<ProdutoEstoque | null>(null);
  const [armIdOrigem, setArmIdOrigem] = useState<string>('');
  const [armIdDestino, setArmIdDestino] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [obs, setObs] = useState<string>('');
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

  // Carrega estoque do produto quando abrir o modal
  useEffect(() => {
    if (!isOpen || !produto?.codprod) return;

    const fetchEstoque = async () => {
      setLoadingEstoque(true);
      try {
        const response = await fetch('/api/armazem/estoque-produto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codprods: [produto.codprod] }),
        });

        if (!response.ok) throw new Error('Erro ao carregar estoque');

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const estoqueData = data.data[0];
          setEstoqueInfo(estoqueData);

          // Se só tem um armazém com estoque, seleciona automaticamente
          const armazensComEstoque = estoqueData.armazens.filter(
            (a: EstoqueArmazem) => a.qtestDisponivel > 0
          );
          if (armazensComEstoque.length === 1) {
            setArmIdOrigem(armazensComEstoque[0].armId.toString());
          }
        } else {
          setEstoqueInfo({
            codprod: produto.codprod,
            descr: produto.descr || '',
            armazens: [],
          });
        }
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
  }, [isOpen, produto, toast]);

  // Armazéns com estoque disponível
  const armazensComEstoque = estoqueInfo?.armazens.filter(
    (a) => a.qtestDisponivel > 0
  ) || [];

  // Encontra informação do estoque no armazém de origem selecionado
  const estoqueOrigem = estoqueInfo?.armazens.find(
    (a) => a.armId === parseInt(armIdOrigem, 10)
  );

  // Verifica se produto não está alocado em nenhum armazém
  const semAlocacao = estoqueInfo && estoqueInfo.armazens.length === 0;
  const semEstoque = estoqueInfo && armazensComEstoque.length === 0 && estoqueInfo.armazens.length > 0;

  // Handler para definir quantidade = todo estoque disponível
  const handleTodoEstoque = () => {
    if (estoqueOrigem) {
      setQuantidade(estoqueOrigem.qtestDisponivel.toString());
    }
  };

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

    const qtd = parseFloat(quantidade);
    if (!quantidade || isNaN(qtd) || qtd <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade válida maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (estoqueOrigem && qtd > estoqueOrigem.qtestDisponivel) {
      toast({
        title: 'Quantidade insuficiente',
        description: `Estoque disponível: ${estoqueOrigem.qtestDisponivel}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/armazem/transferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          armIdOrigem: parseInt(armIdOrigem, 10),
          armIdDestino: parseInt(armIdDestino, 10),
          itens: [
            {
              codprod: produto?.codprod,
              quantidade: qtd,
            },
          ],
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
      setQuantidade('');
      setObs('');

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
      setQuantidade('');
      setObs('');
      setEstoqueInfo(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência de Armazém
          </DialogTitle>
          <DialogDescription>
            Transferir produto entre armazéns
          </DialogDescription>
        </DialogHeader>

        {loadingArmazens || loadingEstoque ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : semAlocacao ? (
          // Produto não está alocado em nenhum armazém
          <div className="py-6">
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Produto não alocado
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  O produto <strong>{produto?.codprod}</strong> não está alocado em nenhum armazém.
                  Não é possível realizar transferência.
                </p>
              </div>
            </div>
          </div>
        ) : semEstoque ? (
          // Produto está alocado mas não tem estoque disponível
          <div className="py-6">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                  Sem estoque disponível
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  O produto <strong>{produto?.codprod}</strong> não possui estoque disponível
                  para transferência em nenhum armazém.
                </p>
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Armazéns alocados:
                  {estoqueInfo?.armazens.map((arm) => (
                    <span key={arm.armId} className="ml-2">
                      {arm.armDescricao} (Estoque: {arm.qtest}, Reservado: {arm.qtestReservada})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Informações do Produto */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-800 dark:text-blue-200">Produto</span>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{produto?.codprod}</strong> - {estoqueInfo?.descr || produto?.descr || 'Sem descrição'}
              </div>
            </div>

            {/* Armazéns - Lado a lado */}
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
                        {armazensComEstoque[0].armDescricao}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 pl-6">
                      Disponível: <span className="font-medium text-green-600 dark:text-green-400">{armazensComEstoque[0].qtestDisponivel}</span>
                      {armazensComEstoque[0].qtestReservada > 0 && (
                        <span className="text-orange-500 ml-2">
                          (Reservado: {armazensComEstoque[0].qtestReservada})
                        </span>
                      )}
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
                        <SelectItem key={arm.armId} value={arm.armId.toString()}>
                          {arm.armDescricao} (Disp: {arm.qtestDisponivel}
                          {arm.qtestReservada > 0 ? `, Reserv: ${arm.qtestReservada}` : ''})
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

            {/* Quantidade e Observação - Lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              {/* Quantidade */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Quantidade <span className="text-red-500">*</span>
                  </Label>
                  {estoqueOrigem && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={handleTodoEstoque}
                      disabled={loading}
                    >
                      Todo Estoque ({estoqueOrigem.qtestDisponivel})
                    </Button>
                  )}
                </div>
                <Input
                  type="number"
                  min="1"
                  max={estoqueOrigem?.qtestDisponivel || 999999}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Quantidade..."
                  disabled={loading}
                />
                {estoqueOrigem && (
                  <p className="text-xs text-muted-foreground">
                    Disponível: {estoqueOrigem.qtestDisponivel} unidades
                  </p>
                )}
              </div>

              {/* Observação */}
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Observação..."
                  rows={2}
                  disabled={loading}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Aviso */}
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <div>A transferência será registrada no histórico e afetará o estoque imediatamente.</div>
                {estoqueOrigem && estoqueOrigem.qtestReservada > 0 && (
                  <div className="mt-1 text-xs opacity-80">
                    Obs: {estoqueOrigem.qtestReservada} unid. estão reservadas para vendas em andamento.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {semAlocacao || semEstoque ? 'Fechar' : 'Cancelar'}
          </Button>
          {!semAlocacao && !semEstoque && (
            <Button
              onClick={handleTransferir}
              disabled={loading || !armIdOrigem || !armIdDestino || !quantidade}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transferir
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
