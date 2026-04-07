import React from 'react';
import { DefaultButton } from '@/components/common/Buttons';
import { Clock, User, Package, Truck } from 'lucide-react';

interface PedidoCardData {
  codvenda: string;
  nomeCliente: string;
  vendedor: string;
  horario: string;
  status_pedido: string;
}

interface CardPedidoProps {
  pedido: PedidoCardData;
  onFinalizarSeparacao: (codVenda: string) => void;
  index?: number; // Para animação de entrada escalonada
}

const CardPedido: React.FC<CardPedidoProps> = ({
  pedido,
  onFinalizarSeparacao,
  index = 0,
}) => {
  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'Em Separação':
        return {
          bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300',
          icon: <Package className="w-3 h-3" />,
        };
      case 'Aguardando Faturamento':
        return {
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300',
          icon: <Clock className="w-3 h-3" />,
        };
      case 'Finalizado':
        return {
          bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300',
          icon: <Truck className="w-3 h-3" />,
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-300',
          icon: <Clock className="w-3 h-3" />,
        };
    }
  };

  const statusInfo = getStatusBadgeStyles(pedido.status_pedido);
  const animationDelay = `${index * 100}ms`; // Delay escalonado para animação

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 flex flex-col justify-between border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay }}
    >
      {/* Seção Principal */}
      <div>
        {/* Header do Card com Nr. Venda */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Nr. Venda
            </span>
            <p className="font-bold text-xl text-gray-900 dark:text-white mt-1">
              {pedido.codvenda}
            </p>
          </div>
          <div
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusInfo.bg} flex items-center gap-1`}
          >
            {statusInfo.icon}
            {pedido.status_pedido}
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Cliente
          </span>
          <p className="font-semibold text-gray-900 dark:text-white mt-1 leading-relaxed">
            {pedido.nomeCliente}
          </p>
        </div>

        {/* Detalhes em Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">
                Vendedor
              </span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {pedido.vendedor}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">
                Horário
              </span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {pedido.horario}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Ação */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {pedido.status_pedido === 'Em Separação' ? (
          <DefaultButton
            text="Finalizar Separação"
            size="sm"
            variant="confirm"
            className="w-full font-semibold"
            onClick={() => onFinalizarSeparacao(pedido.codvenda)}
            title={`Finalizar separação do pedido ${pedido.codvenda}`}
          />
        ) : (
          <div className="w-full py-3 px-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <Package className="w-4 h-4 inline mr-2" />
            Ação não disponível
          </div>
        )}
      </div>
    </div>
  );
};

export default CardPedido;
