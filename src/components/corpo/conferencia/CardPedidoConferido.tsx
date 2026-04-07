import React from 'react';
import { Clock, User, CheckCircle, UserCheck } from 'lucide-react';
import { PedidoConferido } from '@/data/conferencia/conferenciaService';

interface CardPedidoConferidoProps {
  pedido: PedidoConferido;
  index?: number;
}

const CardPedidoConferido: React.FC<CardPedidoConferidoProps> = ({
  pedido,
  index = 0,
}) => {
  const animationDelay = `${index * 100}ms`;

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dataString;
    }
  };

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
          <div className="px-3 py-1 text-xs font-semibold rounded-full border bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Conferido
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
                Data/Hora
              </span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {formatarData(pedido.horario)}
              </span>
            </div>
          </div>
        </div>

        {/* Informações do Conferente */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">
                Conferido por
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-gray-900 dark:text-white text-sm">
                  {pedido.conferente.nome}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Mat: {pedido.conferente.matricula}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Status Final */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="w-full py-3 px-4 text-center text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <CheckCircle className="w-4 h-4 inline mr-2 text-green-600 dark:text-green-400" />
          Conferência finalizada com sucesso
        </div>
      </div>
    </div>
  );
};

export default CardPedidoConferido;
