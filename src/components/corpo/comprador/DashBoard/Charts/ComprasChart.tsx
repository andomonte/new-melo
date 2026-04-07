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

type ComprasChartData = {
  label: string;
  totalCompras: number;
  totalComprasAnterior?: number;
};

interface ComprasChartProps {
  data?: ComprasChartData[];
  isLoading: boolean;
  error: any;
  selectedDateRange?: string;
}

const chartConfig = {
  totalCompras: {
    label: 'Período Atual',
    theme: {
      light: '#347AB6',
      dark: '#347AB6',
    },
  },
  totalComprasAnterior: {
    label: 'Período Anterior',
    theme: {
      light: '#1f2937',
      dark: '#ffffff',
    },
  },
} satisfies ChartConfig;

export function ComprasChart({
  data,
  isLoading,
  error,
  selectedDateRange,
}: ComprasChartProps) {
  const isPeriodoCompleto = selectedDateRange === 'todo_periodo';

  if (isLoading) {
    return (
      <Card className="w-full h-full bg-[#F9F9F9]">
        <CardHeader>
          <CardTitle>Visão Geral das Compras</CardTitle>
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

  if (error) {
    return (
      <Card className="w-full h-full bg-[#F9F9F9]">
        <CardHeader>
          <CardTitle className="text-destructive">
            Erro ao Carregar Gráfico
          </CardTitle>
          <CardDescription>
            Não foi possível buscar os dados de compras para o período.
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

  return (
    <Card className="w-full bg-[#F9F9F9] dark:bg-[#09090B]">
      <CardHeader className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Visão Geral das Compras
          </CardTitle>

          {!isPeriodoCompleto && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#347AB6]" />
                <span className="text-muted-foreground">Período Atual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-white border-2 border-gray-300" />
                <span className="text-muted-foreground">Período Anterior</span>
              </div>
            </div>
          )}

          {isPeriodoCompleto && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-[#347AB6]" />
              <span className="text-muted-foreground">Compras por Ano</span>
            </div>
          )}
        </div>
        <CardDescription>
          {isPeriodoCompleto
            ? 'Histórico completo de compras ano a ano'
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
                    const formattedValue = `R$ ${Number(value).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`;

                    if (isPeriodoCompleto) {
                      return [formattedValue, ' Compras do Ano'];
                    }

                    const label =
                      name === 'totalCompras'
                        ? ' Período Atual'
                        : ' Período Anterior';
                    return [formattedValue, label];
                  }}
                />
              }
            />
            <Line
              dataKey="totalCompras"
              type="monotone"
              stroke="var(--color-totalCompras)"
              strokeWidth={3}
              dot={{ fill: 'var(--color-totalCompras)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="totalCompras"
            />
            {!isPeriodoCompleto && (
              <Line
                dataKey="totalComprasAnterior"
                type="monotone"
                stroke="var(--color-totalComprasAnterior)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{
                  fill: 'var(--color-totalComprasAnterior)',
                  strokeWidth: 1,
                  stroke: '#ffffff',
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                  fill: 'var(--color-totalComprasAnterior)',
                  strokeWidth: 2,
                  stroke: '#ffffff',
                }}
                name="totalComprasAnterior"
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
