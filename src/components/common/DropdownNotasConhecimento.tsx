import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  CircleChevronDown,
  FileDown,
  Printer,
  FileText,
} from 'lucide-react';

interface Props {
  nota: any;
  onVisualizarClick: () => void;
  onGerarTituloClick?: () => void;
  onExportarClick?: () => void;
  onImprimirClick?: () => void;
}

export default function DropdownNotasConhecimento({
  nota, 
  onVisualizarClick,
  onGerarTituloClick,
  onExportarClick,
  onImprimirClick,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded-full transition-all text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="Mais ações"
        >
          <CircleChevronDown
            size={18}
            className={`transition-transform duration-300 ${
              open ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="bg-white dark:bg-zinc-800 border rounded-md shadow text-sm">
        <DropdownMenuItem
          onClick={onVisualizarClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-600 hover:text-white transition cursor-pointer"
        >
          <Eye className="size-4 text-blue-600 group-hover:text-white transition" />
          Visualizar Detalhes
        </DropdownMenuItem>
{/* 
        {onGerarTituloClick && (
          <DropdownMenuItem
            onClick={onGerarTituloClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-orange-600 hover:text-white transition cursor-pointer"
          >
            <FileText className="size-4 text-orange-600 group-hover:text-white transition" />
            Gerar Título
          </DropdownMenuItem>
        )}

        {onExportarClick && (
          <DropdownMenuItem
            onClick={onExportarClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-purple-600 hover:text-white transition cursor-pointer"
          >
            <FileDown className="size-4 text-purple-600 group-hover:text-white transition" />
            Exportar CT-e
          </DropdownMenuItem>
        )}

        {onImprimirClick && (
          <DropdownMenuItem
            onClick={onImprimirClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-gray-600 hover:text-white transition cursor-pointer"
          >
            <Printer className="size-4 text-gray-600 group-hover:text-white transition" />
            Imprimir CT-e
          </DropdownMenuItem>
        )} */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
