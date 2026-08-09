import React, { useMemo, useState, useEffect } from 'react';
import DataTable from '@/components/common/DataTablePadrao';
import SelectInput from '@/components/common/SelectPadrao';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  faturas: any[];
  meta: any;
  carregando: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onFiltroChange: (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => void;
  colunasFiltro: string[];
  termoBusca: string;
  setTermoBusca: (valor: string) => void;
  limiteColunas: number;
  onLimiteColunasChange: (novoLimite: number) => void;
  onSelecionarFaturas: (selecionadas: any[]) => void;
  faturasSelecionadas: any[]; // já tem isso
  onAbrirDetalhesCliente: () => void;
  onAbrirDetalhesProduto: () => void;
}

export default function DataTableFaturamentoPadronizado({
  faturas,
  meta,
  carregando,
  onPageChange,
  onPerPageChange,
  onFiltroChange,
  colunasFiltro,
  termoBusca,
  setTermoBusca,
  limiteColunas,
  onLimiteColunasChange,
  faturasSelecionadas,

  onAbrirDetalhesCliente,
  onAbrirDetalhesProduto,
  onSelecionarFaturas,
}: Props) {
  const headers = useMemo(
    () => [
      'selecionar',
      'data',
      'tipo',
      'nrovenda',
      'total',
      'cliente',
    //  ' codvend',
      'obs',
      'uf',
      'transporte',
    ],
    [],
  );

  const [selecionadas, setSelecionadas] = useState<any[]>([]);

  // Mantém a seleção interna (checkboxes) em sincronia com o carrinho do pai.
  // Quando o pai limpa o carrinho (ex.: ao fechar a fatura), os checkboxes desmarcam
  // — antes o checkbox continuava marcado com o carrinho já vazio.
  useEffect(() => {
    setSelecionadas(faturasSelecionadas || []);
  }, [faturasSelecionadas]);

  const toggleSelecionar = (fatura: any) => {
    const mesmaFatura = selecionadas.find(
      (s) => s.codvenda === fatura.codvenda,
    );
    if (!mesmaFatura) {
      // Se já existe seleção de outro cliente, bloqueia
      if (
        selecionadas.length > 0 &&
        selecionadas.some((s) => s.codcli !== fatura.codcli)
      ) {
        toast.error('Só é possível selecionar faturas do mesmo cliente.');
        return;
      }
      // Adiciona e filtra para garantir que só haja do mesmo cliente
      const atualizadas = [...selecionadas, fatura].filter(
        (fat, _, arr) => fat.codcli === arr[0].codcli
      );
      setSelecionadas(atualizadas);
      onSelecionarFaturas(atualizadas);
    } else {
      // Remove e filtra para garantir que só haja do mesmo cliente
      const atualizadas = selecionadas
        .filter((s) => s.codvenda !== fatura.codvenda)
        .filter((fat, _, arr) => arr.length === 0 || fat.codcli === arr[0].codcli);
      setSelecionadas(atualizadas);
      onSelecionarFaturas(atualizadas);
    }
  };

  const rows = faturas.map((f) => ({
    selecionar: (
      <input
        type="checkbox"
        checked={selecionadas.some((s) => s.codvenda === f.codvenda)}
        onChange={() => toggleSelecionar(f)}
        disabled={
          selecionadas.length > 0 && f.codcli !== selecionadas[0]?.codcli
        }
      />
    ),
    data: new Date(f.data).toLocaleDateString(),
    tipo: f.tipo ?? '-',
    nrovenda: f.nrovenda ?? '-',
    total: `R$ ${Number(f.total || 0).toFixed(2)}`,
    cliente:  `${f.codcli} - ${f.cliente ?? '—'}`,
    obs: f.obs ?? '-',
    uf: f.uf || '-',
    transporte: f.transportadora || '-',
    // codvend: f.codvend || '-',
  }));
  const colunasFiltroVisiveis = colunasFiltro.filter((c) => c !== 'selecionar');
  return (
    <div className="flex flex-col w-full min-h-0 flex-1">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden text-black dark:text-white">
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          carregando={carregando}
          semColunaDeAcaoPadrao
          persistPerPage={false}
          searchValue={termoBusca}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          onSearch={(e) => setTermoBusca(e.target.value)}
          searchInputPlaceholder="Buscar por código, cliente, transporte..."
          onFiltroChange={onFiltroChange}
          colunasFiltro={colunasFiltroVisiveis}
          colunasSemFiltro={['selecionar']}
          nonsortableColumns={['selecionar']}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={onLimiteColunasChange}
          columnLabels={{
            selecionar: '',
            data: 'Data',
            tipo: 'Tipo',
            nrovenda: 'Número da Venda',
            total: 'Total',
            cliente: 'Cliente',
            obs: 'Observações',
            uf: 'UF',
            transporte: 'Transporte',
          }}
          searchRightSlot={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onAbrirDetalhesCliente}
                className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 whitespace-nowrap"
              >
                Detalhes Cliente
              </button>
              <button
                type="button"
                onClick={onAbrirDetalhesProduto}
                className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 whitespace-nowrap"
              >
                Detalhes Produto
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
