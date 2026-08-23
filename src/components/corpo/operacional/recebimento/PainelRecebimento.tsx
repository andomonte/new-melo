import React, { useEffect, useState } from 'react';
import { PedidoRecebimento } from '@/data/pedidos/pedidosService';
import { enviarParaImpressora } from '@/utils/enviarParaImpressora';
import { useDebouncedCallback } from 'use-debounce';
import { FaPrint } from 'react-icons/fa6';
import DataTable from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import { Meta } from '@/data/common/meta';
import PrintReasonModal from '@/components/common/PrintReasonModal';

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

  // Baixa do supervisor: finaliza separação (2→3) ou conferência (4→5) pendente.
  const [baixando, setBaixando] = useState<string>('');
  const darBaixa = async (nrVenda: string, statusLabel: string) => {
    const ehSep = statusLabel === '2' || statusLabel === 'Em Separação';
    const oQ = ehSep ? 'separação' : 'conferência';
    if (!window.confirm(`Dar baixa (finalizar) a ${oQ} do pedido ${nrVenda}?\nA ação fica registrada no seu nome.`)) return;
    setBaixando(nrVenda);
    try {
      const resp = await fetch('/api/recebimento/baixa-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nrovenda: nrVenda, username: operador.nome }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.erro || 'Falha ao dar baixa');
      toast({ title: 'Baixa efetuada', description: d.mensagem });
      carregarDados();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBaixando('');
    }
  };
  const STATUS_BAIXAVEL = new Set(['2', '4', 'Em Separação', 'Em Conferência']);

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
        MOTIVO: motivoSubmitido.trim(),
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

  // Linhas como ARRAY (o DataTablePadrao mapeia por índice → alinha com `headers`).
  const rows = data.map((pedido) => [
    <span key="nr" className="font-medium text-gray-900 dark:text-white">
      {pedido.NrVenda}
    </span>,

    <span key="cli" className="font-medium text-gray-900 dark:text-white">
      {pedido.Cliente}
    </span>,

    <span key="vend" className="text-gray-700 dark:text-gray-300">
      {pedido.Vendedor || '----'}
    </span>,

    <div key="hor" className="text-sm">
      <div className="font-mono">
        {new Date(pedido.horario).toLocaleDateString('pt-BR')}
      </div>
      <div className="text-gray-500 dark:text-gray-400">
        {new Date(pedido.horario).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>,

    getStatusBadge(pedido.status),

    <div key="act" className="flex justify-center items-center gap-2">
      {STATUS_BAIXAVEL.has(String(pedido.status)) && (
        <button
          type="button"
          disabled={baixando === pedido.NrVenda}
          onClick={() => darBaixa(pedido.NrVenda, String(pedido.status))}
          title="Dar baixa (supervisor) — finaliza a separação/conferência pendente"
          className="px-3 py-1 text-xs h-8 flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
        >
          {baixando === pedido.NrVenda ? '...' : '✓ Dar baixa'}
        </button>
      )}
      {pedido.naFilaImpressao ? (
        <span className="px-3 py-1 text-xs h-8 flex items-center gap-1 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium cursor-not-allowed">
          <FaPrint className="w-4 h-4" />
          Na fila
        </span>
      ) : (
        <DefaultButton
          text="Imprimir"
          className="px-3 py-1 text-xs h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
          icon={<FaPrint className="w-4 h-4" />}
          onClick={() => abrirModal(pedido.NrVenda)}
        />
      )}
    </div>,
  ]);

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex-1 min-h-20 flex flex-col">
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
          screenKey="recebimento-operacional"
          searchRightSlot={
            <div className="flex items-center gap-2 whitespace-nowrap">
              <label
                htmlFor="header-status-filter"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Status:
              </label>
              <select
                id="header-status-filter"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="min-w-[150px] pl-2 pr-6 py-1.5 text-sm border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:text-white bg-white shadow-sm font-medium"
              >
                <option value="1">Aguardando</option>
                <option value="2">Em Separação</option>
                <option value="3">Separado</option>
                <option value="4">Em Conferência</option>
                <option value="5">Conferido</option>
                <option value="F">Faturado</option>
              </select>
            </div>
          }
        />
        </div>
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
