import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { Label } from '@/components/ui/label';
import { DefaultButton } from '@/components/common/Buttons';
import { CheckCircle, Circle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Parcela {
  cod_pgto: string;
  numero_parcela: number;
  nro_dup: string;
  dt_venc: string;
  valor_pgto: number;
  valor_pago: number;
  status: 'pendente' | 'pago_parcial' | 'pago';
}

interface ParcelasInfo {
  parcelas: Parcela[];
  total_parcelas: number;
  parcelas_pagas: number;
  valor_total: number;
  valor_pago_total: number;
  percentual_pago: number;
}

interface ModalSelecionarParcelasProps {
  isOpen: boolean;
  onClose: () => void;
  contaId: string | number;
  nomeCredor: string;
  onParcelaSelecionada: (parcela: Parcela) => void;
}

export default function ModalSelecionarParcelas({
  isOpen,
  onClose,
  contaId,
  nomeCredor,
  onParcelaSelecionada
}: ModalSelecionarParcelasProps) {
  const [carregando, setCarregando] = useState(false);
  const [parcelasInfo, setParcelasInfo] = useState<ParcelasInfo | null>(null);
  const [parcelaHover, setParcelaHover] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && contaId) {
      carregarParcelas();
    }
  }, [isOpen, contaId]);

  const carregarParcelas = async () => {
    setCarregando(true);
    try {
      const response = await fetch(`/api/contas-pagar/${contaId}/parcelas`);
      if (!response.ok) throw new Error('Erro ao carregar parcelas');

      const data = await response.json();

      if (data.total_parcelas === 0) {
        toast.error('Esta conta não possui parcelas');
        onClose();
        return;
      }

      setParcelasInfo(data);
    } catch (error) {
      console.error('Erro ao buscar parcelas:', error);
      toast.error('Erro ao carregar parcelas');
      onClose();
    } finally {
      setCarregando(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    try {
      // Tentar criar a data de diferentes formas
      let date: Date;
      
      // Se já tem o formato ISO completo (YYYY-MM-DDTHH:mm:ss)
      if (data.includes('T')) {
        date = new Date(data);
      } 
      // Se é só a data (YYYY-MM-DD)
      else if (data.includes('-')) {
        date = new Date(data + 'T00:00:00');
      }
      // Se é outra coisa, tentar parsear diretamente
      else {
        date = new Date(data);
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', data, error);
      return '-';
    }
  };

  const handleSelecionarParcela = (parcela: Parcela) => {
    if (parcela.status === 'pago') {
      toast.warning('Esta parcela já está totalmente paga');
      return;
    }
    onParcelaSelecionada(parcela);
    onClose();
  };

  const getSaldoRestante = (parcela: Parcela) => {
    return parcela.valor_pgto - parcela.valor_pago;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Selecionar Parcela para Pagar - ${nomeCredor}`}
      width="w-11/12 md:w-4/5 lg:w-3/4"
    >
      <div className="space-y-4">
        {carregando ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando parcelas...</span>
          </div>
        ) : parcelasInfo && parcelasInfo.parcelas.length > 0 ? (
          <>
            {/* Informações Gerais */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300">Total de Parcelas</Label>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {parcelasInfo.total_parcelas}x
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300">Pagas</Label>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {parcelasInfo.parcelas_pagas}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300">Valor Total</Label>
                  <p className="text-lg font-mono font-bold text-purple-900 dark:text-purple-100">
                    {formatarMoeda(parcelasInfo.valor_total)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-purple-700 dark:text-purple-300">Saldo Restante</Label>
                  <p className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400">
                    {formatarMoeda(parcelasInfo.valor_total - parcelasInfo.valor_pago_total)}
                  </p>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    Progresso do Pagamento
                  </Label>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {parcelasInfo.percentual_pago.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(parcelasInfo.percentual_pago, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Instruções */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span><strong>Clique na parcela</strong> que deseja pagar para abrir o formulário de pagamento</span>
              </p>
            </div>

            {/* Lista de Parcelas - Cards Clicáveis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
              {parcelasInfo.parcelas.map((parcela) => {
                const isPago = parcela.status === 'pago';
                const isParcial = parcela.status === 'pago_parcial';
                const saldoRestante = getSaldoRestante(parcela);
                const isHover = parcelaHover === parcela.cod_pgto;

                return (
                  <div
                    key={parcela.cod_pgto}
                    onMouseEnter={() => setParcelaHover(parcela.cod_pgto)}
                    onMouseLeave={() => setParcelaHover(null)}
                    onClick={() => handleSelecionarParcela(parcela)}
                    className={`
                      relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200
                      ${isPago 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700 opacity-60 cursor-not-allowed' 
                        : isParcial
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Ícone de Status */}
                    <div className="absolute top-3 right-3">
                      {isPago ? (
                        <div className="bg-green-500 rounded-full p-1">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      ) : isParcial ? (
                        <div className="bg-blue-500 rounded-full p-1.5">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        </div>
                      ) : (
                        <Circle className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* Número da Parcela */}
                    <div className="mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {parcela.numero_parcela}ª
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {parcela.nro_dup}
                        </span>
                      </div>
                    </div>

                    {/* Informações */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Vencimento:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatarData(parcela.dt_venc)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Valor Original:</span>
                        <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                          {formatarMoeda(parcela.valor_pgto)}
                        </span>
                      </div>

                      {isParcial && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Já Pago:</span>
                          <span className="text-sm font-mono font-semibold text-green-600 dark:text-green-400">
                            {formatarMoeda(parcela.valor_pago)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {isPago ? 'Totalmente Pago' : isParcial ? 'Saldo Restante:' : 'A Pagar:'}
                        </span>
                        <span className={`text-lg font-mono font-bold ${
                          isPago 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-orange-600 dark:text-orange-400'
                        }`}>
                          {isPago ? formatarMoeda(0) : formatarMoeda(saldoRestante)}
                        </span>
                      </div>
                    </div>

                    {/* Badge de Status */}
                    <div className="mt-3 flex justify-center">
                      <span className={`
                        px-3 py-1 rounded-full text-xs font-semibold
                        ${isPago 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : isParcial
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        }
                      `}>
                        {isPago ? '✓ Paga' : isParcial ? '◐ Parcial' : '○ Pendente'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <p>Esta conta não possui parcelas.</p>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <DefaultButton
            variant="secondary"
            onClick={onClose}
            text="Cancelar"
          />
        </div>
      </div>
    </Modal>
  );
}
