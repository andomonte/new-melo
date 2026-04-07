import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContaPagar {
  status: 'pendente' | 'pago' | 'pago_parcial' | 'cancelado';
  valor_pgto: number | string;
  valor_pago?: number | string;
}

interface ResumoFinanceiroCardsProps {
  contas: ContaPagar[];
  carregando: boolean;
}

const ResumoFinanceiroCards: React.FC<ResumoFinanceiroCardsProps> = ({ contas, carregando }) => {
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const calcularValorTotalPendente = () => {
    return contas
      .filter(c => c.status === 'pendente' || c.status === 'pago_parcial')
      .reduce((acc, c) => {
        const valorPgto = Number(c.valor_pgto) || 0;
        const valorPago = Number(c.valor_pago) || 0;
        
        // Para pago_parcial, soma apenas o valor restante
        if (c.status === 'pago_parcial') {
          return acc + (valorPgto - valorPago);
        }
        // Para pendente, soma o valor total
        return acc + valorPgto;
      }, 0);
  };

  const contasPendentes = contas.filter(c => c.status === 'pendente').length;
  const contasParciais = contas.filter(c => c.status === 'pago_parcial').length;
  const contasPagas = contas.filter(c => c.status === 'pago').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 flex-shrink-0">
      {/* Total de Contas */}
      <Card className="p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Total de Contas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {carregando ? '...' : contas.length}
          </div>
        </CardContent>
      </Card>

      {/* Pendentes */}
      <Card className="p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-500">
                {carregando ? '...' : contasPendentes}
              </div>
              <span className="text-[10px] text-gray-500">Pendente</span>
            </div>
            {!carregando && contasParciais > 0 && (
              <>
                <div className="text-gray-400">+</div>
                <div className="flex flex-col">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-500">
                    {contasParciais}
                  </div>
                  <span className="text-[10px] text-gray-500">Parcial</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagas */}
      <Card className="p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Pagas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="text-lg font-bold text-green-600 dark:text-green-500">
            {carregando ? '...' : contasPagas}
          </div>
        </CardContent>
      </Card>

      {/* Valor Total Pendente */}
      <Card className="p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Valor Total Pendente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="text-lg font-bold text-red-600 dark:text-red-500">
            {carregando ? '...' : formatarMoeda(calcularValorTotalPendente())}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumoFinanceiroCards;
