'use client';

import { Pie, PieChart } from 'recharts';

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
import {
  type TopSellingProduct,
  type DateRange,
} from '@/data/vendas/dashboard';

export const description = 'A donut chart showing top selling products';

const chartConfig = {
  totalRevenue: {
    label: 'Faturamento',
  },
  product1: {
    label: 'Produto 1',
    theme: {
      light: '#AEC8ED',
      dark: '#AEC8ED',
    },
  },
  product2: {
    label: 'Produto 2',
    theme: {
      light: '#8FE3E7',
      dark: '#8FE3E7',
    },
  },
  product3: {
    label: 'Produto 3',
    theme: {
      light: '#92BFFF',
      dark: '#92BFFF',
    },
  },
  product4: {
    label: 'Produto 4',
    theme: {
      light: '#347AB6',
      dark: '#347AB6',
    },
  },
  product5: {
    label: 'Produto 5',
    theme: {
      light: '#95BAEF',
      dark: '#95BAEF',
    },
  },
  product6: {
    label: 'Produto 6',
    theme: {
      light: '#304151',
      dark: '#304151',
    },
  },
  product7: {
    label: 'Produto 7',
    theme: {
      light: '#347AB6',
      dark: '#347AB6',
    },
  },
} satisfies ChartConfig;

interface ChartPieDonutProps {
  data?: TopSellingProduct[];
  isLoading?: boolean;
  error?: any;
  selectedDateRange: DateRange;
}

export function ChartPieDonut({
  data,
  isLoading,
  error,
  selectedDateRange,
}: ChartPieDonutProps) {
  // Função para obter o período de texto
  const getPeriodText = (range: DateRange) => {
    switch (range) {
      case 'hoje':
        return 'Hoje';
      case 'ultima_semana':
        return 'Última Semana';
      case 'ultimos_30_dias':
        return 'Últimos 30 Dias';
      case 'ultimo_trimestre':
        return 'Último Trimestre';
      case 'ultimo_ano':
        return 'Último Ano';
      case 'todo_periodo':
        return 'Todo o Período';
      default:
        return 'Período Selecionado';
    }
  };

  // Transformar dados para o formato do gráfico
  const chartData =
    data?.map((product, index) => ({
      productName: product.productName,
      codprod: product.codprod,
      totalRevenue: product.totalRevenue,
      fill: `var(--color-product${(index % 7) + 1})`,
    })) || [];

  return (
    <Card className="flex flex-col w-full h-full bg-card">
      <CardHeader className="flex items-start justify-center w-full">
        <CardTitle>Produtos Mais Vendidos</CardTitle>
        <CardDescription>{getPeriodText(selectedDateRange)}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center pb-0 flex-row">
        {isLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="animate-pulse text-sm text-muted-foreground">
              Carregando...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-sm text-destructive">
              Erro ao carregar dados
            </div>
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-sm text-muted-foreground">
              Nenhum produto encontrado
            </div>
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto w-full aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                      hideLabel
                      formatter={(value: number, name: string) => [
                        value.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }),
                        name,
                      ]}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="totalRevenue"
                  nameKey="productName"
                  innerRadius={60}
                />
              </PieChart>
            </ChartContainer>

            <div className="flex flex-col items-start justify-center w-full gap-4 text-sm">
              {chartData.map((product, index) => {
                // Mantém as mesmas cores do gráfico para consistência visual
                const colors = [
                  '#AEC8ED',
                  '#8FE3E7',
                  '#92BFFF',
                  '#347AB6',
                  '#95BAEF',
                  '#304151',
                  '#347AB6',
                ];
                return (
                  <div
                    key={product.codprod}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: colors[index % 7],
                      }}
                    />
                    <span
                      className="text-muted-foreground text-xs truncate"
                      title={product.productName}
                    >
                      {product.productName.length > 15
                        ? `${product.productName.substring(0, 15)}...`
                        : product.productName}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
