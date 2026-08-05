import React, { useEffect, useMemo, useState } from 'react';
import { X, FileSpreadsheet, FileDown, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

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

interface ColunaEstado {
  key: string;
  label: string;
  selecionada: boolean;
}

const estadoInicial = (): ColunaEstado[] =>
  COLUNAS_DISPONIVEIS.map((c) => ({ ...c, selecionada: true }));

export default function ExportarItensEntradaModal({
  isOpen,
  onClose,
  entradaId,
  formato,
}: ExportarItensEntradaModalProps) {
  // Uma única lista ORDENADA guarda tanto a ordem quanto a seleção.
  const [colunas, setColunas] = useState<ColunaEstado[]>(estadoInicial);
  // Índice da linha sendo arrastada (drag-and-drop pelo mouse).
  const [arrastando, setArrastando] = useState<number | null>(null);

  // Reseta ordem e seleção sempre que abrir
  useEffect(() => {
    if (isOpen) {
      setColunas(estadoInicial());
      setArrastando(null);
    }
  }, [isOpen]);

  const selecionadasCount = colunas.filter((c) => c.selecionada).length;
  const nenhumaMarcada = selecionadasCount === 0;

  const toggle = (key: string) =>
    setColunas((prev) =>
      prev.map((c) => (c.key === key ? { ...c, selecionada: !c.selecionada } : c)),
    );

  const marcarTodas = () =>
    setColunas((prev) => prev.map((c) => ({ ...c, selecionada: true })));
  const desmarcarTodas = () =>
    setColunas((prev) => prev.map((c) => ({ ...c, selecionada: false })));

  const mover = (index: number, delta: number) =>
    setColunas((prev) => {
      const destino = index + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const nova = [...prev];
      [nova[index], nova[destino]] = [nova[destino], nova[index]];
      return nova;
    });

  // Drag-and-drop pelo mouse (mesmo padrão do "Gerenciar Colunas").
  const handleDragStart = (index: number) => setArrastando(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (arrastando === null || arrastando === index) return;
    setColunas((prev) => {
      const nova = [...prev];
      const [item] = nova.splice(arrastando, 1);
      nova.splice(index, 0, item);
      return nova;
    });
    setArrastando(index);
  };
  const handleDragEnd = () => setArrastando(null);

  // Chaves selecionadas na ordem atual da lista
  const colunasOrdenadas = useMemo(
    () => colunas.filter((c) => c.selecionada).map((c) => c.key),
    [colunas],
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
              Colunas do relatório
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

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Marque as colunas e defina a ordem no relatório — arraste pela alça
            <GripVertical size={12} className="inline mx-0.5 align-text-bottom" /> ou use as setas.
          </p>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {colunas.map((c, index) => (
              <div
                key={c.key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 py-1.5 pr-1 text-sm text-gray-700 dark:text-gray-200 rounded ${
                  arrastando === index ? 'opacity-50 bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <GripVertical
                  size={16}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-move flex-shrink-0"
                />
                <span className="w-5 text-right text-xs text-gray-400 tabular-nums">
                  {index + 1}
                </span>
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.selecionada}
                    onChange={() => toggle(c.key)}
                    className="rounded border-gray-300"
                  />
                  <span className="truncate">{c.label}</span>
                </label>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => mover(index, -1)}
                    disabled={index === 0}
                    title="Subir"
                    className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(index, 1)}
                    disabled={index === colunas.length - 1}
                    title="Descer"
                    className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
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
