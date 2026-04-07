import React, { useEffect, useState } from 'react';
import { PedidoRecebimento } from '@/data/pedidos/pedidosService';
import { enviarParaImpressora } from '@/utils/enviarParaImpressora';
import { useDebouncedCallback } from 'use-debounce';
import { FaPrint } from 'react-icons/fa6';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import { Meta } from '@/data/common/meta';
import PrintReasonModal from '@/components/common/PrintReasonModal';
import { LogOut } from 'lucide-react';

interface Operador {
  matricula: string;
  nome: string;
}

interface PainelRecebimentoProps {
  operador: Operador;
  onLogout: () => void;
}

const PainelRecebimento: React.FC<PainelRecebimentoProps> = ({
  operador,
  onLogout,
}) => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [statusFiltro, setStatusFiltro] = useState<string>('1');
  const [data, setData] = useState<PedidoRecebimento[]>([]);
  const [meta, setMeta] = useState<Meta>({
    currentPage: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
  });
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string>('');
  const [modalMotivoAberto, setModalMotivoAberto] = useState(false);
  const [enviandoImpressora, setEnviandoImpressora] = useState(false);
  const { toast } = useToast();

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    carregarDados();
  }, 300);

  const carregarDados = async () => {
    try {
      const response = await fetch(
        `/api/pedidos/recebimento?page=${page}&perPage=${perPage}&search=${encodeURIComponent(
          search,
        )}&statusFilter=${encodeURIComponent(statusFiltro)}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar dados');
      }

      setData(result.data || []);
      setMeta(
        result.meta || {
          currentPage: page,
          perPage: perPage,
          total: (result.data || []).length,
          lastPage: Math.ceil((result.data || []).length / perPage),
        },
      );
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados dos pedidos',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, statusFiltro]);

  const abrirModal = (nrVenda: string) => {
    setPedidoSelecionado(nrVenda);
    setModalMotivoAberto(true);
  };

  const fecharModal = () => {
    setModalMotivoAberto(false);
    setPedidoSelecionado('');
    setEnviandoImpressora(false);
  };

  const buscarDetalhesVenda = async (nrVenda: string) => {
    try {
      const response = await fetch(
        `/api/recebimento/detalhes-venda?nrVenda=${nrVenda}`,
      );
      if (response.ok) {
        const resultado = await response.json();
        return resultado.data;
      }
    } catch (_error) {
      console.log(
        'Nao foi possivel buscar detalhes da venda, usando dados padrao',
      );
    }
    return null;
  };

  const confirmarMotivo = async (motivoSubmitido: string) => {
    try {
      setEnviandoImpressora(true);

      const vendaSelecionada = data.find(
        (venda) => venda.NrVenda === pedidoSelecionado,
      );

      if (!vendaSelecionada) {
        throw new Error('Venda nao encontrada');
      }

      const detalhesVenda = await buscarDetalhesVenda(pedidoSelecionado);

      const dadosVenda = {
        CODIGO: vendaSelecionada.NrVenda,
        NRODOC: vendaSelecionada.NrVenda,
        CODCF: detalhesVenda?.codcli || '00001',
        NOMECF: vendaSelecionada.Cliente.slice(0, 40),
        VALOR: detalhesVenda?.total || 0,
        ARMAZEM: detalhesVenda?.armazem || 1,
      };

      const response = await fetch('/api/recebimento/salvar-venda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dadosVenda),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Erro ao salvar venda para impressao',
        );
      }

      const resultado = await response.json();

      await enviarParaImpressora({
        codvenda: pedidoSelecionado,
        motivo: motivoSubmitido.trim(),
        timestamp: new Date(),
      });

      toast({
        title: 'Enviado para impressora com sucesso!',
        description: `O pedido ${pedidoSelecionado} foi salvo e enviado para impressao. NROIMP: ${
          resultado.info?.nroimp_gerado || 'N/A'
        }`,
        variant: 'default',
      });

      carregarDados();
      fecharModal();
    } catch (error) {
      console.error('Erro ao enviar para impressora:', error);
      toast({
        title: 'Erro ao enviar para impressora',
        description:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel enviar o pedido para impressao. Tente novamente.',
        variant: 'destructive',
      });
      setEnviandoImpressora(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      '1': {
        class:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        label: 'Aguardando',
      },
      Aguardando: {
        class:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        label: 'Aguardando',
      },
      '2': {
        class:
          'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        label: 'Em Separacao',
      },
      'Em Separacao': {
        class:
          'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        label: 'Em Separacao',
      },
      '3': {
        class:
          'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
        label: 'Separado',
      },
      Separado: {
        class:
          'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
        label: 'Separado',
      },
      '4': {
        class:
          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        label: 'Em Conferencia',
      },
      'Em Conferencia': {
        class:
          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        label: 'Em Conferencia',
      },
      '5': {
        class:
          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        label: 'Conferido',
      },
      Conferido: {
        class:
          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        label: 'Conferido',
      },
      F: {
        class:
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        label: 'Faturado',
      },
      Faturado: {
        class:
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        label: 'Faturado',
      },
    };

    const config = configs[status as keyof typeof configs] || {
      class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      label: status,
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}
      >
        {config.label}
      </span>
    );
  };

  const headers = [
    'Nr. Venda',
    'Cliente',
    'Vendedor',
    'Horario',
    'Status',
    'Acoes',
  ];

  const rows = data.map((pedido) => ({
    nrVenda: (
      <span className="font-medium text-gray-900 dark:text-white">
        {pedido.NrVenda}
      </span>
    ),

    cliente: (
      <span className="font-medium text-gray-900 dark:text-white">
        {pedido.Cliente}
      </span>
    ),

    vendedor: (
      <span className="text-gray-700 dark:text-gray-300">
        {pedido.Vendedor || '----'}
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

    status: getStatusBadge(pedido.status),

    action: (
      <div className="flex justify-center">
        <DefaultButton
          text="Imprimir"
          className="px-3 py-1 text-xs h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
          icon={<FaPrint className="w-4 h-4" />}
          onClick={() => abrirModal(pedido.NrVenda)}
        />
      </div>
    ),
  }));

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 mr-6 ml-6">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
                Recebimento
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Operador: <span className="font-medium">{operador.nome}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg border">
                <label
                  htmlFor="header-status-filter"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  Filtrar por Status:
                </label>
                <select
                  id="header-status-filter"
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="min-w-[160px] pl-2 pr-6 py-1 text-sm border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:text-white bg-white shadow-sm font-medium"
                >
                  <option value="1">Aguardando</option>
                  <option value="2">Em Separacao</option>
                  <option value="3">Separado</option>
                  <option value="4">Em Conferencia</option>
                  <option value="5">Conferido</option>
                  <option value="F">Faturado</option>
                </select>
              </div>

              <DefaultButton
                text="Sair"
                variant="secondary"
                size="sm"
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
              />
            </div>
          </div>
        </header>
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar por pedido, cliente ou vendedor..."
        />
      </main>

      <PrintReasonModal
        isOpen={modalMotivoAberto}
        onClose={fecharModal}
        onSubmit={confirmarMotivo}
        loading={enviandoImpressora}
        nrVenda={pedidoSelecionado}
      />
    </div>
  );
};

export default PainelRecebimento;
