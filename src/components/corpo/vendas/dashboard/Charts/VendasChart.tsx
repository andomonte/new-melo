'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

// A tipagem agora vem de fora, pois o componente não "sabe" mais de onde vêm os dados.
type VendasChartData = {
  label: string;
  totalVendas: number;
  totalVendasAnterior?: number;
};

interface VendasChartProps {
  data?: VendasChartData[];
  isLoading: boolean;
  error: any;
  selectedDateRange?: string;
}

const chartConfig = {
  totalVendas: {
    label: 'Período Atual',
    theme: {
      light: '#347AB6',
      dark: '#347AB6',
    },
  },
  totalVendasAnterior: {
    label: 'Período Anterior',
    theme: {
      light: '#1f2937',
      dark: '#ffffff',
    },
  },
} satisfies ChartConfig;

export function VendasChart({
  data,
  isLoading,
  error,
  selectedDateRange,
}: VendasChartProps) {
  const isPeriodoCompleto = selectedDateRange === 'todo_periodo';
  // Renderização do estado de carregamento (controlado pelo pai)
  if (isLoading) {
    return (
      <Card className="w-full h-full bg-card">
        <CardHeader>
          <CardTitle>Visão Geral das Vendas</CardTitle>
          <CardDescription>Analisando o período selecionado...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full flex items-center justify-center bg-muted/50 animate-pulse rounded-lg">
            <p className="text-sm text-muted-foreground">
              Carregando gráfico...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderização do estado de erro (controlado pelo pai)
  if (error) {
    return (
      <Card className="w-full h-full bg-card">
        <CardHeader>
          <CardTitle className="text-destructive">
            Erro ao Carregar Gráfico
          </CardTitle>
          <CardDescription>
            Não foi possível buscar os dados de vendas para o período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full flex items-center justify-center bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive">
              Falha na busca dos dados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderização do gráfico com os dados
  return (
    <Card className="w-full bg-card">
      <CardHeader className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Visão Geral das Vendas
          </CardTitle>

          {!isPeriodoCompleto && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Período Atual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted-foreground/30 border-2 border-border" />
                <span className="text-muted-foreground">Período Anterior</span>
              </div>
            </div>
          )}

          {isPeriodoCompleto && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Vendas por Ano</span>
            </div>
          )}
        </div>
        <CardDescription>
          {isPeriodoCompleto
            ? 'Histórico completo de vendas ano a ano'
            : 'Comparação entre períodos selecionados'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-[10rem] w-full">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                  formatter={(value, name) => {
                    if (isPeriodoCompleto) {
                      return [
                        `R$ ${Number(value).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        'Vendas do Ano',
                      ];
                    }

                    const label =
                      name === 'totalVendas'
                        ? 'Período Atual'
                        : 'Período Anterior';
                    return [
                      `R$ ${Number(value).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`,
                      label,
                    ];
                  }}
                />
              }
            />
            <Line
              dataKey="totalVendas"
              type="monotone"
              stroke="var(--color-totalVendas)"
              strokeWidth={3}
              dot={{ fill: 'var(--color-totalVendas)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="totalVendas"
            />
            {!isPeriodoCompleto && (
              <Line
                dataKey="totalVendasAnterior"
                type="monotone"
                stroke="var(--color-totalVendasAnterior)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{
                  fill: 'var(--color-totalVendasAnterior)',
                  strokeWidth: 1,
                  stroke: '#ffffff',
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                  fill: 'var(--color-totalVendasAnterior)',
                  strokeWidth: 2,
                  stroke: '#ffffff',
                }}
                name="totalVendasAnterior"
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
