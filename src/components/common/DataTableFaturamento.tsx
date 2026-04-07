import React, { useMemo, useState } from 'react';
import DataTable from '@/components/common/DatatableFaturamentoNovo';
import SelectInput from '@/components/common/SelectInput2';
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
      <div className="flex-1 min-h-0 overflow-hidden text-black dark:text-white">
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          carregando={carregando}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          onSearch={(e) => setTermoBusca(e.target.value)}
          searchInputPlaceholder="Buscar por código, cliente, transporte..."
          onFiltroChange={onFiltroChange}
          colunasFiltro={colunasFiltroVisiveis}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={onLimiteColunasChange}
          semColunaDeAcaoPadrao={true}
          faturasSelecionadas={selecionadas}
          onAbrirDetalhesCliente={onAbrirDetalhesCliente}
          onAbrirDetalhesProduto={onAbrirDetalhesProduto}
        />
      </div>
    </div>
  );
}
