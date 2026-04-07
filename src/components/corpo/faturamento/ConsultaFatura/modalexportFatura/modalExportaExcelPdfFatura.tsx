import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { RiFileExcel2Line, RiFilePdf2Fill } from 'react-icons/ri';

interface Props {
  open: boolean;
  onClose: () => void;
  colunas: string[];
  colunasVisiveis: string[];
  filtros: any[];
  busca: string;
  faturas: any[];
}

const nomesAmigaveis: Record<string, string> = {
  codfat: 'Código da Fatura',
  nroform: 'Formulário',
  cliente_nome: 'Cliente',
  totalnf: 'Total (R$)',
  data: 'Data',
  codvend: 'Vendedor',
  codtransp: 'Transportadora',
  cancel: 'Cancelado',
  cobranca: 'Cobrança',
  denegada: 'Denegada',
  agp: 'Agrupada',
};

export default function ModalExportarFaturas({
  open,
  onClose,
  colunas,
  colunasVisiveis,
  filtros,
  busca,
  faturas,
}: Props) {
  const [colunasSelecionadas, setColunasSelecionadas] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setColunasSelecionadas(colunasVisiveis);
    }
  }, [open, colunasVisiveis]);

  const toggleColuna = (coluna: string) => {
    setColunasSelecionadas((prev) =>
      prev.includes(coluna)
        ? prev.filter((c) => c !== coluna)
        : [...prev, coluna],
    );
  };

  const handleOpcaoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'todos') setColunasSelecionadas(colunas);
    if (e.target.value === 'nenhum') setColunasSelecionadas([]);
  };

  const exportarParaPDF = () => {
    const doc = new jsPDF();

    const logoBase64 =
      'data:image/jpeg;base64,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'; // insere aqui completo

    doc.addImage(logoBase64, 'PNG', 15, 10, 40, 15);
    doc.setFontSize(12);
    doc.text('Relatório de Faturas', 60, 20);

    const tableData = faturas.map((f) =>
      colunasSelecionadas.map((col) => {
        if (col === 'totalnf') return `R$ ${Number(f[col] || 0).toFixed(2)}`;
        if (col === 'data') return new Date(f[col]).toLocaleDateString();
        return f[col] ?? '';
      }),
    );

    autoTable(doc, {
      startY: 30,
      head: [colunasSelecionadas.map((col) => nomesAmigaveis[col] ?? col)],
      body: tableData,
      styles: { fontSize: 8 },
      theme: 'grid',
    });

    doc.save('faturas.pdf');
    onClose();
  };

  const exportarParaExcel = () => {
    const dados = faturas.map((f) =>
      colunasSelecionadas.reduce((acc, col) => {
        acc[nomesAmigaveis[col] ?? col] = f[col];
        return acc;
      }, {} as any),
    );

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Faturas');

    XLSX.writeFile(workbook, 'faturas.xlsx');
    onClose();
  };

  if (!open) return null;

  return (
    <DialogContent className="max-w-[600px] w-full bg-white dark:bg-zinc-900">
      <DialogHeader>
        <DialogTitle className="text-xl">Exportar Faturas</DialogTitle>
        <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-300">
          Selecione as colunas e o formato de exportação:
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
            Colunas a Exportar:
          </span>
          <select
            onChange={handleOpcaoChange}
            className="text-sm px-2 py-1 rounded border dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            defaultValue=""
          >
            <option value="" disabled>
              Opções rápidas
            </option>
            <option value="todos">Selecionar todas</option>
            <option value="nenhum">Desmarcar todas</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {colunas.map((coluna) => (
            <label key={coluna} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={colunasSelecionadas.includes(coluna)}
                onChange={() => toggleColuna(coluna)}
              />
              {nomesAmigaveis[coluna] ?? coluna}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={exportarParaExcel}
          className="flex items-center gap-1 bg-green-700 text-white py-1.5 px-3 text-xs rounded hover:bg-green-800 transition"
        >
          <RiFileExcel2Line size={14} />
          Excel
        </button>

        <button
          onClick={exportarParaPDF}
          className="flex items-center gap-1 bg-red-700 text-white py-1.5 px-3 text-xs rounded hover:bg-red-800 transition"
        >
          <RiFilePdf2Fill size={14} />
          PDF
        </button>
      </div>
    </DialogContent>
  );
}
