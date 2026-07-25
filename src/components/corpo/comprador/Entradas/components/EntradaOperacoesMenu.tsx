import React, { useState } from 'react';
import { CircleChevronDown, Eye, RotateCcw, List, Warehouse, DollarSign, PackageCheck, Ban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import MessageModal from '@/components/common/MessageModal';
import RomaneioModal from '@/components/entradas/RomaneioModal';
import { ConfirmarPrecoModal } from './ConfirmarPrecoModal';
import { ConfirmarEstoqueModal } from './ConfirmarEstoqueModal';
import { ConsultaEntradaModal, ConsultaTipo } from './ConsultaEntradaModal';
import { Truck, ShoppingCart, FileText } from 'lucide-react';

interface EntradaOperacoesMenuProps {
  entrada: {
    id: string;
    numeroNF: string;
    numeroEntrada?: string;
    status: string;
    temRomaneio?: boolean;
    precoConfirmado?: boolean;
  };
  onView?: () => void;
  onRefresh?: () => void;
  onViewItems?: () => void;
}

export const EntradaOperacoesMenu: React.FC<EntradaOperacoesMenuProps> = ({
  entrada,
  onView,
  onRefresh,
  onViewItems
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmReabrir, setShowConfirmReabrir] = useState(false);
  const [showRomaneio, setShowRomaneio] = useState(false);
  const [showConfirmarPreco, setShowConfirmarPreco] = useState(false);
  const [showConfirmarEstoque, setShowConfirmarEstoque] = useState(false);
  const [consultaTipo, setConsultaTipo] = useState<ConsultaTipo | null>(null);
  const [showConfirmCancelar, setShowConfirmCancelar] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [messageData, setMessageData] = useState({ title: '', message: '', type: 'info' as any });
  const [loading, setLoading] = useState(false);

  // Pode fazer romaneio se ainda nao tem romaneio
  const canFazerRomaneio = !entrada.temRomaneio;

  // Pode confirmar preco se ainda nao foi confirmado
  const canConfirmarPreco = !entrada.precoConfirmado;

  // Confirmar estoque so DEPOIS do preco (workflow PRECO_CONFIRMADO), como no Delphi.
  const canConfirmarEstoque =
    entrada.precoConfirmado && entrada.status === 'PRECO_CONFIRMADO';

  const handleReabrirEntrada = () => {
    setShowConfirmReabrir(true);
  };

  const handleConfirmarReabrir = async () => {
    setShowConfirmReabrir(false);
    setLoading(true);

    try {
      const response = await fetch(`/api/entradas/${entrada.id}/reabrir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          observacao: `Entrada ${entrada.numeroNF} reaberta para correções`
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessageData({
          title: 'Entrada Reaberta!',
          message: 'A entrada foi reaberta com sucesso e está disponível para edição.',
          type: 'success'
        });
        setShowMessage(true);

        // Refresh da lista
        if (onRefresh) {
          setTimeout(() => onRefresh(), 1000);
        }
      } else {
        setMessageData({
          title: 'Erro ao Reabrir Entrada',
          message: data.error || 'Ocorreu um erro desconhecido',
          type: 'error'
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao reabrir entrada:', error);
      setMessageData({
        title: 'Erro de Comunicação',
        message: 'Não foi possível conectar com o servidor. Tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarPreco = async (atualizarPrecoVenda: boolean, observacao: string, itensEditados?: any[]) => {
    setShowConfirmarPreco(false);
    setLoading(true);

    try {
      const response = await fetch(`/api/entradas/${entrada.id}/confirmar-preco`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          atualizarPrecoVenda,
          observacao,
          itensEditados: itensEditados?.map(item => ({
            id: item.id,
            produto_cod: item.produto_cod,
            preco_unitario: item.preco_unitario,
            preco_total: item.preco_total,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessageData({
          title: 'Preco Confirmado!',
          message: 'Os precos foram confirmados e os custos atualizados com sucesso.',
          type: 'success'
        });
        setShowMessage(true);

        if (onRefresh) {
          setTimeout(() => onRefresh(), 1000);
        }
      } else {
        setMessageData({
          title: 'Erro ao Confirmar Preco',
          message: data.error || 'Ocorreu um erro desconhecido',
          type: 'error'
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao confirmar preco:', error);
      setMessageData({
        title: 'Erro de Comunicacao',
        message: 'Nao foi possivel conectar com o servidor. Tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarCancelar = async () => {
    setShowConfirmCancelar(false);
    setLoading(true);
    try {
      const response = await fetch(`/api/entradas/${entrada.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: `Entrada ${entrada.numeroNF} cancelada` }),
      });
      const data = await response.json();
      if (data.success) {
        setMessageData({
          title: 'Entrada Cancelada',
          message: 'A entrada foi cancelada, o estoque revertido e a NFe liberada para reprocessar.',
          type: 'success',
        });
        setShowMessage(true);
        if (onRefresh) setTimeout(() => onRefresh(), 1000);
      } else {
        setMessageData({
          title: 'Erro ao Cancelar Entrada',
          message: data.error || 'Ocorreu um erro desconhecido',
          type: 'error',
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao cancelar entrada:', error);
      setMessageData({
        title: 'Erro de Comunicação',
        message: 'Não foi possível conectar com o servidor. Tente novamente.',
        type: 'error',
      });
      setShowMessage(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarEstoque = async (observacao: string) => {
    setShowConfirmarEstoque(false);
    setLoading(true);
    try {
      const response = await fetch(`/api/entradas/${entrada.id}/confirmar-estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao }),
      });
      const data = await response.json();
      if (data.success) {
        setMessageData({
          title: 'Estoque Confirmado!',
          message: 'O estoque foi confirmado e os produtos liberados para venda.',
          type: 'success',
        });
        setShowMessage(true);
        if (onRefresh) setTimeout(() => onRefresh(), 1000);
      } else {
        setMessageData({
          title: 'Erro ao Confirmar Estoque',
          message: data.error || 'Ocorreu um erro desconhecido',
          type: 'error',
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao confirmar estoque:', error);
      setMessageData({
        title: 'Erro de Comunicação',
        message: 'Não foi possível conectar com o servidor. Tente novamente.',
        type: 'error',
      });
      setShowMessage(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center">
        {/* Menu de Operações */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              title="Ações"
              disabled={loading}
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <CircleChevronDown size={20} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Visualizar */}
            <DropdownMenuItem onClick={onView}>
              <Eye className="mr-2 h-4 w-4" />
              Visualizar
            </DropdownMenuItem>

            {/* Ver Itens */}
            <DropdownMenuItem onClick={onViewItems}>
              <List className="mr-2 h-4 w-4" />
              Ver Itens
            </DropdownMenuItem>

            {/* Consultas (read-only) */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConsultaTipo('conhecimento')}>
              <Truck className="mr-2 h-4 w-4 text-blue-600" />
              Consultar Conhecimento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConsultaTipo('pedidos')}>
              <ShoppingCart className="mr-2 h-4 w-4 text-orange-600" />
              Consultar Pedidos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConsultaTipo('notas')}>
              <FileText className="mr-2 h-4 w-4 text-green-600" />
              Consultar Notas Fiscais
            </DropdownMenuItem>

            {/* Fazer Romaneio */}
            {canFazerRomaneio && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowRomaneio(true)}>
                  <Warehouse className="mr-2 h-4 w-4 text-purple-600" />
                  Fazer Romaneio
                </DropdownMenuItem>
              </>
            )}

            {/* Confirmar Preco */}
            {canConfirmarPreco && (
              <DropdownMenuItem onClick={() => setShowConfirmarPreco(true)}>
                <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                Confirmar Preco
              </DropdownMenuItem>
            )}

            {/* Confirmar Estoque (apos o preco) */}
            {canConfirmarEstoque && (
              <DropdownMenuItem onClick={() => setShowConfirmarEstoque(true)}>
                <PackageCheck className="mr-2 h-4 w-4 text-emerald-600" />
                Confirmar Estoque
              </DropdownMenuItem>
            )}

            {/* Reabrir (se necessário) */}
            {entrada.status !== 'PENDENTE' && entrada.status !== 'PROCESSANDO' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-orange-600"
                  onClick={() => handleReabrirEntrada()}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reabrir Entrada
                </DropdownMenuItem>
              </>
            )}

            {/* Cancelar Entrada (destrutivo) */}
            {entrada.status !== 'CANCELADA' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => setShowConfirmCancelar(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancelar Entrada
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modais de Confirmação */}
      <ConfirmationModal
        isOpen={showConfirmReabrir}
        onClose={() => setShowConfirmReabrir(false)}
        onConfirm={handleConfirmarReabrir}
        title="Reabrir Entrada"
        message={`Deseja reabrir a entrada ${entrada.numeroNF}?\n\nEsta ação irá:\n• Retornar a entrada para o status PROCESSANDO\n• Permitir alterações nos valores e quantidades\n• Reverter confirmações anteriores`}
        type="warning"
        confirmText="Sim, Reabrir Entrada"
        cancelText="Cancelar"
        loading={loading}
      />

      <ConfirmationModal
        isOpen={showConfirmCancelar}
        onClose={() => setShowConfirmCancelar(false)}
        onConfirm={handleConfirmarCancelar}
        title="Cancelar Entrada"
        message={`Deseja CANCELAR a entrada ${entrada.numeroNF}?\n\nEsta ação irá:\n• Reverter o estoque adicionado por esta entrada\n• Cancelar o romaneio e devolver o estoque por armazém\n• Reabrir as ordens de compra atendidas\n• Marcar a entrada como CANCELADA\n• Liberar a NFe para reprocessamento\n\nEsta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, Cancelar Entrada"
        cancelText="Voltar"
        loading={loading}
      />

      <MessageModal
        isOpen={showMessage}
        onClose={() => setShowMessage(false)}
        title={messageData.title}
        message={messageData.message}
        type={messageData.type}
      />

      <RomaneioModal
        open={showRomaneio}
        onClose={() => setShowRomaneio(false)}
        entradaId={parseInt(entrada.id)}
        numeroEntrada={entrada.numeroEntrada || entrada.numeroNF}
        obrigatorio={false}
        onSalvoComSucesso={() => {
          setShowRomaneio(false);
          setMessageData({
            title: 'Romaneio Salvo!',
            message: 'Os produtos foram distribuídos entre os armazéns com sucesso.',
            type: 'success'
          });
          setShowMessage(true);
          if (onRefresh) {
            setTimeout(() => onRefresh(), 1000);
          }
        }}
      />

      <ConfirmarPrecoModal
        isOpen={showConfirmarPreco}
        onClose={() => setShowConfirmarPreco(false)}
        onConfirm={handleConfirmarPreco}
        numeroNF={entrada.numeroNF}
        entradaId={entrada.id}
        loading={loading}
      />

      <ConfirmarEstoqueModal
        isOpen={showConfirmarEstoque}
        onClose={() => setShowConfirmarEstoque(false)}
        onConfirm={handleConfirmarEstoque}
        numeroNF={entrada.numeroNF}
        entradaId={entrada.id}
        loading={loading}
      />

      {consultaTipo && (
        <ConsultaEntradaModal
          isOpen={!!consultaTipo}
          tipo={consultaTipo}
          entradaId={entrada.id}
          numeroEntrada={entrada.numeroEntrada || entrada.numeroNF}
          onClose={() => setConsultaTipo(null)}
        />
      )}
    </>
  );
};