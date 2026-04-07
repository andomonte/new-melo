'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Registro {
  id: number;
  loja: string;
  filial: string;
  nsu: string;
  dt_transacao: string;
  autorizacao: string;
  tid: string | null;
  bandeira: string;
  tipo_transacao: string;
  parcela: string | null;
  valor_bruto: number;
  taxa: number;
  valor_liquido: number;
  status: 'CONCILIADO' | 'NAO_LOCALIZADO' | 'PENDENTE' | 'ERRO';
  cod_receb: string | null;
  cod_freceb: string | null;
  criterio_match: string | null;
  observacao: string | null;
  dt_importacao: string;
}

interface Estatistica {
  status: string;
  quantidade: number;
  valor_bruto_total: number;
  valor_liquido_total: number;
}

export default function RelatorioConciliacaoCartao() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatistica[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [filialFiltro, setFilialFiltro] = useState('TODAS');

  useEffect(() => {
    buscarDados();
  }, []);

  const buscarDados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);
      if (statusFiltro !== 'TODOS') params.append('status', statusFiltro);
      if (filialFiltro !== 'TODAS') params.append('filial', filialFiltro);

      const response = await fetch(`/api/conciliacao-cartao/relatorio?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar dados');
      }

      setRegistros(data.registros);
      setEstatisticas(data.estatisticas);

    } catch (error: any) {
      toast.error(`Erro ao buscar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCILIADO':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">✅ Conciliado</Badge>;
      case 'NAO_LOCALIZADO':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">⚠️ Não Localizado</Badge>;
      case 'PENDENTE':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">🕒 Pendente</Badge>;
      case 'ERRO':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">❌ Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return data;
    }
  };

  const formatarCriterio = (criterio: string | null) => {
    if (!criterio) return null;
    
    const criterios: Record<string, { nome: string; cor: string }> = {
      'MATCH_SIMPLES': { nome: 'Match Simples', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'MATCH_ESTRITO': { nome: 'Match Estrito', cor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    };

    return criterios[criterio] || { nome: criterio, cor: 'bg-gray-100 text-gray-800' };
  };

  // Agrupar registros por status
  const conciliados = registros.filter(r => r.status === 'CONCILIADO');
  const naoLocalizados = registros.filter(r => r.status === 'NAO_LOCALIZADO');
  const pendentes = registros.filter(r => r.status === 'PENDENTE');
  const erros = registros.filter(r => r.status === 'ERRO');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Relatório de Conciliação
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Visualização consolidada de transações de cartão
            </p>
          </div>
          <Button onClick={buscarDados} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

      {/* Filtros */}
      <Card className="shadow-md">
        <CardHeader className="border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </h2>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="CONCILIADO">✅ Conciliado</SelectItem>
                  <SelectItem value="NAO_LOCALIZADO">⚠️ Não Localizado</SelectItem>
                  <SelectItem value="PENDENTE">🕒 Pendente</SelectItem>
                  <SelectItem value="ERRO">❌ Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filial">Filial</Label>
              <Select value={filialFiltro} onValueChange={setFilialFiltro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="Manaus">Manaus</SelectItem>
                  <SelectItem value="Porto Velho">Porto Velho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={buscarDados} className="w-full md:w-auto" disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button 
              onClick={() => {
                setDataInicio('');
                setDataFim('');
                setStatusFiltro('TODOS');
                setFilialFiltro('TODAS');
                buscarDados();
              }} 
              variant="outline"
              className="w-full md:w-auto"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {estatisticas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {estatisticas.map((stat) => (
            <Card key={stat.status} className={`shadow-md ${
              stat.status === 'CONCILIADO' ? 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/10' :
              stat.status === 'NAO_LOCALIZADO' ? 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
              stat.status === 'PENDENTE' ? 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/10' :
              'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/10'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {stat.status === 'CONCILIADO' ? '✅ Conciliados' :
                     stat.status === 'NAO_LOCALIZADO' ? '⚠️ Não Localizados' :
                     stat.status === 'PENDENTE' ? '🕒 Pendentes' :
                     '❌ Erros'}
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.quantidade}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Bruto:</span>
                    <span className="font-semibold">{formatarValor(stat.valor_bruto_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Líquido:</span>
                    <span className="font-semibold">{formatarValor(stat.valor_liquido_total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela de Registros - 3 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Conciliados */}
        <Card className="shadow-lg border-2 border-green-300 dark:border-green-700">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-b-2 border-green-200">
            <h3 className="font-bold text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              Conciliados ({conciliados.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {conciliados.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum registro conciliado</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {conciliados.map((registro) => (
                    <div key={registro.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {registro.bandeira}
                          </div>
                          <div className="text-xs text-gray-500">{registro.filial}</div>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">NSU:</span>
                            <span className="font-mono">{registro.nsu}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Auth:</span>
                            <span className="font-mono">{registro.autorizacao}</span>
                          </div>
                          {registro.parcela && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Parcela:</span>
                              <span>{registro.parcela}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Data:</span>
                            <span>{formatarData(registro.dt_transacao)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-gray-500">Líquido:</span>
                            <span className="text-green-600">{formatarValor(registro.valor_liquido)}</span>
                          </div>
                          {registro.cod_receb && (
                            <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                              <span>Cod. Receb:</span>
                              <span className="font-mono">{registro.cod_receb}</span>
                            </div>
                          )}
                          {registro.criterio_match && (
                            <div className="mt-2">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${formatarCriterio(registro.criterio_match)?.cor}`}>
                                {formatarCriterio(registro.criterio_match)?.nome}
                              </span>
                            </div>
                          )}
                        </div>
                        {registro.observacao && (
                          <p className="text-xs text-gray-500 italic mt-2">{registro.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2: Não Localizados */}
        <Card className="shadow-lg border-2 border-yellow-300 dark:border-yellow-700">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 border-b-2 border-yellow-200">
            <h3 className="font-bold text-lg flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="w-5 h-5" />
              Não Localizados ({naoLocalizados.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {naoLocalizados.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum registro não localizado</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {naoLocalizados.map((registro) => (
                    <div key={registro.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {registro.bandeira}
                          </div>
                          <div className="text-xs text-gray-500">{registro.filial}</div>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">NSU:</span>
                            <span className="font-mono">{registro.nsu}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Auth:</span>
                            <span className="font-mono">{registro.autorizacao}</span>
                          </div>
                          {registro.parcela && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Parcela:</span>
                              <span>{registro.parcela}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Data:</span>
                            <span>{formatarData(registro.dt_transacao)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-gray-500">Líquido:</span>
                            <span className="text-yellow-600">{formatarValor(registro.valor_liquido)}</span>
                          </div>
                        </div>
                        {registro.observacao && (
                          <p className="text-xs text-gray-500 italic mt-2">{registro.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coluna 3: Pendentes e Erros */}
        <Card className="shadow-lg border-2 border-red-300 dark:border-red-700">
          <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-b-2 border-red-200">
            <h3 className="font-bold text-lg flex items-center gap-2 text-red-800 dark:text-red-200">
              <XCircle className="w-5 h-5" />
              Pendentes/Erros ({pendentes.length + erros.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {(pendentes.length + erros.length) === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum registro pendente ou com erro</p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[...pendentes, ...erros].map((registro) => (
                    <div key={registro.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {registro.bandeira}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(registro.status)}
                            <div className="text-xs text-gray-500">{registro.filial}</div>
                          </div>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">NSU:</span>
                            <span className="font-mono">{registro.nsu}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Auth:</span>
                            <span className="font-mono">{registro.autorizacao}</span>
                          </div>
                          {registro.parcela && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Parcela:</span>
                              <span>{registro.parcela}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Data:</span>
                            <span>{formatarData(registro.dt_transacao)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-gray-500">Líquido:</span>
                            <span className="text-red-600">{formatarValor(registro.valor_liquido)}</span>
                          </div>
                        </div>
                        {registro.observacao && (
                          <p className="text-xs text-red-600 dark:text-red-400 italic mt-2">{registro.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
