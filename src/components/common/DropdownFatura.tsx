import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  FileText,
  DollarSign,
  CircleChevronDown,
  Mail,
  MailCheck,
  List,
} from 'lucide-react';
//veroficar
interface Props {
  fatura: any;
  onEspelhoClick: () => void;
  onCobrancaClick: () => void;
  onEditarClick: () => void;
  onCancelarCobranca: () => void;
  onEmailDanfeClick: () => void;
  onenviarCobrancaClick: () => void;
  onVisualizarRejeicaoClick: () => void;
  onCancelarNotaClick: () => void;
  onEmitirNotaClick: () => void;
  onVisualizarBoletosClick: () => void;
  onVerProdutosClick?: () => void;
  isSelecionada?: boolean;
}

export default function DropdownFatura({
  fatura,
  onEspelhoClick,
  onCobrancaClick,
  onEditarClick,
  onCancelarCobranca,
  onEmailDanfeClick,
  onenviarCobrancaClick,
  onVisualizarRejeicaoClick,
  onCancelarNotaClick,
  onEmitirNotaClick,
  onVisualizarBoletosClick,
  onVerProdutosClick,
  isSelecionada = false,
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

      <DropdownMenuContent 
        side="left" 
        align="start" 
        sideOffset={5}
        className="bg-white dark:bg-zinc-800 border rounded-md shadow text-sm z-50 max-h-[80vh] overflow-y-auto"
      >
        <DropdownMenuItem
          onClick={onEmitirNotaClick}
          disabled={fatura.nfs === 'S'}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-green-700 hover:text-white transition"
        >
          <FileText className="size-4 text-green-700 group-hover:text-white transition" />
          Emitir Nota Fiscal
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onEspelhoClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-600 hover:text-white transition"
        >
          <FileText className="size-4 text-gray-600 group-hover:text-white transition" />
          Vizualizar Nota
        </DropdownMenuItem>

        {onVerProdutosClick && (
          <DropdownMenuItem
            onClick={onVerProdutosClick}
            disabled={!isSelecionada}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-purple-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
          >
            <List className="size-4 text-purple-600 group-hover:text-white transition group-disabled:text-gray-400" />
            Ver produtos da fatura
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={onVisualizarRejeicaoClick}
          disabled={!fatura.mensagem_rejeicao && !fatura.motivocancelamento && (!fatura.nfe_motivo || fatura.nfe_status === 'A')}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-yellow-600 hover:text-white transition"
        >
          <FileText className="size-4 text-yellow-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Visualizar Rejeição da Nota
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onCancelarNotaClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-red-700 hover:text-white transition"
        >
          <FileText className="size-4 text-red-700 group-hover:text-white transition" />
          Cancelar Nota Fiscal
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onCobrancaClick}
          disabled={fatura.cobranca === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cobranca !== 'S'
              ? 'hover:bg-green-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
          title={fatura.cobranca === 'S' ? 'Esta fatura já possui cobrança' : 'Gerar nova cobrança para esta fatura'}
        >
          <DollarSign className={`size-4 transition ${
            fatura.cobranca !== 'S'
              ? 'text-green-600 group-hover:text-white'
              : 'text-gray-400'
          }`} />
          Gerar Cobrança
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={fatura.cobranca === 'N'}
          onClick={onCancelarCobranca}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cobranca === 'S'
              ? 'hover:bg-red-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
          title={fatura.cobranca === 'N' ? 'Esta fatura não possui cobrança para cancelar' : 'Cancelar cobrança existente'}
        >
          <DollarSign className={`size-4 transition ${
            fatura.cobranca === 'S'
              ? 'text-red-600 group-hover:text-white'
              : 'text-gray-400'
          }`} />
          Cancelar Cobrança
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onEditarClick}
          disabled={fatura.cancel === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cancel !== 'S'
              ? 'hover:bg-blue-500 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Edit className="size-4 text-blue-500 group-hover:text-white transition" />
          Alterar Fatura
        </DropdownMenuItem>
         <DropdownMenuItem
          onClick={onVisualizarBoletosClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-700 hover:text-white transition"
        >
          <DollarSign className="size-4 text-blue-700 group-hover:text-white transition" />
          Visualizar Boletos
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onEmailDanfeClick}
          disabled={fatura.emailnfe === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.emailnfe !== 'S'
              ? 'hover:bg-blue-500 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Mail className="size-4 text-blue-500 group-hover:text-white transition" />
          Enviar Danfe
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onenviarCobrancaClick}
          // disabled={fatura.cobranca === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition 
          
          `}
        >
          <MailCheck className="size-4 text-blue-500 group-hover:text-white transition" />
          Enviar Cobrança
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
