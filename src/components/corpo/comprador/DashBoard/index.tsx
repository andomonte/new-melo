// src/components/corpo/comprador/DashBoard/index.tsx

import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, ShoppingCart } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import SelectInput from '@/components/common/SelectInput';

import {
  type DateRange,
  type ComprasPorPeriodo,
  type ComprasMensais,
  type TopFornecedor,
  type StatusRequisicao,
  type TopProdutoComprado,
  comprasDashboardService,
} from '@/data/compras/dashboard';

import { ComprasChart } from './Charts/ComprasChart';
import { StatusRequisicoesChart } from './Charts/StatusRequisicoes';
import { ProdutosCompradosChart } from './Charts/ProdutosComprados';

const dateRangeOptions = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ultima_semana', label: 'Última Semana' },
  { value: 'ultimos_30_dias', label: 'Últimos 30 Dias' },
  { value: 'ultimo_trimestre', label: 'Último Trimestre' },
  { value: 'ultimo_ano', label: 'Último Ano' },
  { value: 'todo_periodo', label: 'Todo o período' },
];

const ComprasDashboard = () => {
  const getInitials = (name: string): string => {
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  };

  const getAvatarColor = (name: string, index: number): string => {
    const colors = [
      'bg-[#347AB6] text-white',
      'bg-[#CEE0EE] text-[#347AB6]',
      'bg-[#9CB4D4] text-white',
      'bg-[#E6F1F8] text-[#347AB6]',
      'bg-[#5A8BC4] text-white',
    ];
    return colors[index % colors.length];
  };

  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRange>('ultimos_30_dias');

  // Estados para dados
  const [comprasPeriodoData, setComprasPeriodoData] =
    useState<ComprasPorPeriodo | null>(null);
  const [chartData, setChartData] = useState<ComprasMensais[] | null>(null);
  const [topFornecedores, setTopFornecedores] = useState<TopFornecedor[] | null>(
    null,
  );
  const [statusRequisicoes, setStatusRequisicoes] = useState<
    StatusRequisicao[] | null
  >(null);
  const [topProdutos, setTopProdutos] = useState<TopProdutoComprado[] | null>(
    null,
  );

  // Estados de loading e erro
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        comprasPeriodoResponse,
        chartResponse,
        topFornecedoresResponse,
        statusRequisicoesResponse,
        topProdutosResponse,
      ] = await Promise.all([
        comprasDashboardService.getComprasPorPeriodo(),
        comprasDashboardService.getComprasMensais({ range: selectedDateRange }),
        comprasDashboardService.getTopFornecedores({ range: selectedDateRange }),
        comprasDashboardService.getStatusRequisicoes({ range: selectedDateRange }),
        comprasDashboardService.getTopProdutos({ range: selectedDateRange }),
      ]);

      setComprasPeriodoData(comprasPeriodoResponse);
      setChartData(chartResponse);
      setTopFornecedores(topFornecedoresResponse);
      setStatusRequisicoes(statusRequisicoesResponse);
      setTopProdutos(topProdutosResponse);
    } catch (err) {
      setError('Ocorreu um erro ao carregar os dados.');
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="flex flex-1 items-stretch justify-center w-full flex-col self-start bg-white dark:bg-gray-800">
      <div className="flex h-[calc(100vh-5rem)] max-w-full flex-col gap-6 overflow-y-auto p-3 md:p-4">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
          <h1 className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            Dashboard de Compras
          </h1>
          <div className="flex items-center gap-6">
            <DefaultButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              text="Atualizar"
              icon={
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              }
            />
            <div className="w-48">
              <SelectInput
                name="dateRange"
                options={dateRangeOptions}
                defaultValue={selectedDateRange}
                onValueChange={(value) =>
                  setSelectedDateRange(value as DateRange)
                }
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {error && !isLoading && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}{' '}
              <AuxButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                text="Tentar novamente"
                className="ml-2 h-auto bg-transparent p-0 underline hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
              />
            </AlertDescription>
          </Alert>
        )}

        {/* Cards KPI */}
        <div className="w-full flex justify-between items-center gap-6">
          <Card className="w-full bg-[#ECEEFB]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-wide text-black">
                Total Compras(R$) - Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-black">
                  {(comprasPeriodoData?.comprasDiarias ?? 0).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </div>
              )}
              <ShoppingCart className="h-5 w-5 text-[#347AB6]" />
            </CardContent>
          </Card>

          <Card className="w-full bg-[#CEE0EE]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black tracking-wide">
                Total Compras(R$) - Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-black">
                  {(comprasPeriodoData?.comprasSemanais ?? 0).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </div>
              )}
              <ShoppingCart className="h-5 w-5 text-[#347AB6]" />
            </CardContent>
          </Card>

          <Card className="w-full bg-[#ECEEFB]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black tracking-wide">
                Total Compras(R$) - Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-black">
                  {(comprasPeriodoData?.comprasMensais ?? 0).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </div>
              )}
              <ShoppingCart className="h-5 w-5 text-[#347AB6]" />
            </CardContent>
          </Card>

          <Card className="w-full bg-[#CEE0EE]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-black tracking-wide">
                Total Compras(R$) - Ano
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-black">
                  {(comprasPeriodoData?.comprasAnuais ?? 0).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </div>
              )}
              <ShoppingCart className="h-5 w-5 text-[#347AB6]" />
            </CardContent>
          </Card>
        </div>

        {/* Gráficos e Lista de Fornecedores */}
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex w-full items-center justify-between flex-1 gap-6">
            <div className="flex w-[90%] h-full flex-col gap-6">
              <ComprasChart
                data={chartData ?? undefined}
                isLoading={isLoading}
                error={error}
                selectedDateRange={selectedDateRange}
              />
              <div className="flex flex-row h-full gap-6">
                <StatusRequisicoesChart
                  data={statusRequisicoes ?? undefined}
                  isLoading={isLoading}
                  error={error}
                  selectedDateRange={selectedDateRange}
                />
                <ProdutosCompradosChart
                  data={topProdutos ?? undefined}
                  isLoading={isLoading}
                  error={error}
                  selectedDateRange={selectedDateRange}
                />
              </div>
            </div>

            {/* Lista de Fornecedores */}
            <div className="flex flex-col w-[33%] h-full">
              <Card className="flex flex-col min-h-full w-full bg-[#F9F9F9] dark:bg-[#09090B]">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Principais Fornecedores</CardTitle>
                  <CardDescription>por valor total de compras</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <div className="px-4 pb-4 space-y-3">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className="w-full flex items-center justify-start flex-row gap-3"
                        >
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                          <div className="flex flex-col w-full items-start justify-center gap-1">
                            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                          </div>
                        </div>
                      ))
                    ) : error ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-red-500 dark:text-red-400">
                          Erro ao carregar fornecedores
                        </p>
                      </div>
                    ) : topFornecedores && topFornecedores.length > 0 ? (
                      topFornecedores.slice(0, 8).map((fornecedor, index) => (
                        <div
                          key={fornecedor.codCredor}
                          className="w-full flex items-center justify-start flex-row gap-3"
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarFallback
                              className={`${getAvatarColor(
                                fornecedor.nomeFornecedor,
                                index,
                              )} text-sm font-bold`}
                            >
                              {getInitials(fornecedor.nomeFornecedor)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col w-full items-start justify-center">
                            <h3
                              className="text-xs font-medium text-black dark:text-white truncate max-w-[120px]"
                              title={fornecedor.nomeFornecedor}
                            >
                              {fornecedor.nomeFornecedor}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {fornecedor.totalCompras.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Nenhum fornecedor encontrado
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {isInitialLoad && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="flex items-center gap-3 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <RefreshCw className="h-5 w-5 animate-spin text-[#347AB6]" />
              <span className="text-sm font-medium">
                Carregando dashboard...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComprasDashboard;
