import React, { useEffect, useMemo, useState } from 'react';
import { X, FileSpreadsheet, FileDown } from 'lucide-react';

interface ExportarItensEntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  entradaId: string | number;
  formato: 'excel' | 'pdf';
}

// Deve espelhar TODAS_COLUNAS de /api/entradas/[id]/exportar-itens.ts
const COLUNAS_DISPONIVEIS: { key: string; label: string }[] = [
  { key: 'referencia', label: 'Referência' },
  { key: 'produto_descricao', label: 'Descrição' },
  { key: 'ordem_compra', label: 'Ordem de Compra' },
  { key: 'estoque_anterior', label: 'Est. Ant.' },
  { key: 'quantidade', label: 'Qtd' },
  { key: 'unimed', label: 'Unid.' },
  { key: 'valor_unitario', label: 'Preço Unit.' },
  { key: 'custo', label: 'Custo' },
  { key: 'valor_total', label: 'Total' },
  { key: 'armazens', label: 'Armazéns' },
];

export default function ExportarItensEntradaModal({
  isOpen,
  onClose,
  entradaId,
  formato,
}: ExportarItensEntradaModalProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(COLUNAS_DISPONIVEIS.map((c) => c.key)),
  );

  // Reseta para todas selecionadas sempre que abrir
  useEffect(() => {
    if (isOpen) setSelecionadas(new Set(COLUNAS_DISPONIVEIS.map((c) => c.key)));
  }, [isOpen]);

  const todasMarcadas = selecionadas.size === COLUNAS_DISPONIVEIS.length;
  const nenhumaMarcada = selecionadas.size === 0;

  const toggle = (key: string) => {
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      if (nova.has(key)) nova.delete(key);
      else nova.add(key);
      return nova;
    });
  };

  const marcarTodas = () => setSelecionadas(new Set(COLUNAS_DISPONIVEIS.map((c) => c.key)));
  const desmarcarTodas = () => setSelecionadas(new Set());

  // Mantém a ordem canônica das colunas na URL
  const colunasOrdenadas = useMemo(
    () => COLUNAS_DISPONIVEIS.filter((c) => selecionadas.has(c.key)).map((c) => c.key),
    [selecionadas],
  );

  const gerar = () => {
    if (nenhumaMarcada) return;
    const url = `/api/entradas/${entradaId}/exportar-itens?formato=${formato}&colunas=${encodeURIComponent(
      colunasOrdenadas.join(','),
    )}`;
    window.open(url, '_blank');
    onClose();
  };

  // Enter gera, Esc fecha
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        gerar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, colunasOrdenadas, nenhumaMarcada]);

  if (!isOpen) return null;

  const ehPdf = formato === 'pdf';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md flex flex-col">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            {ehPdf ? (
              <FileDown className="w-5 h-5 text-red-600" />
            ) : (
              <FileSpreadsheet className="w-5 h-5 text-green-700" />
            )}
            <h4 className="text-lg font-bold text-[#347AB6]">
              Exportar Itens ({ehPdf ? 'PDF' : 'Excel'})
            </h4>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Selecione as colunas do relatório
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={marcarTodas} className="text-[#347AB6] hover:underline">
                Todas
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={desmarcarTodas} className="text-[#347AB6] hover:underline">
                Nenhuma
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-72 overflow-y-auto">
            {COLUNAS_DISPONIVEIS.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.has(c.key)}
                  onChange={() => toggle(c.key)}
                  className="rounded border-gray-300"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={gerar}
            disabled={nenhumaMarcada}
            className="px-4 py-2 text-sm rounded-md bg-[#347AB6] text-white hover:bg-[#2a5f8f] disabled:opacity-50"
          >
            Gerar {ehPdf ? 'PDF' : 'Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
