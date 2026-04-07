import React, { useState, useMemo } from 'react';
import ModalFormulario from '@/components/common/ModalFormProduto_Lucas';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Download, FileSpreadsheet, Package, Receipt, Calculator, Percent, Shield } from 'lucide-react';

// Tipo de aba disponível
type TabKey = 'basico' | 'ibs_cbs' | 'icms' | 'ipi_pis_cofins' | 'fcp';

// Configuração das abas
const TABS_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'basico', label: 'Dados Básicos', icon: <Package size={16} />, color: 'bg-blue-600' },
  { key: 'ibs_cbs', label: 'IBS/CBS (Nova Lei)', icon: <Receipt size={16} />, color: 'bg-purple-600' },
  { key: 'icms', label: 'ICMS', icon: <Calculator size={16} />, color: 'bg-orange-600' },
  { key: 'ipi_pis_cofins', label: 'IPI/PIS/COFINS', icon: <Percent size={16} />, color: 'bg-red-600' },
  { key: 'fcp', label: 'FCP', icon: <Shield size={16} />, color: 'bg-green-600' },
];

// Colunas por aba
const COLUMNS_BY_TAB: Record<TabKey, { key: string; label: string; format?: 'currency' | 'percent' | 'number' }[]> = {
  basico: [
    { key: 'nrovenda', label: 'Nº Venda' },
    { key: 'codprod', label: 'Cód. Produto' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'referencia', label: 'Referência' },
    { key: 'unimed', label: 'UN' },
    { key: 'qtd', label: 'Qtd', format: 'number' },
    { key: 'prunit', label: 'Preço Unit.', format: 'currency' },
    { key: 'totalproduto', label: 'Total', format: 'currency' },
    { key: 'cfop', label: 'CFOP' },
    { key: 'ncm', label: 'NCM' },
  ],
  ibs_cbs: [
    { key: 'codprod', label: 'Cód. Produto' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'totalproduto', label: 'Total Produto', format: 'currency' },
    { key: 'aliquota_ibs', label: 'Alíq. IBS (%)', format: 'percent' },
    { key: 'valor_ibs', label: 'Valor IBS', format: 'currency' },
    { key: 'aliquota_cbs', label: 'Alíq. CBS (%)', format: 'percent' },
    { key: 'valor_cbs', label: 'Valor CBS', format: 'currency' },
    { key: 'ibs_e', label: 'IBS Estadual', format: 'currency' },
    { key: 'ibs_m', label: 'IBS Municipal', format: 'currency' },
  ],
  icms: [
    { key: 'codprod', label: 'Cód. Produto' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'csticms', label: 'CST ICMS' },
    { key: 'baseicms', label: 'Base ICMS', format: 'currency' },
    { key: 'icms', label: 'Alíq. ICMS (%)', format: 'percent' },
    { key: 'totalicms', label: 'Valor ICMS', format: 'currency' },
    { key: 'mva', label: 'MVA (%)', format: 'percent' },
    { key: 'basesubst_trib', label: 'Base ST', format: 'currency' },
    { key: 'totalsubst_trib', label: 'Valor ST', format: 'currency' },
  ],
  ipi_pis_cofins: [
    { key: 'codprod', label: 'Cód. Produto' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'cstipi', label: 'CST IPI' },
    { key: 'baseipi', label: 'Base IPI', format: 'currency' },
    { key: 'ipi', label: 'Alíq. IPI (%)', format: 'percent' },
    { key: 'totalipi', label: 'Valor IPI', format: 'currency' },
    { key: 'cstpis', label: 'CST PIS' },
    { key: 'basepis', label: 'Base PIS', format: 'currency' },
    { key: 'valorpis', label: 'Valor PIS', format: 'currency' },
    { key: 'cstcofins', label: 'CST COFINS' },
    { key: 'basecofins', label: 'Base COFINS', format: 'currency' },
    { key: 'valorcofins', label: 'Valor COFINS', format: 'currency' },
  ],
  fcp: [
    { key: 'codprod', label: 'Cód. Produto' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'fcp', label: 'Alíq. FCP (%)', format: 'percent' },
    { key: 'base_fcp', label: 'Base FCP', format: 'currency' },
    { key: 'valor_fcp', label: 'Valor FCP', format: 'currency' },
    { key: 'fcp_subst', label: 'Alíq. FCP ST (%)', format: 'percent' },
    { key: 'basefcp_subst', label: 'Base FCP ST', format: 'currency' },
    { key: 'valorfcp_subst', label: 'Valor FCP ST', format: 'currency' },
  ],
};

// Função para formatar valores
const formatValue = (value: any, format?: 'currency' | 'percent' | 'number'): string => {
  const num = parseFloat(value || '0');
  if (isNaN(num)) return value ?? '—';
  
  switch (format) {
    case 'currency':
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'percent':
      return `${num.toFixed(2)}%`;
    case 'number':
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return value ?? '—';
  }
};

// Função para obter valor do produto
const getProductValue = (produto: any, key: string, venda?: any): any => {
  const mappings: Record<string, () => any> = {
    nrovenda: () => venda?.dbvenda?.nrovenda ?? venda?.nrovenda ?? '—',
    codprod: () => produto.codprod,
    descricao: () => produto.dbprod?.descr ?? produto.descr ?? '—',
    referencia: () => produto.dbprod?.ref ?? produto.ref ?? '—',
    unimed: () => produto.dbprod?.unimed ?? produto.unimed ?? '—',
    qtd: () => produto.qtd,
    prunit: () => produto.prunit,
    totalproduto: () => produto.totalproduto ?? (parseFloat(produto.qtd || 0) * parseFloat(produto.prunit || 0)),
    cfop: () => produto.cfop ?? venda?.dbfatura?.cfop1 ?? '—',
    ncm: () => produto.ncm ?? '—',
  };
  
  return mappings[key] ? mappings[key]() : (produto[key] ?? '0');
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  produto?: any;
  venda?: any;
  fatura?: any;
  vendas?: any[];
}

export default function DetalhesProdutoModal({
  isOpen,
  onClose,
  produto,
  venda,
  fatura,
  vendas,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('basico');

  // Processar dados
  const { produtosParaExibir, vendasParaExibir } = useMemo(() => {
    let prods: any[] = [];
    let vends: any[] = [];
    
    if (Array.isArray(vendas) && vendas.length > 0) {
      vends = vendas;
      prods = vendas.flatMap(v => v.produtos || v.dbitvenda || []);
    } else if (fatura) {
      if (Array.isArray(fatura.vendas) && fatura.vendas.length > 0) {
        vends = fatura.vendas;
        prods = fatura.vendas.flatMap((v: any) => v.produtos || v.dbitvenda || []);
      } else {
        prods = Array.isArray(fatura?.produtos) ? fatura.produtos : (fatura?.dbitvenda || []);
        vends = [fatura];
      }
    } else if (venda) {
      // Quando vem de handleVerItensFatura, os produtos estão em dbitvenda
      prods = venda?.dbitvenda || (produto ? [produto] : []);
      vends = [venda];
    } else if (produto) {
      prods = [produto];
      vends = [];
    }
    
    return { produtosParaExibir: prods, vendasParaExibir: vends };
  }, [vendas, fatura, venda, produto]);

  // Calcular totais
  const totais = useMemo(() => {
    const result: Record<string, number> = {};
    const columns = COLUMNS_BY_TAB[activeTab];
    
    columns.forEach(col => {
      if (col.format === 'currency') {
        result[col.key] = produtosParaExibir.reduce((sum, prod) => {
          const val = parseFloat(getProductValue(prod, col.key) || 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }
    });
    
    return result;
  }, [produtosParaExibir, activeTab]);

  // Exportar para CSV
  const handleExportCSV = () => {
    const columns = COLUMNS_BY_TAB[activeTab];
    const headers = columns.map(c => c.label).join(';');
    const rows = produtosParaExibir.map(prod => 
      columns.map(col => {
        const val = getProductValue(prod, col.key, vendasParaExibir[0]);
        return formatValue(val, col.format).replace('R$', '').trim();
      }).join(';')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itens_fatura_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;
  if (produtosParaExibir.length === 0) return null;

  const columns = COLUMNS_BY_TAB[activeTab];

  return (
    <ModalFormulario
      titulo={
        vendasParaExibir.length > 1 
          ? "Itens das Vendas Agrupadas" 
          : (fatura ? "Itens da Fatura" : "Detalhes dos Produtos")
      }
      onClose={onClose}
      footer={null}
      tabs={[]}
      activeTab=""
      setActiveTab={() => {}}
      handleSubmit={() => {}}
      handleClear={() => {}}
      renderTabContent={() => (
        <div className="space-y-4">
          {/* Header com abas e exportar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Abas */}
            <div className="flex flex-wrap gap-1">
              {TABS_CONFIG.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? `${tab.color} text-white shadow-lg`
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Botão Exportar */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FileSpreadsheet size={16} />
              Exportar CSV
            </button>
          </div>

          {/* Resumo rápido */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-300">Total de Itens</div>
              <div className="text-lg font-bold text-blue-100">{produtosParaExibir.length}</div>
            </div>
            {Object.entries(totais).slice(0, 3).map(([key, val]) => {
              const colConfig = columns.find(c => c.key === key);
              return (
                <div key={key} className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-center">
                  <div className="text-xs text-zinc-400">{colConfig?.label || key}</div>
                  <div className="text-lg font-bold text-white">{formatValue(val, 'currency')}</div>
                </div>
              );
            })}
          </div>

          {/* Tabela */}
          <div className="rounded-lg border border-zinc-700 overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-zinc-800 hover:bg-zinc-800">
                  <TableHead className="text-white font-bold w-12">#</TableHead>
                  {columns.map(col => (
                    <TableHead key={col.key} className="text-white font-medium whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosParaExibir.map((prod, idx) => (
                  <TableRow 
                    key={idx} 
                    className={`border-b border-zinc-700 hover:bg-zinc-700/50 ${
                      idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/50'
                    }`}
                  >
                    <TableCell className="font-medium text-zinc-400">{idx + 1}</TableCell>
                    {columns.map(col => (
                      <TableCell key={col.key} className={col.format === 'currency' ? 'text-right font-mono' : ''}>
                        {formatValue(getProductValue(prod, col.key, vendasParaExibir[0]), col.format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {/* Rodapé com totais */}
              <TableFooter>
                <TableRow className="bg-zinc-700 font-bold">
                  <TableCell>TOTAL</TableCell>
                  {columns.map(col => (
                    <TableCell key={col.key} className={col.format === 'currency' ? 'text-right font-mono text-green-400' : ''}>
                      {col.format === 'currency' && totais[col.key] !== undefined
                        ? formatValue(totais[col.key], 'currency')
                        : ''}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}
    />
  );
}