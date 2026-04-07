import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { OrdemCompraDTO } from '@/types/compras/requisition';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import api from '@/components/services/api';

interface PagamentoAntecipadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemCompraDTO;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
}

const opcoestipoDocumento = [
  { value: 'BOLETO', label: 'Boleto Bancário' },
  { value: 'TRANSFERENCIA', label: 'Transferência Bancária' },
  { value: 'PIX', label: 'PIX' },
  { value: 'NOTA_PROMISSORIA', label: 'Nota Promissória' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export const PagamentoAntecipadoModal: React.FC<
  PagamentoAntecipadoModalProps
> = ({ isOpen, onClose, ordem, onSuccess, userId, userName }) => {
  const [loading, setLoading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState('BOLETO');
  const [dataVencimento, setDataVencimento] = useState<Date | null>(null);
  const [valorEntrada, setValorEntrada] = useState('');
  // Banco fixo para pagamento antecipado
  const banco = 'MELO COMERCIO';

  // Verificar se pagamento já foi configurado (desabilita edição)
  const cobrancaJaGerada = ordem.orc_pagamento_configurado || false;

  useEffect(() => {
    if (isOpen && !cobrancaJaGerada) {
      // Limpar campos ao abrir
      setTipoDocumento('BOLETO');
      setDataVencimento(null);
      setValorEntrada(ordem.orc_valor_total?.toString() || '0');
    }
  }, [isOpen, cobrancaJaGerada, ordem.orc_valor_total]);

  // Data mínima: amanhã (pelo menos 1 dia após hoje)
  const getDataMinima = () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);
    return amanha;
  };

  const handleSubmit = async () => {
    // Validações
    if (!banco) {
      toast.error('Selecione o banco');
      return;
    }

    if (!dataVencimento) {
      toast.error('Selecione a data de vencimento');
      return;
    }

    // Validar que a data é pelo menos 1 dia após hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);

    if (dataVenc <= hoje) {
      toast.error('A data de vencimento deve ser pelo menos 1 dia após hoje');
      return;
    }

    const valorNum = parseFloat(valorEntrada) || 0;
    if (valorNum <= 0) {
      toast.error('Valor de entrada deve ser maior que zero');
      return;
    }

    const valorTotal = ordem.orc_valor_total || 0;
    if (valorNum > valorTotal) {
      toast.error('Valor de entrada não pode ser maior que o valor total da ordem');
      return;
    }

    try {
      setLoading(true);

      // Calcular dias desde hoje até vencimento
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dias = Math.floor(
        (dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Formatar data para ISO
      const year = dataVencimento.getFullYear();
      const month = String(dataVencimento.getMonth() + 1).padStart(2, '0');
      const day = String(dataVencimento.getDate()).padStart(2, '0');
      const dataISO = `${year}-${month}-${day}`;

      // Enviar para API - pagamento antecipado como parcela 0
      const response = await api.post(
        `/api/ordens/${ordem.orc_id}/configurar-pagamento`,
        {
          banco: banco,
          tipoDocumento: tipoDocumento,
          valorEntrada: valorNum,
          parcelas: [
            {
              numero_parcela: 0, // Parcela 0 = pagamento antecipado
              valor_parcela: valorNum,
              dias: dias,
              data_vencimento: dataISO
            }
          ],
          userId,
          userName
        }
      );

      if (response.data.success) {
        toast.success('Pagamento antecipado configurado com sucesso!');
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.message || 'Erro ao configurar pagamento');
      }
    } catch (err: any) {
      console.error('Erro ao salvar configuração:', err);
      const errorMsg =
        err.response?.data?.error || 'Erro ao salvar configuração de pagamento';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <style>{`
        /* Remover setas dos inputs numéricos */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DollarSign className="text-green-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Pagamento Antecipado
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ordem #{ordem.orc_id} - {ordem.fornecedor_nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Alerta de Cobrança Gerada */}
          {cobrancaJaGerada && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Configuração Bloqueada
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    O pagamento já foi configurado para esta ordem. As
                    configurações não podem mais ser alteradas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Informações da Ordem */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Fornecedor:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {ordem.fornecedor_nome}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Valor Total:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white font-bold">
                  R${' '}
                  {(ordem.orc_valor_total || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="space-y-4">
            {/* Banco - Fixo como MELO COMERCIO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Banco
              </label>
              <input
                type="text"
                value={banco}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>

            {/* Tipo de Documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Documento *
              </label>
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loading || cobrancaJaGerada}
              >
                {opcoestipoDocumento.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor de Entrada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valor do Pagamento Antecipado (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={ordem.orc_valor_total}
                value={valorEntrada}
                onChange={(e) => setValorEntrada(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={cobrancaJaGerada}
                readOnly={cobrancaJaGerada}
              />
            </div>

            {/* Data de Vencimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adicionar Vencimento *
              </label>
              <div className="relative">
                <DatePicker
                  selected={dataVencimento}
                  onChange={(date: Date | null) => setDataVencimento(date)}
                  dateFormat="dd/MM/yyyy"
                  locale={ptBR}
                  minDate={getDataMinima()}
                  disabled={cobrancaJaGerada}
                  placeholderText="Selecione a data de vencimento (mínimo amanhã)"
                  className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  calendarClassName="dark:bg-gray-800 dark:text-white"
                  wrapperClassName="w-full"
                />
                <CalendarIcon
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                A data de vencimento deve ser no mínimo 1 dia após hoje
              </p>
            </div>
          </div>

          {/* Resumo */}
          {dataVencimento && parseFloat(valorEntrada) > 0 && (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Resumo do Pagamento Antecipado
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Valor:
                  </span>
                  <div className="font-bold text-green-600 dark:text-green-400">
                    R${' '}
                    {parseFloat(valorEntrada).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Vencimento:
                  </span>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {dataVencimento.toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!cobrancaJaGerada && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !dataVencimento || !valorEntrada}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Salvando...' : 'Confirmar Pagamento Antecipado'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
