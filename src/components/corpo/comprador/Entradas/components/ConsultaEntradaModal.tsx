import React, { useState, useEffect } from 'react';
import { X, Truck, ShoppingCart, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ConsultaTipo = 'conhecimento' | 'pedidos' | 'notas';

interface ConsultaEntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  entradaId: string;
  numeroEntrada: string;
  tipo: ConsultaTipo;
}

const CONFIG: Record<
  ConsultaTipo,
  { titulo: string; icon: React.ReactNode; colunas: { key: string; label: string; align?: string; fmt?: (v: any) => string }[] }
> = {
  conhecimento: {
    titulo: 'Consultar Conhecimento (CTe)',
    icon: <Truck className="h-5 w-5 text-blue-600" />,
    colunas: [
      { key: 'nrocon', label: 'Nº Con.' },
      { key: 'serie', label: 'Série' },
      { key: 'transportadora', label: 'Transportadora' },
      { key: 'cfop', label: 'CFOP' },
      { key: 'cif', label: 'Tipo', fmt: (v) => (v === 'S' ? 'CIF' : 'FOB') },
      { key: 'totalcon', label: 'Total Con.', align: 'right', fmt: fmtMoeda },
      { key: 'totaltransp', label: 'Total Transp.', align: 'right', fmt: fmtMoeda },
      { key: 'dtcon', label: 'Data', fmt: fmtData },
    ],
  },
  pedidos: {
    titulo: 'Consultar Pedidos (Ordens de Compra)',
    icon: <ShoppingCart className="h-5 w-5 text-orange-600" />,
    colunas: [
      { key: 'codreq', label: 'Ordem de Compra' },
      { key: 'orc_data', label: 'Data', fmt: fmtData },
      { key: 'orc_status', label: 'Status', fmt: (v) => (v === 'F' ? 'Finalizada' : v === 'A' ? 'Aberta' : v || '-') },
      { key: 'itens', label: 'Itens', align: 'right' },
      { key: 'qtd_total', label: 'Qtd. Total', align: 'right' },
      { key: 'valor_total', label: 'Valor', align: 'right', fmt: fmtMoeda },
    ],
  },
  notas: {
    titulo: 'Consultar Notas Fiscais',
    icon: <FileText className="h-5 w-5 text-green-600" />,
    colunas: [
      { key: 'nnf', label: 'Nº NF' },
      { key: 'serie', label: 'Série' },
      { key: 'emitente', label: 'Emitente' },
      { key: 'cnpj_emitente', label: 'CNPJ' },
      { key: 'vprod', label: 'Vlr. Produtos', align: 'right', fmt: fmtMoeda },
      { key: 'vnf', label: 'Vlr. NF', align: 'right', fmt: fmtMoeda },
      { key: 'demi', label: 'Emissão', fmt: fmtData },
    ],
  },
};

function fmtMoeda(v: any) {
  const n = Number(v);
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}
function fmtData(v: any) {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
}

export const ConsultaEntradaModal: React.FC<ConsultaEntradaModalProps> = ({
  isOpen,
  onClose,
  entradaId,
  numeroEntrada,
  tipo,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const cfg = CONFIG[tipo];

  useEffect(() => {
    if (isOpen && entradaId && tipo) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entradaId, tipo]);

  const carregar = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/entradas/${entradaId}/consultar?tipo=${tipo}`);
      const data = await resp.json();
      setRows(data.success ? data.data || [] : []);
    } catch (e) {
      console.error('Erro na consulta:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            {cfg.icon}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{cfg.titulo}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Entrada {numeroEntrada}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {tipo === 'conhecimento'
                ? 'Esta entrada não possui conhecimento de transporte.'
                : 'Nenhum registro encontrado.'}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-100 dark:bg-slate-700">
                  <tr>
                    {cfg.colunas.map((col) => (
                      <th
                        key={col.key}
                        className={`p-3 font-semibold text-gray-700 dark:text-gray-300 ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      {cfg.colunas.map((col) => (
                        <td
                          key={col.key}
                          className={`p-3 text-gray-700 dark:text-gray-300 ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {col.fmt ? col.fmt(row[col.key]) : row[col.key] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
