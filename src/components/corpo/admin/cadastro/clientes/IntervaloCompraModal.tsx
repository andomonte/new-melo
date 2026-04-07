import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { X, Calendar, FileDown } from 'lucide-react';
import { Cliente } from '@/data/clientes/clientes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface IntervaloCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

interface Compra {
  nf: string;
  data: string;
  valorTotal: number;
  status: string;
}

export function IntervaloCompraModal({
  isOpen,
  onClose,
  cliente,
}: IntervaloCompraModalProps) {
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [searched, setSearched] = useState(false);

  const handleConsultar = async () => {
    if (!dataInicio || !dataFim) {
      toast.error('Preencha ambas as datas');
      return;
    }

    if (!cliente) {
      toast.error('Cliente não identificado');
      return;
    }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (inicio > fim) {
      toast.error('Data inicial não pode ser maior que data final');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/clientes/${cliente.codcli}/compras-intervalo?dataInicio=${dataInicio}&dataFim=${dataFim}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao consultar compras');
      }

      const data = await response.json();
      setCompras(data.compras);

      toast.success(`${data.compras.length} compra(s) encontrada(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao consultar compras',
      );
      setCompras([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = () => {
    if (compras.length === 0) {
      toast.error('Nenhuma compra para exportar');
      return;
    }

    // TODO: Implementar exportação para Excel
    toast.success('Exportando para Excel...');
  };

  const handleClose = () => {
    setDataInicio('');
    setDataFim('');
    setCompras([]);
    setSearched(false);
    onClose();
  };

  const totalGeral = compras
    .filter((c) => c.status !== 'Cancelada')
    .reduce((sum, c) => sum + c.valorTotal, 0);

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="text-lg font-bold text-blue-600 dark:text-blue-300">
                Consulta de Compras por Período
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Cliente: {cliente.codcli} - {cliente.nome}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50 dark:bg-zinc-900">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-md space-y-6 max-w-6xl mx-auto">
            {/* Filtros */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={handleConsultar}
                  disabled={loading || !dataInicio || !dataFim}
                  className="flex-1"
                >
                  {loading ? 'Consultando...' : 'Consultar'}
                </Button>
                {compras.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleExportar}
                    disabled={loading}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Resumo */}
            {searched && compras.length > 0 && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Total de Compras:
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {compras.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Compras Concluídas:
                  </div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {compras.filter((c) => c.status === 'Concluída').length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Valor Total:
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    R${' '}
                    {totalGeral.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de Resultados */}
            {searched && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NF</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compras.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Nenhuma compra encontrada no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      compras.map((compra, idx) => (
                        <TableRow
                          key={idx}
                          className={
                            compra.status === 'Cancelada'
                              ? 'bg-red-50 dark:bg-red-950/20'
                              : ''
                          }
                        >
                          <TableCell className="font-medium">
                            {compra.nf}
                          </TableCell>
                          <TableCell>{compra.data}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              compra.status === 'Cancelada'
                                ? 'text-red-600 dark:text-red-400 line-through'
                                : ''
                            }`}
                          >
                            R${' '}
                            {compra.valorTotal.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                compra.status === 'Concluída'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {compra.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Estado vazio */}
            {!searched && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Selecione o período e clique em Consultar</p>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
