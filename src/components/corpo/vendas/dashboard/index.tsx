// src/pages/vendas/dashboard/VendasDashboard.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';

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
  type TopSellingProduct,
  type VendasMensais,
  type VendasPorPeriodo,
  type TopCliente,
  dashboardService,
} from '@/data/vendas/dashboard';
import { VendasChart } from './Charts/VendasChart';
import { ChartPieDonut } from './Charts/ChartPieDonut';
import { ChartBarDefault } from './Charts/ChartBarDefault';

const dateRangeOptions = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ultima_semana', label: 'Última Semana' },
  { value: 'ultimos_30_dias', label: 'Últimos 30 Dias' },
  { value: 'ultimo_trimestre', label: 'Último Trimestre' },
  { value: 'ultimo_ano', label: 'Último Ano' },
  { value: 'todo_periodo', label: 'Todo o período' },
];

const VendasDashboard = () => {
  // Função auxiliar para obter as iniciais do nome (memoizada)
  const getInitials = useCallback((name: string): string => {
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  }, []);

  // Função auxiliar para gerar cores consistentes baseadas no nome (memoizada)
  const getAvatarColor = useCallback((name: string, index: number): string => {
    const colors = [
      'bg-[#347AB6] text-white',
      'bg-[#CEE0EE] text-[#347AB6]',
      'bg-[#9CB4D4] text-white',
      'bg-[#E6F1F8] text-[#347AB6]',
      'bg-[#5A8BC4] text-white',
    ];
    return colors[index % colors.length];
  }, []);

  const [selectedDateRange, setSelectedDateRange] =
    useState<DateRange>('ultimos_30_dias');

  // Estados para dados
  const [vendasPeriodoData, setVendasPeriodoData] =
    useState<VendasPorPeriodo | null>(null);
  const [chartData, setChartData] = useState<VendasMensais[] | null>(null);
  const [topProductsChart, setTopProductsChart] = useState<
    TopSellingProduct[] | null
  >(null);
  const [topClientes, setTopClientes] = useState<TopCliente[] | null>(null);

  // Estados de loading e erro
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Função de carregamento de dados otimizada com useCallback
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        vendasPeriodoResponse,
        chartResponse,
        topProductsChartResponse,
        topClientesResponse,
      ] = await Promise.all([
        dashboardService.getVendasPorPeriodo(),
        dashboardService.getVendasMensais({ range: selectedDateRange }),
        dashboardService.getTopProductsForChart({ range: selectedDateRange }),
        dashboardService.getTopClientes(),
      ]);

      setVendasPeriodoData(vendasPeriodoResponse);
      setChartData(chartResponse);
      setTopProductsChart(topProductsChartResponse);
      setTopClientes(topClientesResponse);
    } catch (err) {
      setError('Ocorreu um erro ao carregar os dados.');
      console.error('🚨 Erro ao carregar dados do dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [selectedDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return (
    <div className=" flex flex-1 items-stretch justify-center w-full flex-col self-start bg-white dark:bg-gray-800">
      <div className="flex h-[calc(100vh-5rem)] max-w-full flex-col gap-6 overflow-y-auto p-3 md:p-4">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
          <h1 className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            Dashboard de vendas
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

        <div className="w-full flex justify-between items-center gap-6 ">
          <Card className="w-full bg-blue-50 dark:bg-blue-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-wide text-foreground">
                Total Faturado(R$) - Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-foreground">
                  {(vendasPeriodoData?.vendasDiarias ?? 0).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    },
                  )}
                </div>
              )}
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardContent>
          </Card>

          <Card className="w-full bg-cyan-50 dark:bg-cyan-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground tracking-wide">
                Total Faturado(R$) - Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-foreground">
                  {(vendasPeriodoData?.vendasSemanais ?? 0).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    },
                  )}
                </div>
              )}
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardContent>
          </Card>

          <Card className="w-full bg-blue-50 dark:bg-blue-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground tracking-wide">
                Total Faturado(R$) - Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-foreground">
                  {(vendasPeriodoData?.vendasMensais ?? 0).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    },
                  )}
                </div>
              )}
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardContent>
          </Card>

          <Card className="w-full bg-cyan-50 dark:bg-cyan-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground tracking-wide">
                Total Faturado(R$) - Ano
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              {isLoading ? (
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              ) : error ? (
                <div className="text-sm text-destructive">Erro!</div>
              ) : (
                <div className="text-2xl font-normal text-foreground">
                  {(vendasPeriodoData?.vendasAnuais ?? 0).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    },
                  )}
                </div>
              )}
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-1 flex-col gap-6">
          <div className="flex w-full items-center justify-between flex-1 gap-6">
            <div className="flex w-[90%] h-full flex-col gap-6">
              <VendasChart
                data={chartData ?? undefined}
                isLoading={isLoading}
                error={error}
                selectedDateRange={selectedDateRange}
              />
              <div className="flex flex-row h-full gap-6">
                <ChartBarDefault />
                <ChartPieDonut
                  data={topProductsChart ?? undefined}
                  isLoading={isLoading}
                  error={error}
                  selectedDateRange={selectedDateRange}
                />
              </div>
            </div>
            <div className="flex flex-col w-[33%] h-full">
              <Card className="flex flex-col min-h-full w-full bg-card">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Principais Clientes</CardTitle>
                  <CardDescription>por valor total de vendas</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <div className="px-4 pb-4 space-y-3">
                    {isLoading ? (
                      // Loading state
                      Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className="w-full flex items-center justify-start flex-row gap-3"
                        >
                          <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                          <div className="flex flex-col w-full items-start justify-center gap-1">
                            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                          </div>
                        </div>
                      ))
                    ) : error ? (
                      // Error state
                      <div className="text-center py-4">
                        <p className="text-sm text-destructive">
                          Erro ao carregar clientes
                        </p>
                      </div>
                    ) : topClientes && topClientes.length > 0 ? (
                      // Data state
                      topClientes.slice(0, 8).map((cliente, index) => (
                        <div
                          key={cliente.codcli}
                          className="w-full flex items-center justify-start flex-row gap-3"
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarFallback
                              className={`${getAvatarColor(
                                cliente.nomeCliente,
                                index,
                              )} text-sm font-bold`}
                            >
                              {getInitials(cliente.nomeCliente)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col w-full items-start justify-center">
                            <h3
                              className="text-xs font-medium text-foreground truncate max-w-[120px]"
                              title={cliente.nomeCliente}
                            >
                              {cliente.nomeCliente}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {cliente.totalVendas.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Empty state
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          Nenhum cliente encontrado
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

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

export default VendasDashboard;
