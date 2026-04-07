import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown, Eye } from 'lucide-react';
import { Cliente } from '@/data/clientes/clientes';
import { useToast } from '@/hooks/use-toast';

interface Titulo {
  documento: string;
  codReceita: string;
  dtEmissao: string;
  dtVenc: string;
  valor: number;
  atraso?: number;
}

interface DadosZoom {
  // Dados Cadastrais
  codigo: string;
  id: string;
  razaoSocial: string;
  dataCadastro: string;
  classe: string;
  banco: string;
  status: string;

  // Dados Comerciais
  acrescimo: number;
  desconto: number;
  descontoAplicado: string;
  precoVenda: number;
  kickback: number;
  bloquearPreco: string;
  vendedorExterno: string;

  // Dados Financeiros
  limiteCredito: number;
  saldoDisponivel: number;
  ultimaCompra: {
    nf: string;
    data: string;
    valorTotal: number;
  };
  maiorCompra: {
    nf: string;
    data: string;
    valorTotal: number;
  };
  maiorAtraso: {
    periodo: string;
    valorTotalAcumulado: number;
  };
  valorTotalReceber: number;
  valorTotalVencido: number;

  // Títulos
  titulosAberto: Titulo[];
}

interface ClientZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

export function ClientZoomModal({
  isOpen,
  onClose,
  cliente,
}: ClientZoomModalProps) {
  const [loading, setLoading] = useState(false);
  const [dadosZoom, setDadosZoom] = useState<DadosZoom | null>(null);
  const [showAllTitles, setShowAllTitles] = useState(false);
  const { toast } = useToast();

  const fetchDadosZoom = useCallback(async () => {
    if (!cliente) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/clientes/${cliente.codcli}/zoom`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar dados');
      }

      const data = await response.json();
      setDadosZoom(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os dados detalhados do cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [cliente, toast]);

  useEffect(() => {
    if (isOpen && cliente) {
      fetchDadosZoom();
    }
  }, [isOpen, cliente, fetchDadosZoom]);

  const handleExportarTitulos = () => {
    toast({
      title: 'Exportar Títulos',
      description: 'Gerando arquivo Excel...',
    });
    // Implementar exportação
  };

  const titulosVisiveis = showAllTitles
    ? dadosZoom?.titulosAberto || []
    : (dadosZoom?.titulosAberto || []).slice(0, 10);

  const valorAVencer =
    dadosZoom?.titulosAberto
      .filter((t) => !t.atraso || t.atraso === 0)
      .reduce((sum, t) => sum + t.valor, 0) || 0;

  const valorVencido = dadosZoom?.valorTotalVencido || 0;

  if (!cliente) return null;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
              Cliente :: Zoom
            </h4>
          </header>
          <button
            onClick={onClose}
            className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
          <div className="p-6">
            <div className="shadow-md rounded-lg max-w-[1400px] mx-auto p-6 bg-white dark:bg-zinc-800">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <Tabs defaultValue="dados" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dados">Dados do Cliente</TabsTrigger>
                    <TabsTrigger value="titulos">Títulos</TabsTrigger>
                  </TabsList>

                  {/* Aba Dados do Cliente */}
                  <TabsContent value="dados" className="space-y-4">
                    {/* Cabeçalho com Info Básica - Linha 1 */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-zinc-900/50">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Código:
                          </span>
                          <span className="ml-2 font-semibold">
                            {dadosZoom?.codigo || cliente.codcli}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Id:
                          </span>
                          <span className="ml-2 font-semibold">
                            {dadosZoom?.id || cliente.codcli}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Razão Social:
                          </span>
                          <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                            {dadosZoom?.razaoSocial || cliente.nome}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Data Cadastro:
                          </span>
                          <span className="ml-2">
                            {dadosZoom?.dataCadastro || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Classe:
                          </span>
                          <span className="ml-2">
                            {dadosZoom?.classe || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Banco:
                          </span>
                          <span className="ml-2">
                            {dadosZoom?.banco || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Status:
                          </span>
                          <span
                            className={`ml-2 font-semibold ${
                              dadosZoom?.status?.includes('AUTORIZADO')
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {dadosZoom?.status || 'SEM CRÉDITO'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco: Limite Crédito e Saldo - DESTAQUE */}
                    <div className="border-2 border-blue-300 dark:border-blue-700 rounded-md p-4 bg-blue-50 dark:bg-blue-950/20">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Limite Crédito:
                          </div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            R${' '}
                            {(dadosZoom?.limiteCredito || 0).toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Saldo Disponível:
                          </div>
                          <div
                            className={`text-2xl font-bold ${
                              (dadosZoom?.saldoDisponivel || 0) < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            R${' '}
                            {(dadosZoom?.saldoDisponivel || 0).toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloco: Última Compra, Maior Compra, Maior Atraso */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-zinc-800">
                      <div className="space-y-4">
                        {/* Última Compra */}
                        <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Última Compra
                          </div>
                          <div className="grid grid-cols-3 gap-x-6 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                NF:
                              </span>
                              <span className="ml-2">
                                {dadosZoom?.ultimaCompra?.nf || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Data:
                              </span>
                              <span className="ml-2">
                                {dadosZoom?.ultimaCompra?.data || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Valor Total:
                              </span>
                              <span className="ml-2 font-semibold">
                                R${' '}
                                {(
                                  dadosZoom?.ultimaCompra?.valorTotal || 0
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Maior Compra */}
                        <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Maior Compra
                          </div>
                          <div className="grid grid-cols-3 gap-x-6 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                NF:
                              </span>
                              <span className="ml-2">
                                {dadosZoom?.maiorCompra?.nf || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Data:
                              </span>
                              <span className="ml-2">
                                {dadosZoom?.maiorCompra?.data || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Valor Total:
                              </span>
                              <span className="ml-2 font-semibold">
                                R${' '}
                                {(
                                  dadosZoom?.maiorCompra?.valorTotal || 0
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Maior Atraso */}
                        <div>
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Maior Acumulado
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Período (Mês/Ano):
                              </span>
                              <span className="ml-2">
                                {dadosZoom?.maiorAtraso?.periodo || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Valor Total Acumulado:
                              </span>
                              <span className="ml-2 font-semibold">
                                R${' '}
                                {(
                                  dadosZoom?.maiorAtraso?.valorTotalAcumulado ||
                                  0
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo de Valores - Totais */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-zinc-800">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Valor Total de Contas a Receber:
                          </div>
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            R${' '}
                            {(dadosZoom?.valorTotalReceber || 0).toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Valor Total Vencido:
                          </div>
                          <div className="text-xl font-bold text-red-600 dark:text-red-400">
                            R${' '}
                            {(dadosZoom?.valorTotalVencido || 0).toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Aba Títulos */}
                  <TabsContent value="titulos" className="space-y-4">
                    {/* Header com valores e ações */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-zinc-800">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-8">
                          <div>
                            <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                              Total a Vencer:
                            </span>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              R${' '}
                              {valorAVencer.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                              Total Vencido:
                            </span>
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">
                              R${' '}
                              {valorVencido.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllTitles(!showAllTitles)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {showAllTitles
                              ? 'Mostrar Menos'
                              : 'Visualizar Títulos'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportarTitulos}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Exportar Excel
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {showAllTitles
                          ? `Exibindo ${
                              dadosZoom?.titulosAberto?.length || 0
                            } de ${
                              dadosZoom?.titulosAberto?.length || 0
                            } títulos`
                          : `Exibindo 10 de ${
                              dadosZoom?.titulosAberto?.length || 0
                            } títulos`}
                      </div>
                    </div>

                    {/* Tabela de Títulos */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-zinc-900">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Documento</TableHead>
                            <TableHead>Conta</TableHead>
                            <TableHead>Dt. Emissão</TableHead>
                            <TableHead>Dt. Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">
                              Atraso (dias)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {titulosVisiveis.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-8 text-muted-foreground"
                              >
                                Nenhum título em aberto
                              </TableCell>
                            </TableRow>
                          ) : (
                            titulosVisiveis.map((titulo, idx) => (
                              <TableRow
                                key={idx}
                                className={
                                  titulo.atraso && titulo.atraso > 0
                                    ? 'bg-red-50 dark:bg-red-950/20'
                                    : ''
                                }
                              >
                                <TableCell
                                  className={
                                    titulo.atraso && titulo.atraso > 0
                                      ? 'text-red-600 dark:text-red-400 font-medium'
                                      : ''
                                  }
                                >
                                  {titulo.documento}
                                </TableCell>
                                <TableCell>
                                  {titulo.codReceita || '-'}
                                </TableCell>
                                <TableCell>{titulo.dtEmissao || '-'}</TableCell>
                                <TableCell
                                  className={
                                    titulo.atraso && titulo.atraso > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                  }
                                >
                                  {titulo.dtVenc || '-'}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-medium ${
                                    titulo.atraso && titulo.atraso > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                  }`}
                                >
                                  {titulo.valor > 0
                                    ? `R$ ${titulo.valor.toLocaleString(
                                        'pt-BR',
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}`
                                    : '0.00'}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-bold ${
                                    titulo.atraso && titulo.atraso > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                  }`}
                                >
                                  {titulo.atraso && titulo.atraso > 0
                                    ? titulo.atraso
                                    : '0'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé fixo */}
        <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-[100px] bg-white dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
