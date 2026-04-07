'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export const description = 'A bar chart showing commission data';

type ComissaoData = {
  month: string;
  comissao: number;
};

interface ChartBarDefaultProps {
  data?: ComissaoData[];
  isLoading?: boolean;
  error?: any;
}

const chartConfig = {
  comissao: {
    label: 'Comissão',
    theme: {
      light: '#347AB6',
      dark: '#60a5fa',
    },
  },
} satisfies ChartConfig;

// Dados de exemplo para demonstração (serão substituídos pelos dados reais)
const mockData: ComissaoData[] = [
  { month: 'Janeiro', comissao: 186 },
  { month: 'Fevereiro', comissao: 305 },
  { month: 'Março', comissao: 237 },
  { month: 'Abril', comissao: 173 },
  { month: 'Maio', comissao: 209 },
  { month: 'Junho', comissao: 214 },
];

export function ChartBarDefault({
  data,
  isLoading,
  error,
}: ChartBarDefaultProps) {
  // Usa dados mockados se não houver dados reais
  const chartData = data && data.length > 0 ? data : mockData;

  return (
    <Card className="w-full h-full flex flex-col bg-card">
      <CardHeader>
        <CardTitle>Comissão por Período</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] w-full flex items-center justify-center">
            <div className="animate-pulse text-sm text-muted-foreground">
              Carregando...
            </div>
          </div>
        ) : error ? (
          <div className="h-[200px] w-full flex items-center justify-center">
            <div className="text-sm text-destructive">
              Erro ao carregar dados
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="bg-popover border border-border shadow-lg"
                    formatter={(value: number) => [
                      value.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }),
                      'Comissão',
                    ]}
                  />
                }
              />
              <Bar
                dataKey="comissao"
                fill="var(--color-comissao)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
