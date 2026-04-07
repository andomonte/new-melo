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
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2, FileDown, Search } from 'lucide-react';
import { Produto } from '@/data/produtos/produtos';

interface ExtratoItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
}

interface Movimentacao {
  data: string;
  nro_documento: string;
  nota_fiscal: string;
  cliente_fornecedor: string;
  operacao: string;
  preco_unitario: number;
  quantidade: number;
  armazem: string;
}

interface Stats {
  estoqueDisponivel: number;
  estoqueFisico: number;
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  precoMedio: number;
}

export const ExtratoItemModal: React.FC<ExtratoItemModalProps> = ({
  isOpen,
  onClose,
  produto,
}) => {
  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [stats, setStats] = useState<Stats>({
    estoqueDisponivel: 0,
    estoqueFisico: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
    precoMedio: 0,
  });

  // Filtros - padrão últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const [dataInicial, setDataInicial] = useState(
    trintaDiasAtras.toISOString().split('T')[0],
  );
  const [dataFinal, setDataFinal] = useState(hoje.toISOString().split('T')[0]);
  const [armazem, setArmazem] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && produto) {
      fetchExtrato();
    }
  }, [isOpen, produto]);

  const fetchExtrato = async () => {
    if (!produto) return;

    setLoading(true);
    try {
      const response = await fetch('/api/produtos/extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codprod: produto.codprod,
          dataInicial,
          dataFinal,
          armazem: armazem || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar extrato');
      }

      const data = await response.json();
      console.log('📊 Dados do Extrato recebidos:', data);
      console.log('📊 Total de movimentações:', data.movimentacoes?.length || 0);
      console.log('📊 Stats:', data.stats);

      setMovimentacoes(data.movimentacoes || []);
      setStats(
        data.stats || {
          estoqueDisponivel: 0,
          estoqueFisico: 0,
          totalEntradas: 0,
          totalSaidas: 0,
          saldo: 0,
          precoMedio: 0,
        },
      );
    } catch (error: any) {
      console.error('❌ Erro ao buscar extrato:', error);
      toast({
        title: 'Erro ao carregar extrato',
        description: error.message,
        variant: 'destructive',
      });
      setMovimentacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = () => {
    fetchExtrato();
  };

  const handleExportExcel = () => {
    toast({
      title: 'Exportar para Excel',
      description: 'Funcionalidade em desenvolvimento.',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const getOperacaoColor = (operacao: string) => {
    switch (operacao) {
      case 'ENTRADA':
      case 'DEVOLUÇÃO':
        return 'text-green-600 dark:text-green-400';
      case 'VENDA':
      case 'TRANSFERÊNCIA':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato de Item
          </DialogTitle>
          <DialogDescription>
            {produto.codprod} - {produto.descr}
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="dataInicial">Data Inicial</Label>
            <Input
              id="dataInicial"
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataFinal">Data Final</Label>
            <Input
              id="dataFinal"
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="armazem">Armazém</Label>
            <Select value={armazem} onValueChange={setArmazem} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="1">MANAUS</SelectItem>
                <SelectItem value="2">PORTO VELHO</SelectItem>
                <SelectItem value="3">FORTALEZA</SelectItem>
                <SelectItem value="4">RECIFE</SelectItem>
                <SelectItem value="5">JOÃO PESSOA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleBuscar} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tabela de Movimentações */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="p-2 text-left">DATA</th>
                  <th className="p-2 text-left">Nº DOC</th>
                  <th className="p-2 text-left">NOTA FISCAL</th>
                  <th className="p-2 text-left">CLIENTE / FORNECEDOR</th>
                  <th className="p-2 text-left">OPERAÇÃO</th>
                  <th className="p-2 text-right">PREÇO UNIT.</th>
                  <th className="p-2 text-right">QUANTIDADE</th>
                  <th className="p-2 text-left">ARMAZÉM</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      Nenhuma movimentação encontrada no período
                    </td>
                  </tr>
                ) : (
                  movimentacoes.map((mov, index) => (
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <td className="p-2">{formatDate(mov.data)}</td>
                      <td className="p-2">{mov.nro_documento || '-'}</td>
                      <td className="p-2">{mov.nota_fiscal || '-'}</td>
                      <td className="p-2">{mov.cliente_fornecedor || '-'}</td>
                      <td className={`p-2 font-semibold ${getOperacaoColor(mov.operacao)}`}>
                        {mov.operacao}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(mov.preco_unitario)}
                      </td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          parseFloat(String(mov.quantidade)) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {parseFloat(String(mov.quantidade)) > 0 ? '+' : ''}
                        {mov.quantidade}
                      </td>
                      <td className="p-2">{mov.armazem || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-6 gap-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Estoque Disp.:</p>
            <p className="text-lg font-semibold">{stats.estoqueDisponivel.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estoque Físico:</p>
            <p className="text-lg font-semibold">{stats.estoqueFisico.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">(E) Entradas:</p>
            <p className="text-lg font-semibold text-green-600">
              {stats.totalEntradas.toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">(S) Saídas:</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.totalSaidas.toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo de Movimento:</p>
            <p className="text-lg font-semibold">{stats.saldo.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Preço Médio de Venda:</p>
            <p className="text-lg font-semibold">{formatCurrency(stats.precoMedio)}</p>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleExportExcel}>
            <FileDown className="mr-2 h-4 w-4" />
            EXCEL
          </Button>
          <Button onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
