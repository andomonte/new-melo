import { ContaReceber } from '@/hooks/useContasReceber';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  Edit,
  XCircle,
  DollarSign,
  Undo2,
  CreditCard,
  CircleChevronDown,
  History,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  conta: ContaReceber;
  onVisualizarClick: () => void;
  onDarBaixaClick: () => void;
  onRetirarBaixaClick: () => void;
  onEditarClick: () => void;
  onCancelarClick: () => void;
  onHistoricoClick: () => void;
  onVerCartaoClick?: () => void;
}

export default function DropdownContasReceber({
  conta,
  onVisualizarClick,
  onDarBaixaClick,
  onRetirarBaixaClick,
  onEditarClick,
  onCancelarClick,
  onHistoricoClick,
  onVerCartaoClick,
}: Props) {
  const [open, setOpen] = useState(false);

  // Lógica de permissões baseada em regras de negócio
  const estaCancelada = conta.status === 'cancelado';
  const estaRecebido = conta.status === 'recebido';
  const estaRecebidoParcial = conta.status === 'recebido_parcial';
  
  // Só pode editar se não estiver cancelada ou recebida
  const podeEditar = !estaCancelada && !estaRecebido;
  
  // Pode dar baixa se estiver pendente ou vencido
  const podeDarBaixa = (conta.status === 'pendente' || conta.status === 'vencido') && !estaCancelada;
  
  // Pode retirar baixa se estiver recebido (total ou parcial)
  const podeRetirarBaixa = (estaRecebido || estaRecebidoParcial) && !estaCancelada;
  
  // Pode cancelar se não estiver cancelada ou totalmente recebida
  const podeCancelar = !estaCancelada && !estaRecebido;

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
          Visualizar
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onHistoricoClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
        >
          <History className="size-4 text-indigo-600 group-hover:text-white transition" />
          Histórico de Recebimentos
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onEditarClick}
          disabled={!podeEditar}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-amber-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <Edit className="size-4 text-amber-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Alterar
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDarBaixaClick}
          disabled={!podeDarBaixa}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-green-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <DollarSign className="size-4 text-green-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Dar Baixa
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onRetirarBaixaClick}
          disabled={!podeRetirarBaixa}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-orange-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <Undo2 className="size-4 text-orange-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Retirar Baixa
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onCancelarClick}
          disabled={!podeCancelar}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-red-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <XCircle className="size-4 text-red-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Cancelar Título
        </DropdownMenuItem>

        {conta.tem_cartao && onVerCartaoClick && (
          <DropdownMenuItem
            onClick={onVerCartaoClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-600 hover:text-white transition cursor-pointer"
          >
            <CreditCard className="size-4 text-blue-600 group-hover:text-white transition" />
            Ver Cartão
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
