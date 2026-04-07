import { ContaPagar } from '@/hooks/useContasPagar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  CircleChevronDown,
  History,
  ListChecks,
  BarChart3,
  FileDown,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  conta: ContaPagar;
  onVisualizarClick: () => void;
  onMarcarPagoClick: () => void;
  onEditarClick: () => void;
  onCancelarClick: () => void;
  onGerarTituloClick: () => void;
  onHistoricoClick: () => void;
  onVerParcelasClick: () => void;

  onExportarIndividualClick: () => void;
  onVerNotasAssociadasClick?: () => void;
  onVerObservacoesClick?: () => void;
}

export default function DropdownContasPagar({
  conta, 
  onVisualizarClick,
  onMarcarPagoClick,
  onEditarClick,
  onCancelarClick,
  onGerarTituloClick,
  onHistoricoClick,
  onVerParcelasClick,

  onExportarIndividualClick,
  onVerNotasAssociadasClick,
  onVerObservacoesClick,
}: Props) {
  const [open, setOpen] = useState(false);

  // ✅ Lógica correta de permissões baseada em regras de negócio
  const temPagamentos = (conta.total_pago_historico && conta.total_pago_historico > 0) || conta.status === 'pago_parcial';
  const estaCancelada = conta.status === 'cancelado';
  const estaPaga = conta.status === 'pago';
  
  // Só pode editar/cancelar se NÃO tiver pagamentos e NÃO estiver cancelada
  const podeEditarOuCancelar = !temPagamentos && !estaCancelada;
  
  // Só pode marcar como pago se não estiver 100% pago e não estiver cancelada
  const podeMarcarPago = !estaPaga && !estaCancelada;

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
        {/* <DropdownMenuItem
          onClick={onVisualizarClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-600 hover:text-white transition cursor-pointer"
        >
          <Eye className="size-4 text-blue-600 group-hover:text-white transition" />
          Visualizar Detalhes
        </DropdownMenuItem> */}

        <DropdownMenuItem
          onClick={onHistoricoClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
        >
          <History className="size-4 text-indigo-600 group-hover:text-white transition" />
          Histórico de Pagamentos
        </DropdownMenuItem>

        {/* Ver Observações */}
        {onVerObservacoesClick && (
          <DropdownMenuItem
            onClick={onVerObservacoesClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-amber-600 hover:text-white transition cursor-pointer"
          >
            <MessageSquare className="size-4 text-amber-600 group-hover:text-white transition" />
            Ver Observações
          </DropdownMenuItem>
        )}

        {/* Ver Notas Associadas - apenas para títulos importados */}
        {conta.titulo_importado === true && onVerNotasAssociadasClick && (
          <DropdownMenuItem
            onClick={onVerNotasAssociadasClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-orange-600 hover:text-white transition cursor-pointer"
          >
            <FileText className="size-4 text-orange-600 group-hover:text-white transition" />
            Ver Notas Associadas
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={onVerParcelasClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-purple-600 hover:text-white transition cursor-pointer"
        >
          <ListChecks className="size-4 text-purple-600 group-hover:text-white transition" />
          Detalhes da Parcela
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onExportarIndividualClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
        >
          <FileDown className="size-4 text-emerald-600 group-hover:text-white transition" />
          Exportar Excel
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onMarcarPagoClick}
          disabled={!podeMarcarPago}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-green-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <CheckCircle className="size-4 text-green-600 group-hover:text-white transition group-disabled:text-gray-400" />
         Pagar
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onEditarClick}
          disabled={!podeEditarOuCancelar}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-yellow-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <Edit className="size-4 text-yellow-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Editar Titulo
        </DropdownMenuItem>
         <DropdownMenuItem
          onClick={onEditarClick}
          disabled={!podeEditarOuCancelar}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-yellow-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <Edit className="size-4 text-yellow-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Editar Valor do Pagamento
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onCancelarClick}
          // disabled={!podeEditarOuCancelar}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-red-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <XCircle className="size-4 text-red-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Cancelar Titulo
        </DropdownMenuItem>

        {/* <DropdownMenuItem
          onClick={onGerarTituloClick}
          disabled={conta.status === 'pago' || conta.status === 'cancelado'}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-purple-600 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <FileText className="size-4 text-purple-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Gerar Título
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
