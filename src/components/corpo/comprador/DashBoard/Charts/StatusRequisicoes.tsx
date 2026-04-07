'use client';

import { Pie, PieChart, Cell } from 'recharts';
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
import { type DateRange, type StatusRequisicao } from '@/data/compras/dashboard';

const STATUS_COLORS: Record<string, string> = {
  P: '#94a3b8', // slate-400 (Rascunho)
  S: '#3b82f6', // blue-500 (Submetida)
  A: '#22c55e', // green-500 (Aprovada)
  R: '#ef4444', // red-500 (Rejeitada)
  C: '#6b7280', // gray-500 (Cancelada)
  L: '#8b5cf6', // violet-500 (Liberada)
  F: '#14b8a6', // teal-500 (Finalizada)
};

const chartConfig = {
  quantidade: {
    label: 'Quantidade',
  },
  P: {
    label: 'Rascunho',
    theme: { light: '#94a3b8', dark: '#94a3b8' },
  },
  S: {
    label: 'Submetida',
    theme: { light: '#3b82f6', dark: '#3b82f6' },
  },
  A: {
    label: 'Aprovada',
    theme: { light: '#22c55e', dark: '#22c55e' },
  },
  R: {
    label: 'Rejeitada',
    theme: { light: '#ef4444', dark: '#ef4444' },
  },
  C: {
    label: 'Cancelada',
    theme: { light: '#6b7280', dark: '#6b7280' },
  },
  L: {
    label: 'Liberada',
    theme: { light: '#8b5cf6', dark: '#8b5cf6' },
  },
  F: {
    label: 'Finalizada',
    theme: { light: '#14b8a6', dark: '#14b8a6' },
  },
} satisfies ChartConfig;

interface StatusRequisicoesChartProps {
  data?: StatusRequisicao[];
  isLoading?: boolean;
  error?: any;
  selectedDateRange: DateRange;
}

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

export function StatusRequisicoesChart({
  data,
  isLoading,
  error,
  selectedDateRange,
}: StatusRequisicoesChartProps) {
  const chartData =
    data?.map((item) => ({
      status: item.status,
      statusLabel: item.statusLabel,
      quantidade: item.quantidade,
      percentual: item.percentual,
      fill: STATUS_COLORS[item.status] || '#6b7280',
    })) || [];

  const totalRequisicoes = chartData.reduce((sum, item) => sum + item.quantidade, 0);

  return (
    <Card className="flex flex-col w-full h-full bg-[#F9F9F9] dark:bg-[#09090B]">
      <CardHeader className="flex items-start justify-center w-full">
        <CardTitle>Status das Requisições</CardTitle>
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
              Nenhuma requisição encontrada
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
                      formatter={(value: number, name: string, props: any) => [
                        `${value} (${props.payload.percentual}%)`,
                        props.payload.statusLabel,
                      ]}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="quantidade"
                  nameKey="statusLabel"
                  innerRadius={50}
                  outerRadius={80}
                  label={({ percentual }) => `${percentual}%`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-col items-start justify-center w-full gap-3 text-sm">
              {chartData.map((item) => (
                <div key={item.status} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground text-xs">
                    {item.statusLabel}: {item.quantidade}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 w-full">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Total: {totalRequisicoes} requisições
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
