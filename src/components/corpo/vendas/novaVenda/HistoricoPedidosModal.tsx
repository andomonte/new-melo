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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  History,
  Loader2,
  Package,
  Truck,
  AlertCircle,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface HistoricoPedidosModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: {
    código?: string;
    codprod?: string;
    nome?: string;
    descr?: string;
  } | null;
  usuarioCod?: string;
  usuarioNome?: string;
}

interface Entrada {
  numero_documento: string;
  nota_fiscal: string;
  data_entrada: string;
  fornecedor: string;
  quantidade: number;
  preco_unitario: number;
  status: string;
}

interface PedidoPendente {
  numero_ordem: string;
  requisicao: string;
  data_ordem: string;
  status_descricao: string;
  fornecedor: string;
  quantidade: number;
  preco_unitario: number;
  previsao_chegada: string | null;
}

interface Sugestao {
  id: number;
  quantidade_sugerida: number;
  data_sugestao: string;
  data_necessidade: string | null;
  usuario_nome: string;
  observacao: string;
  status: string;
}

interface Stats {
  totalEntradas12m: number;
  qtdEntradas12m: number;
  temPedidoPendente: boolean;
}

export const HistoricoPedidosModal: React.FC<HistoricoPedidosModalProps> = ({
  isOpen,
  onClose,
  produto,
  usuarioCod,
  usuarioNome,
}) => {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoPendente[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEntradas12m: 0,
    qtdEntradas12m: 0,
    temPedidoPendente: false,
  });

  // Formulário de sugestão
  const [mostrarFormSugestao, setMostrarFormSugestao] = useState(false);
  const [quantidadeSugerida, setQuantidadeSugerida] = useState('1');
  const [dataNecessidade, setDataNecessidade] = useState('');
  const [observacao, setObservacao] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && produto) {
      fetchHistorico();
      setMostrarFormSugestao(false);
      setQuantidadeSugerida('1');
      setDataNecessidade('');
      setObservacao('');
    }
  }, [isOpen, produto]);

  const fetchHistorico = async () => {
    if (!produto) return;

    const codprod = produto.código || produto.codprod;
    if (!codprod) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/produtos/historico-pedidos?codprod=${encodeURIComponent(codprod)}`,
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar histórico');
      }

      const data = await response.json();
      setEntradas(data.entradas || []);
      setPedidosPendentes(data.pedidosPendentes || []);
      setSugestoes(data.sugestoes || []);
      setStats(
        data.stats || {
          totalEntradas12m: 0,
          qtdEntradas12m: 0,
          temPedidoPendente: false,
        },
      );
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: 'Erro ao carregar histórico',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarSugestao = async () => {
    if (!produto) return;

    const codprod = produto.código || produto.codprod;
    if (!codprod) return;

    if (!quantidadeSugerida || parseFloat(quantidadeSugerida) <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch('/api/produtos/sugestao-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_cod: codprod,
          produto_descricao: produto.nome || produto.descr || '',
          quantidade_sugerida: parseFloat(quantidadeSugerida),
          data_necessidade: dataNecessidade || null,
          usuario_cod: usuarioCod || null,
          usuario_nome: usuarioNome || null,
          observacao: observacao || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar sugestão');
      }

      toast({
        title: 'Sugestão registrada',
        description: 'Sua sugestão de compra foi registrada com sucesso!',
      });

      setMostrarFormSugestao(false);
      setQuantidadeSugerida('1');
      setDataNecessidade('');
      setObservacao('');
      fetchHistorico();
    } catch (error: any) {
      console.error('Erro ao salvar sugestão:', error);
      toast({
        title: 'Erro ao salvar sugestão',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'APROVADO':
      case 'EM TRANSITO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'RECEBIDO':
      case 'FINALIZADO':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CANCELADO':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!produto) return null;

  const codprod = produto.código || produto.codprod;
  const descricao = produto.nome || produto.descr;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[900px] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Pedidos
          </DialogTitle>
          <DialogDescription>
            {codprod} - {descricao}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Entradas (12 meses)</p>
                  <p className="text-lg font-semibold">{stats.qtdEntradas12m} pedidos</p>
                  <p className="text-sm text-muted-foreground">
                    Total: {stats.totalEntradas12m.toFixed(0)} unid.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos Pendentes</p>
                  <p className="text-lg font-semibold">{pedidosPendentes.length}</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.temPedidoPendente ? 'Há pedido em andamento' : 'Sem pedido pendente'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Sugestões Pendentes</p>
                  <p className="text-lg font-semibold">{sugestoes.length}</p>
                  <p className="text-sm text-muted-foreground">
                    {sugestoes.length > 0 ? 'Aguardando análise' : 'Nenhuma sugestão'}
                  </p>
                </div>
              </div>
            </div>

            {/* Pedidos Pendentes / Em Andamento */}
            {pedidosPendentes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-500" />
                  Pedidos em Andamento
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-100 dark:bg-orange-900">
                      <tr>
                        <th className="p-2 text-left">Ordem</th>
                        <th className="p-2 text-left">Fornecedor</th>
                        <th className="p-2 text-left">Data Pedido</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-left">Previsão</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosPendentes.map((pedido, index) => (
                        <tr
                          key={index}
                          className="border-t hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <td className="p-2 font-medium">{pedido.numero_ordem}</td>
                          <td className="p-2">{pedido.fornecedor || '-'}</td>
                          <td className="p-2">{formatDate(pedido.data_ordem)}</td>
                          <td className="p-2 text-right font-semibold">
                            {pedido.quantidade?.toFixed(0) || 0}
                          </td>
                          <td className="p-2">
                            {pedido.previsao_chegada ? (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Calendar className="h-3 w-3" />
                                {formatDate(pedido.previsao_chegada)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Não informada</span>
                            )}
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pedido.status_descricao)}`}
                            >
                              {pedido.status_descricao}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Histórico de Entradas */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Últimas Entradas Recebidas
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-green-100 dark:bg-green-900">
                    <tr>
                      <th className="p-2 text-left">Documento</th>
                      <th className="p-2 text-left">NF</th>
                      <th className="p-2 text-left">Fornecedor</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Preço Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entradas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          Nenhuma entrada nos últimos 12 meses
                        </td>
                      </tr>
                    ) : (
                      entradas.map((entrada, index) => (
                        <tr
                          key={index}
                          className="border-t hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <td className="p-2">{entrada.numero_documento || '-'}</td>
                          <td className="p-2">{entrada.nota_fiscal || '-'}</td>
                          <td className="p-2">{entrada.fornecedor || '-'}</td>
                          <td className="p-2">{formatDate(entrada.data_entrada)}</td>
                          <td className="p-2 text-right font-semibold text-green-600">
                            +{entrada.quantidade?.toFixed(0) || 0}
                          </td>
                          <td className="p-2 text-right">
                            {formatCurrency(entrada.preco_unitario)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sugestões de Compra */}
            {sugestoes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Sugestões de Compra Pendentes
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-yellow-100 dark:bg-yellow-900">
                      <tr>
                        <th className="p-2 text-left">Data Sugestão</th>
                        <th className="p-2 text-right">Qtd Sugerida</th>
                        <th className="p-2 text-left">Necessidade</th>
                        <th className="p-2 text-left">Usuário</th>
                        <th className="p-2 text-left">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sugestoes.map((sugestao) => (
                        <tr
                          key={sugestao.id}
                          className="border-t hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <td className="p-2">{formatDate(sugestao.data_sugestao)}</td>
                          <td className="p-2 text-right font-semibold">
                            {sugestao.quantidade_sugerida?.toFixed(0) || 0}
                          </td>
                          <td className="p-2">
                            {sugestao.data_necessidade
                              ? formatDate(sugestao.data_necessidade)
                              : '-'}
                          </td>
                          <td className="p-2">{sugestao.usuario_nome || '-'}</td>
                          <td className="p-2 text-muted-foreground">
                            {sugestao.observacao || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Formulário de Sugestão */}
            {!stats.temPedidoPendente && (
              <div className="border-t pt-4">
                {!mostrarFormSugestao ? (
                  <Button
                    variant="outline"
                    onClick={() => setMostrarFormSugestao(true)}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Sugerir Compra deste Item
                  </Button>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-4">
                    <h4 className="font-semibold">Nova Sugestão de Compra</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantidade">Quantidade Sugerida *</Label>
                        <Input
                          id="quantidade"
                          type="number"
                          min="1"
                          step="1"
                          value={quantidadeSugerida}
                          onChange={(e) => setQuantidadeSugerida(e.target.value)}
                          placeholder="Ex: 100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataNecessidade">Data de Necessidade</Label>
                        <Input
                          id="dataNecessidade"
                          type="date"
                          value={dataNecessidade}
                          onChange={(e) => setDataNecessidade(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="observacao">Observação</Label>
                      <Textarea
                        id="observacao"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        placeholder="Ex: Item com alta saída, estoque baixo..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setMostrarFormSugestao(false)}
                        disabled={salvando}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSalvarSugestao} disabled={salvando}>
                        {salvando ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Registrar Sugestão
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mensagem quando há pedido pendente */}
            {stats.temPedidoPendente && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  Este item já possui pedido em andamento. Aguarde a chegada do pedido.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
