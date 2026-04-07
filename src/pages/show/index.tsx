import React, { useEffect, useState } from 'react';
import Header from './Header';
import {
  getPedidosParaMonitorTV,
  MonitorTVResponse,
} from '@/data/pedidos/monitorTVService';

export default function Show() {
  const [pedidos, setPedidos] = useState<MonitorTVResponse>({
    data: [],
    meta: {
      total: 0,
      currentPage: 1,
      lastPage: 1,
      perPage: 999,
      from: 0,
      to: 0,
    },
  });

  // Estado para evitar problemas de hidratação com datas
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Marca que estamos no cliente
  }, []);

  const handlePedidos = async () => {
    // Usar o serviço correto que ordena por dtupdate DESC automaticamente
    const response = await getPedidosParaMonitorTV({
      page: 1,
      perPage: 999,
      search: '',
      sortBy: 'dtupdate', // Garantir ordenação por update
      sortOrder: 'DESC', // Mais recente primeiro
    });
    setPedidos(response);
  };

  useEffect(() => {
    if (isClient) {
      handlePedidos(); // chamada inicial apenas no cliente
      const interval = setInterval(() => handlePedidos(), 30000); // atualiza a cada 30s
      return () => clearInterval(interval); // limpa no unmount
    }
  }, [isClient]);

  const setColor = (status: string | undefined) => {
    switch (status) {
      case 'Aguardando':
        return {
          text: 'Aguardando Separação',
          className: 'bg-yellow-300 text-yellow-800',
        };
      case 'Em Separação':
        return { text: 'Em Separação', className: 'bg-blue-300 text-blue-800' };
      case 'Separado':
        return {
          text: 'Separado',
          className: 'bg-purple-300 text-purple-800',
        };
      case 'Em Conferência':
        return {
          text: 'Em Conferência',
          className: 'bg-green-300 text-green-800',
        };
      case 'Conferido':
        return {
          text: 'Conferido',
          className: 'bg-emerald-300 text-emerald-800',
        };
      default:
        return {
          text: status ?? 'Desconhecido',
          className: 'bg-red-300 text-red-800',
        };
    }
  };

  // Função para calcular diferença de tempo de forma consistente
  const calcularDiferencaMinutos = (dataPedido: Date): number => {
    if (!isClient) return 0; // No servidor, sempre retorna 0
    const diffInMs = Math.abs(new Date().getTime() - dataPedido.getTime());
    return Math.floor(diffInMs / 60000);
  };

  // Função para formatar data de forma consistente
  const formatarData = (dataString: string): string => {
    if (!isClient) return 'Carregando...'; // Placeholder no servidor

    try {
      const data = new Date(dataString);
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_error) {
      return 'Data inválida';
    }
  };

  const rows = pedidos.data?.map((pedido) => {
    const data = pedido.horario ? new Date(pedido.horario) : null;
    const openedAt =
      data && isClient
        ? `${calcularDiferencaMinutos(data)} min`
        : 'Carregando...';
    const createdAt = pedido.horario
      ? formatarData(pedido.horario)
      : 'Data não disponível';

    return {
      id: pedido.NrVenda,
      createdAt,
      openedAt,
      clientName: pedido.Cliente ?? 'Sem nome',
      status: setColor(pedido.status),
      // Adicionar campos extras para exibição condicional de previsão
      statusPedido: pedido.statusPedido,
      previsao: pedido.previsao,
      responsavel: pedido.responsavel,
    };
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Pedidos" hasTime />

      {/* Mostrar loading enquanto não carregou os dados no cliente */}
      {!isClient || pedidos.data.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando pedidos...</p>
          </div>
        </div>
      ) : (
        <table className="w-full table-auto text-center border-collapse bg-white text-black">
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="p-4 border">Nº Pedido</th>
              <th className="p-4 border">Cliente</th>
              <th className="p-4 border">Data Pedido</th>
              <th className="p-4 border">Status</th>
              <th className="p-4 border">Responsável</th>
              {/* Campo Previsão será renderizado condicionalmente abaixo */}
              <th className="p-4 border">Previsão (min)</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((pedido) => (
              <tr key={pedido.id} className="hover:bg-gray-200">
                <td className="p-4 border">{pedido.id}</td>
                <td className="p-4 border">{pedido.clientName}</td>
                <td className="p-4 border">{pedido.createdAt}</td>
                <td
                  className={`p-4 border font-bold ${pedido.status.className}`}
                >
                  {pedido.status.text}
                </td>
                <td className="p-4 border">{pedido.responsavel || '-'}</td>
                {/* Problema 2: Exibição condicional do campo "Previsão" */}
                <td className="p-4 border">
                  {pedido.statusPedido === '2' ? pedido.previsao : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
