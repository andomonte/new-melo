import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ItemPromocao } from '@/data/promocoes/promocoes';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type {
  ColDef,
  CellValueChangedEvent,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// Cell Renderers para células multi-linha
const ProdutoCellRenderer = (props: any) => {
  const d = props.data;
  if (!d) return null;
  return (
    <div style={{ lineHeight: 1.4, padding: '4px 0' }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{d.descricao || '-'}</div>
      <div style={{ fontSize: 10, color: '#6b7280' }}>
        <span style={{ fontWeight: 500 }}>{d.codprod || ''}</span>
        <span style={{ margin: '0 4px' }}>|</span>Ref: {d.ref || '-'}
        <span style={{ margin: '0 4px' }}>|</span>{d.marca || '-'}
      </div>
    </div>
  );
};

const PrecosCellRenderer = (props: any) => {
  const d = props.data;
  if (!d) return null;
  const tabela = Number(d._preco_tabela) || 0;
  const compra = Number(d.prcompra) || 0;
  return (
    <div style={{ lineHeight: 1.4, padding: '4px 0', textAlign: 'right' }}>
      <div style={{ fontSize: 11 }}>
        <span style={{ color: '#6b7280' }}>Tabela:</span>{' '}
        <b>R$ {tabela.toFixed(2)}</b>
      </div>
      <div style={{ fontSize: 10, color: '#6b7280' }}>
        Compra: R$ {compra.toFixed(2)}
      </div>
    </div>
  );
};

interface ModalViewPromocaoItemsEditavelProps {
  itens: ItemPromocao[];
  onClose: () => void;
  onConfirm: (itensAtualizados: ItemPromocao[]) => void;
}

interface ItemGrid extends ItemPromocao {
  _percentual_desconto: number;
  _valor_promocao: number;
  _preco_tabela: number;
  _margem_compra: number;
}

const ModalViewPromocaoItemsEditavel: React.FC<ModalViewPromocaoItemsEditavelProps> = ({
  itens,
  onClose,
  onConfirm,
}) => {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowData, setRowData] = useState<ItemGrid[]>([]);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    const rows = itens.map((item) => {
      const precoTabela = Number(item.preco) || 0;
      const descontoItem = Number(item.valor_desconto_item) || 0;
      const precoPromo = Number(item.preco_promocao) || (precoTabela * (1 - descontoItem / 100));
      const prcompra = Number(item.prcompra) || 0;
      return {
        ...item,
        _preco_tabela: precoTabela,
        _percentual_desconto: descontoItem,
        _valor_promocao: Math.round(precoPromo * 100) / 100,
        _margem_compra: prcompra > 0 ? Math.round(((precoPromo / prcompra) - 1) * 10000) / 100 : 0,
        valor_desconto_item: descontoItem,
        qtd_total_item: Number(item.qtd_total_item) || null,
        qtde_minima_item: Number(item.qtde_minima_item) || null,
        qtde_maxima_item: Number(item.qtde_maxima_item) || null,
      } as ItemGrid;
    });
    setRowData(rows);
  }, [itens]);

  const recalcularDePreco = useCallback((row: ItemGrid, novoPreco: number): ItemGrid => {
    const precoTabela = row._preco_tabela;
    const prcompra = Number(row.prcompra) || 0;
    const perc = precoTabela > 0 ? Math.round(((1 - novoPreco / precoTabela) * 100) * 100) / 100 : 0;

    return {
      ...row,
      _valor_promocao: Math.round(novoPreco * 100) / 100,
      _percentual_desconto: perc,
      valor_desconto_item: perc,
      preco_promocao: Math.round(novoPreco * 100) / 100,
      _margem_compra: prcompra > 0 ? Math.round(((novoPreco / prcompra) - 1) * 10000) / 100 : 0,
    };
  }, []);

  const recalcularDePercentual = useCallback((row: ItemGrid, novoPerc: number): ItemGrid => {
    const precoTabela = row._preco_tabela;
    const novoPreco = precoTabela * (1 - novoPerc / 100);
    const updated = recalcularDePreco(row, novoPreco);
    return { ...updated, _percentual_desconto: novoPerc, valor_desconto_item: novoPerc };
  }, [recalcularDePreco]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field;
    const rowIndex = event.rowIndex;
    if (rowIndex == null || !field) return;

    setRowData((prev) => {
      const novos = [...prev];
      let row = { ...novos[rowIndex] };

      if (field === '_percentual_desconto') {
        row = recalcularDePercentual(row, Number(event.newValue) || 0);
      } else if (field === '_valor_promocao') {
        row = recalcularDePreco(row, Number(event.newValue) || 0);
      } else {
        row = { ...row, [field]: event.newValue };
      }

      novos[rowIndex] = row;
      return novos;
    });
    setAlterado(true);
  }, [recalcularDePercentual, recalcularDePreco]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const fmtMoeda = (val: number | null | undefined) =>
    val != null ? `R$ ${Number(val).toFixed(2)}` : '-';

  const fmtPerc = (val: number | null | undefined) =>
    val != null ? `${Number(val).toFixed(2)}%` : '-';

  const columnDefs = useMemo((): any[] => [
    {
      headerName: 'Produto',
      field: 'descricao',
      minWidth: 260,
      flex: 1,
      pinned: 'left',
      autoHeight: true,
      cellRendererSelector: () => ({ component: ProdutoCellRenderer }),
    },
    {
      headerName: 'Estoque',
      field: 'qtddisponivel',
      width: 80,
      type: 'numericColumn',
    },
    {
      headerName: 'Preços',
      field: '_preco_tabela',
      width: 130,
      autoHeight: true,
      cellRendererSelector: () => ({ component: PrecosCellRenderer }),
    },
    {
      headerName: '% Desc',
      field: '_percentual_desconto',
      width: 95,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueFormatter: (p: any) => p.value != null ? `${Number(p.value).toFixed(2)}%` : '',
      valueParser: (p: any) => {
        const val = String(p.newValue).replace('%', '').replace(',', '.').trim();
        return parseFloat(val) || 0;
      },
    },
    {
      headerName: 'Vlr. Promo',
      field: '_valor_promocao',
      width: 105,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueFormatter: (p: any) => fmtMoeda(p.value),
      valueParser: (p: any) => {
        const val = String(p.newValue).replace('R$', '').replace(',', '.').trim();
        return parseFloat(val) || 0;
      },
    },
    {
      headerName: 'Margem',
      field: '_margem_compra',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (p: any) => fmtPerc(p.value),
      cellStyle: (p: any) => ({
        color: (p.value ?? 0) < 0 ? '#dc2626' : (p.value ?? 0) < 20 ? '#d97706' : '#16a34a',
        fontWeight: 600 as const,
      }),
    },
    {
      headerName: 'Qtd',
      field: 'qtd_total_item',
      width: 75,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    {
      headerName: 'Qtd Mín',
      field: 'qtde_minima_item',
      width: 80,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dcfce7' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    {
      headerName: 'Qtd Máx',
      field: 'qtde_maxima_item',
      width: 80,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#fee2e2' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), []);

  const handleExportar = useCallback(() => {
    if (!gridApi) return;
    gridApi.exportDataAsCsv({
      fileName: 'itens_promocao.csv',
      columnSeparator: ';',
    });
  }, [gridApi]);

  const handleConfirmar = useCallback(() => {
    const selectedNodes = gridRef.current?.api?.getSelectedNodes() || [];
    const selectedData = selectedNodes.map((node) => node.data).filter(Boolean) as ItemGrid[];

    // Se nenhum selecionado, usar todos
    const dadosParaSalvar = selectedData.length > 0 ? selectedData : rowData;

    const itensLimpos: ItemPromocao[] = dadosParaSalvar.map((r) => {
      const { _percentual_desconto, _valor_promocao, _preco_tabela, _margem_compra, ...item } = r;
      return {
        ...item,
        tipo_desconto_item: 'PERC' as const,
        valor_desconto_item: _percentual_desconto,
        preco_promocao: _valor_promocao,
      };
    });
    onConfirm(itensLimpos);
  }, [rowData, onConfirm]);

  const gridTheme = useMemo(() => themeQuartz.withParams({
    borderColor: '#d1d5db',
    wrapperBorder: true,
  }), []);

  const rowSelection = useMemo(() => ({
    mode: 'multiRow' as const,
    checkboxes: true,
    headerCheckbox: true,
    selectAll: 'currentPage' as const,
  }), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="relative w-[99vw] h-[97vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-zinc-700">
          <h2 className="text-lg font-bold text-[#347AB6]">Produtos da Promoção</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportar} className="gap-1">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              size="sm"
              disabled={!alterado}
              onClick={handleConfirmar}
            >
              Salvar Alterações
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Dica */}
        <div className="px-4 py-1 bg-blue-50 dark:bg-zinc-800 text-[11px] text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 flex justify-between">
          <span>Duplo clique ou Enter para editar. Tab para próxima célula. Células editáveis em azul.</span>
          <span className="font-medium">{rowData.length} itens</span>
        </div>

        {/* Grid */}
        <style>{`
          .ag-promo-grid .ag-cell {
            border-right: 1px solid #d1d5db !important;
          }
          .ag-promo-grid .ag-row {
            border-bottom: 1px solid #d1d5db !important;
          }
          .ag-promo-grid .ag-header-cell {
            border-right: 1px solid #d1d5db !important;
          }
          .ag-promo-grid .ag-header-cell-resize {
            display: none !important;
          }
        `}</style>
        <div className="flex-1 min-h-0 ag-promo-grid">
          <AgGridReact
            ref={gridRef}
            theme={gridTheme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            rowSelection={rowSelection}
            suppressRowClickSelection={true}
            stopEditingWhenCellsLoseFocus={true}
            singleClickEdit={false}
            enterNavigatesVertically={true}
            enterNavigatesVerticallyAfterEdit={true}
            getRowId={(params) => `${params.data.codprod}-${params.data.id_promocao_item}`}
            rowHeight={48}
          />
        </div>
      </div>
    </div>
  );
};

export default ModalViewPromocaoItemsEditavel;
