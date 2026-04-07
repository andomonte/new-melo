/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import {
  getPedidosConferidos,
  PedidoConferido,
} from '@/data/conferencia/conferenciaService';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';

const TelaConferenciaSimples = () => {
  const [search, setSearch] = useState<string>('');
  const [data, setData] = useState<PedidoConferido[]>([]);
  const { toast } = useToast();

  const carregarDados = async () => {
    try {
      const pedidos = await getPedidosConferidos();
      setData(pedidos);
    } catch (_error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar pedidos de conferência',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const finalizarConferencia = (codvenda: string) => {
    // Implemente a lógica de finalização aqui
    toast({
      title: 'Conferência finalizada',
      description: `Pedido ${codvenda} foi finalizado`,
    });
  };

  const headers = [
    'Nr. Venda',
    'Cliente',
    'Vendedor',
    'Horário',
    'Status',
    'Ações',
  ];

  const filteredData = data.filter((pedido) => {
    const termo = search.toLowerCase();
    return (
      pedido.codvenda.toLowerCase().includes(termo) ||
      pedido.nomeCliente.toLowerCase().includes(termo) ||
      pedido.vendedor.toLowerCase().includes(termo)
    );
  });

  const rows = filteredData.map((pedido) => ({
    nrVenda: (
      <span className="font-medium text-gray-900 dark:text-white">
        {pedido.codvenda}
      </span>
    ),
    cliente: (
      <span className="font-medium text-gray-900 dark:text-white">
        {pedido.nomeCliente}
      </span>
    ),
    vendedor: (
      <span className="text-gray-700 dark:text-gray-300">
        {pedido.vendedor || '----'}
      </span>
    ),
    horario: (
      <div className="text-sm">
        <div className="font-mono">
          {new Date(pedido.horario).toLocaleDateString('pt-BR')}
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {new Date(pedido.horario).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    ),
    status: (
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
        {pedido.status}
      </span>
    ),
    action: (
      <div className="flex justify-center">
        <DefaultButton
          text="Finalizar"
          className="px-3 py-1 text-xs h-8 flex items-center gap-1 hover:bg-green-600 dark:hover:bg-green-800"
          onClick={() => finalizarConferencia(pedido.codvenda)}
        />
      </div>
    ),
  }));

  const meta = {
    currentPage: 1,
    perPage: filteredData.length,
    total: filteredData.length,
    lastPage: 1,
  };
  const handlePageChange = () => {};
  const handlePerPageChange = () => {};

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Conferência
            </div>
          </div>
        </header>
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => setSearch(e.target.value)}
          searchInputPlaceholder="Pesquisar por pedido, cliente ou vendedor..."
        />
      </main>
    </div>
  );
};

export default TelaConferenciaSimples;
