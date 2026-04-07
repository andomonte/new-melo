'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DefaultButton } from '@/components/common/Buttons';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { TrendingUp, TrendingDown, DollarSign, Calendar, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { ContaPagar } from '@/hooks/useContasPagar';
import { Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

interface ResumoFinanceiro {
  totalContas: number;
  totalPendentes: number;
  totalParciais: number;
  totalPagas: number;
  valorTotalPendente: number;
}

interface DashboardFinanceiroProps {
  tipo?: 'geral' | 'individual' | 'standalone';
  conta?: ContaPagar | null;
  todasContas?: ContaPagar[];
  resumo?: ResumoFinanceiro;
}

const DashboardFinanceiro: React.FC<DashboardFinanceiroProps> = ({ 
  tipo = 'standalone', 
  conta, 
  todasContas = [], 
  resumo 
}) => {
  const [contas, setContas] = useState<ContaPagar[]>(todasContas);
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    status: 'todos',
  });

  // Buscar dados da API quando usado como standalone
  const buscarContas = async () => {
    try {
      setCarregando(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
      });

      if (filtros.dataInicio) {
        params.append('data_inicio', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        params.append('data_fim', filtros.dataFim);
      }

      const response = await fetch(`/api/contas-pagar?${params}`);
      if (!response.ok) throw new Error('Erro ao buscar dados');

      const data = await response.json();
      setContas(data.contas_pagar || []);
      
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setCarregando(false);
    }
  };

  // Carregar dados quando standalone
  useEffect(() => {
    if (tipo === 'standalone') {
      buscarContas();
    }
  }, []);

  // Atualizar contas quando props mudam
  useEffect(() => {
    if (tipo !== 'standalone') {
      setContas(todasContas);
    }
  }, [todasContas, tipo]);
  const [metricas, setMetricas] = useState({
    totalPagar: 0,
    totalPago: 0,
    totalPendente: 0,
    totalVencido: 0,
    totalAVencer: 0,
    quantidadeTotal: 0,
    quantidadePaga: 0,
    quantidadePendente: 0,
    quantidadeVencida: 0,
    mediaValorConta: 0,
    maiorConta: 0,
    menorConta: 0,
    totalJuros: 0,
  });

  const [distribuicaoPorStatus, setDistribuicaoPorStatus] = useState({
    pago: 0,
    pendente: 0,
    parcial: 0,
    cancelado: 0,
  });

  const [proximosVencimentos, setProximosVencimentos] = useState<ContaPagar[]>([]);
  const [filtroGraficoPizza, setFiltroGraficoPizza] = useState<'forma_pagamento' | 'conta'>('forma_pagamento');

  // Calcular resumo para modo standalone
  const resumoCalculado: ResumoFinanceiro | undefined = tipo === 'standalone' ? {
    totalContas: contas.length,
    totalPendentes: contas.filter(c => c.status === 'pendente').length,
    totalParciais: contas.filter(c => c.status === 'pago_parcial').length,
    totalPagas: contas.filter(c => c.status === 'pago').length,
    valorTotalPendente: contas
      .filter(c => c.status === 'pendente' || c.status === 'pago_parcial')
      .reduce((acc, c) => acc + (Number(c.valor_pgto) - Number(c.valor_pago || 0)), 0)
  } : resumo;

  // Filtrar contas por status se aplicável
  const contasFiltradas = contas.filter(c => {
    if (filtros.status !== 'todos' && c.status !== filtros.status) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    calcularMetricas();
  }, [tipo, conta, contasFiltradas]);

  const calcularMetricas = () => {
    let contasParaCalculo: ContaPagar[] = [];

    if (tipo === 'individual' && conta) {
      contasParaCalculo = [conta];
    } else if (tipo === 'geral') {
      contasParaCalculo = todasContas;
    } else if (tipo === 'standalone') {
      contasParaCalculo = contasFiltradas;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let totalPagar = 0;
    let totalPago = 0;
    let totalPendente = 0;
    let totalVencido = 0;
    let totalAVencer = 0;
    let quantidadePaga = 0;
    let quantidadePendente = 0;
    let quantidadeVencida = 0;
    let valores: number[] = [];
    let totalJuros = 0;

    const statusCount = {
      pago: 0,
      pendente: 0,
      parcial: 0,
      cancelado: 0,
    };

    contasParaCalculo.forEach(c => {
      const valor = Number(c.valor_pgto) || 0;
      totalPagar += valor;
      valores.push(valor);

      // Somar juros pagos
      if (c.status === 'pago' || c.status === 'pago_parcial') {
        totalJuros += Number(c.valor_juros) || 0;
      }

      if (c.status === 'pago') {
        totalPago += Number(c.valor_pago) || 0;
        quantidadePaga++;
        statusCount.pago++;
      } else if (c.status === 'pago_parcial') {
        totalPago += Number(c.valor_pago) || 0;
        totalPendente += (valor - (Number(c.valor_pago) || 0));
        statusCount.parcial++;
      } else if (c.status === 'pendente') {
        totalPendente += valor;
        quantidadePendente++;
        statusCount.pendente++;

        // Verificar se está vencido
        if (c.dt_venc) {
          const dataVenc = new Date(c.dt_venc);
          dataVenc.setHours(0, 0, 0, 0);
          if (dataVenc < hoje) {
            totalVencido += valor;
            quantidadeVencida++;
          } else {
            totalAVencer += valor;
          }
        }
      } else if (c.status === 'cancelado') {
        statusCount.cancelado++;
      }
    });

    const maiorConta = valores.length > 0 ? Math.max(...valores) : 0;
    const menorConta = valores.length > 0 ? Math.min(...valores) : 0;
    const mediaValorConta = valores.length > 0 ? totalPagar / valores.length : 0;

    setMetricas({
      totalPagar,
      totalPago,
      totalPendente,
      totalVencido,
      totalAVencer,
      quantidadeTotal: contasParaCalculo.length,
      quantidadePaga,
      quantidadePendente,
      quantidadeVencida,
      mediaValorConta,
      maiorConta,
      menorConta,
      totalJuros,
    });

    setDistribuicaoPorStatus(statusCount);

    // Próximos vencimentos (próximos 7 dias)
    if (tipo === 'geral' || tipo === 'standalone') {
      const seteDiasDepois = new Date(hoje);
      seteDiasDepois.setDate(seteDiasDepois.getDate() + 7);

      const proximos = contasParaCalculo
        .filter(c => {
          if (!c.dt_venc || c.status !== 'pendente') return false;
          const dataVenc = new Date(c.dt_venc);
          return dataVenc >= hoje && dataVenc <= seteDiasDepois;
        })
        .sort((a, b) => new Date(a.dt_venc!).getTime() - new Date(b.dt_venc!).getTime())
        .slice(0, 5);

      setProximosVencimentos(proximos);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularPorcentagem = (parte: number, total: number) => {
    if (total === 0) return 0;
    return ((parte / total) * 100).toFixed(1);
  };

  // Preparar dados para gráfico de pizza
  const prepararDadosGraficoPizza = () => {
    const contasPagas = contasFiltradas.filter(c => c.status === 'pago' || c.status === 'pago_parcial');
    
    if (filtroGraficoPizza === 'forma_pagamento') {
      // Agrupar por forma de pagamento
      const agrupado: Record<string, number> = {};
      
      contasPagas.forEach(c => {
        // Debug: verificar o que está vindo
        // if (c.status === 'pago') {
        //   console.log('Conta paga:', { id: c.id, forma_pgto: c.forma_pgto, valor_pago: c.valor_pago });
        // }
        
        // Verificar se forma_pgto existe e não é nula/vazia
        let forma = 'Não informado';
        if (c.forma_pgto && c.forma_pgto.trim() !== '') {
          forma = c.forma_pgto.trim();
        }
        
        agrupado[forma] = (agrupado[forma] || 0) + (Number(c.valor_pago) || 0);
      });
      
      return Object.entries(agrupado).map(([name, value]) => {
        // Mapear códigos para nomes legíveis
        let displayName = name;
        if (name === '001' || name === '1') displayName = 'Dinheiro';
        else if (name === '002' || name === '2') displayName = 'Cheque';
        else if (name === '003' || name === '3') displayName = 'PIX';
        else if (name === '004' || name === '4') displayName = 'Transferência';
        else if (name === '005' || name === '5') displayName = 'Cartão Crédito';
        else if (name === '006' || name === '6') displayName = 'Cartão Débito';
        else if (name === '007' || name === '7') displayName = 'Boleto';
        
        return {
          name: displayName,
          value,
          percentage: ((value / metricas.totalPago) * 100).toFixed(1)
        };
      });
    } else {
      // Agrupar por conta bancária
      const agrupado: Record<string, number> = {};
      
      contasPagas.forEach(c => {
        const conta = c.banco || c.cod_conta || 'Não informado';
        agrupado[conta] = (agrupado[conta] || 0) + (Number(c.valor_pago) || 0);
      });
      
      return Object.entries(agrupado).map(([name, value]) => ({
        name,
        value,
        percentage: ((value / metricas.totalPago) * 100).toFixed(1)
      }));
    }
  };

  const dadosGraficoPizza = prepararDadosGraficoPizza();
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  return (
    <div className={tipo === 'standalone' ? 'w-full h-[calc(100vh-4rem)] overflow-y-auto p-6 space-y-6' : 'space-y-4 max-h-[70vh] overflow-y-auto'}>
      {/* Cabeçalho e Filtros para modo standalone */}
      {tipo === 'standalone' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard Financeiro
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Visão geral das contas a pagar
              </p>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filtros.dataInicio}
                    onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filtros.dataFim}
                    onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={filtros.status} onValueChange={(value) => setFiltros(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pago_parcial">Pago Parcial</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <DefaultButton
                    variant="primary"
                    size="default"
                    onClick={buscarContas}
                    text="Aplicar Filtros"
                    disabled={carregando}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {carregando && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando dados...</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Título */}
      {tipo !== 'standalone' && (
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tipo === 'individual' 
              ? `Dashboard - ${conta?.nome_credor}` 
              : 'Dashboard Financeiro Geral'}
          </h3>
        </div>
      )}

      {/* Resumo Rápido - Cards Principais */}
      {resumoCalculado && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {/* Total de Contas */}
          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {resumoCalculado.totalContas}
              </div>
            </CardContent>
          </Card>

          {/* Pendentes */}
          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-500">
                    {resumoCalculado.totalPendentes}
                  </div>
                  <span className="text-[10px] text-gray-500">Pendente</span>
                </div>
                {resumoCalculado.totalParciais > 0 && (
                  <>
                    <div className="text-gray-400">+</div>
                    <div className="flex flex-col">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-500">
                        {resumoCalculado.totalParciais}
                      </div>
                      <span className="text-[10px] text-gray-500">Parcial</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pagas */}
          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Pagas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-green-600 dark:text-green-500">
                {resumoCalculado.totalPagas}
              </div>
            </CardContent>
          </Card>

          {/* Valor Total Pendente */}
          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Valor Total Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-red-600 dark:text-red-500">
                {formatarMoeda(resumoCalculado.valorTotalPendente)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards principais - 5 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total a Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatarMoeda(metricas.totalPagar)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metricas.quantidadeTotal} {metricas.quantidadeTotal === 1 ? 'conta' : 'contas'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatarMoeda(metricas.totalPago)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {calcularPorcentagem(metricas.totalPago, metricas.totalPagar)}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              Pago + Juros
              <span className="text-xs font-normal">(Total Efetivo)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatarMoeda(metricas.totalPago + metricas.totalJuros)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Juros: {formatarMoeda(metricas.totalJuros)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatarMoeda(metricas.totalPendente)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metricas.quantidadePendente} {metricas.quantidadePendente === 1 ? 'conta' : 'contas'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatarMoeda(metricas.totalVencido)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metricas.quantidadeVencida} {metricas.quantidadeVencida === 1 ? 'conta' : 'contas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas adicionais - 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Maior Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatarMoeda(metricas.maiorConta)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Menor Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatarMoeda(metricas.menorConta)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatarMoeda(metricas.mediaValorConta)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de Pizza - Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer
              config={{
                pago: {
                  label: 'Pago',
                  color: 'hsl(142, 76%, 36%)',
                },
                pendente: {
                  label: 'Pendente',
                  color: 'hsl(48, 96%, 53%)',
                },
                parcial: {
                  label: 'Pago Parcialmente',
                  color: 'hsl(217, 91%, 60%)',
                },
                cancelado: {
                  label: 'Cancelado',
                  color: 'hsl(0, 84%, 60%)',
                },
              }}
              className="h-[350px] w-full"
            >
              <PieChart width={400} height={350}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={[
                    { name: 'Pago', value: distribuicaoPorStatus.pago, fill: 'hsl(142, 76%, 36%)' },
                    { name: 'Pendente', value: distribuicaoPorStatus.pendente, fill: 'hsl(48, 96%, 53%)' },
                    { name: 'Pago Parcialmente', value: distribuicaoPorStatus.parcial, fill: 'hsl(217, 91%, 60%)' },
                    { name: 'Cancelado', value: distribuicaoPorStatus.cancelado, fill: 'hsl(0, 84%, 60%)' },
                  ].filter(item => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Forma de Pagamento / Conta com Filtro */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                Distribuição de Pagamentos
              </CardTitle>
              <div className="flex gap-2">
                <DefaultButton
                  variant={filtroGraficoPizza === 'forma_pagamento' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFiltroGraficoPizza('forma_pagamento')}
                  text="Forma Pgto"
                />
                <DefaultButton
                  variant={filtroGraficoPizza === 'conta' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFiltroGraficoPizza('conta')}
                  text="Conta"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {filtroGraficoPizza === 'forma_pagamento' 
                ? 'Valores pagos por forma de pagamento' 
                : 'Valores pagos por conta bancária'}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer
              config={{}}
              className="h-[350px] w-full"
            >
              <PieChart width={400} height={350}>
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                          <p className="font-semibold">{payload[0].name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Valor: {formatarMoeda(payload[0].value as number)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {payload[0].payload.percentage}% do total
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={dadosGraficoPizza}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {dadosGraficoPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Linha - Valores por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Valores por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer
              config={{
                valor: {
                  label: 'Valor',
                  color: 'hsl(217, 91%, 60%)',
                },
              }}
              className="h-[350px] w-full"
            >
              <LineChart
                width={500}
                height={350}
                data={[
                  { status: 'Pago', valor: metricas.totalPago },
                  { status: 'Pendente', valor: metricas.totalPendente },
                  { status: 'Vencido', valor: metricas.totalVencido },
                ].filter(item => item.valor > 0)}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="status" 
                  className="text-sm"
                />
                <YAxis 
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  className="text-sm"
                />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {payload[0].payload.status}
                          </p>
                          <p className="text-sm font-bold text-blue-600">
                            {formatarMoeda(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(217, 91%, 60%)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(217, 91%, 60%)', r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Vencimentos - apenas no dashboard geral */}
      {tipo === 'geral' && proximosVencimentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Próximos Vencimentos (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {proximosVencimentos.map((c) => (
                <div 
                  key={c.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {c.nome_credor}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Venc: {formatarData(c.dt_venc)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatarMoeda(Number(c.valor_pgto))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações da conta individual */}
      {tipo === 'individual' && conta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Informações Detalhadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Nº Duplicata</p>
                <p className="font-medium text-gray-900 dark:text-white">{conta.nro_dup || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Nº NF</p>
                <p className="font-medium text-gray-900 dark:text-white">{conta.nro_nf || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Data Emissão</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatarData(conta.dt_emissao)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Data Vencimento</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatarData(conta.dt_venc)}</p>
              </div>
              {conta.dt_pgto && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Data Pagamento</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatarData(conta.dt_pgto)}</p>
                </div>
              )}
              {conta.banco && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Banco</p>
                  <p className="font-medium text-gray-900 dark:text-white">{conta.banco}</p>
                </div>
              )}
              {conta.obs && (
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Observações</p>
                  <p className="font-medium text-gray-900 dark:text-white">{conta.obs}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
