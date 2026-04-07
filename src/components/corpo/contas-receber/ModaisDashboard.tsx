import React from 'react';
import Modal from '@/components/common/Modal';
import { useModaisContasReceber } from './useModaisContasReceber';
import { ContaReceber } from '@/hooks/useContasReceber';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Eye, FileText, History, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { formatarData, formatarMoeda } from './utils';

export default function ModaisDashboard() {
  const modais = useModaisContasReceber();

  if (!modais.contaSelecionada) return null;

  return (
    <>
      {/* Modal Detalhes */}
      <Modal
        isOpen={modais.modalDetalhesAberto}
        onClose={() => modais.setModalDetalhesAberto(false)}
        title="Detalhes da Conta a Receber"
        width="w-11/12 md:w-4/5 lg:w-3/4 xl:w-1/2"
      >
        <div className="space-y-6">
          {/* Header com informações principais */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Conta #{modais.contaSelecionada.cod_receb}
              </h3>
              <Badge
                className={`${
                  modais.contaSelecionada.status === 'recebido'
                    ? 'bg-green-500 hover:bg-green-600'
                    : modais.contaSelecionada.status === 'recebido_parcial'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : modais.contaSelecionada.status === 'cancelado'
                    ? 'bg-red-500 hover:bg-red-600'
                    : modais.contaSelecionada.status === 'vencido'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {modais.contaSelecionada.status === 'recebido'
                  ? 'Recebido'
                  : modais.contaSelecionada.status === 'recebido_parcial'
                  ? 'Recebido Parcial'
                  : modais.contaSelecionada.status === 'cancelado'
                  ? 'Cancelado'
                  : modais.contaSelecionada.status === 'vencido'
                  ? 'Vencido'
                  : 'Pendente'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cliente */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white font-medium">
                  {modais.contaSelecionada.nome_cliente}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Cód: {modais.contaSelecionada.codcli}
                </div>
              </div>

              {/* Valor Original */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Original</span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatarMoeda(modais.contaSelecionada.valor_original)}
                </div>
              </div>

              {/* Valor Recebido */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Recebido</span>
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {modais.contaSelecionada.valor_recebido ? formatarMoeda(modais.contaSelecionada.valor_recebido) : 'R$ 0,00'}
                </div>
              </div>
            </div>
          </div>

          {/* Informações Detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: Datas e Documentos */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                📅 Datas e Documentos
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Data de Emissão:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatarData(modais.contaSelecionada.dt_emissao)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Data de Vencimento:</span>
                  <span className={`text-sm font-medium ${
                    modais.contaSelecionada.dt_venc && new Date(modais.contaSelecionada.dt_venc) < new Date() && modais.contaSelecionada.status === 'pendente'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {formatarData(modais.contaSelecionada.dt_venc)}
                    {modais.contaSelecionada.dt_venc && new Date(modais.contaSelecionada.dt_venc) < new Date() && modais.contaSelecionada.status === 'pendente' && (
                      <span className="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                        VENCIDO
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Data de Recebimento:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.dt_pgto ? formatarData(modais.contaSelecionada.dt_pgto) : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Número do Documento:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.nro_doc || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Fatura:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.cod_fat ? `#${modais.contaSelecionada.cod_fat}` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna 2: Financeiro e Operacional */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                💰 Financeiro e Operacional
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tipo:</span>
                  <Badge variant="outline" className="text-xs">
                    {modais.contaSelecionada.tipo === 'R' ? 'Recebimento' : 'Devolução'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Forma de Faturamento:</span>
                  <Badge variant="outline" className="text-xs">
                    {modais.contaSelecionada.forma_fat === 'B' ? 'Boleto' :
                     modais.contaSelecionada.forma_fat === 'C' ? 'Carteira' :
                     modais.contaSelecionada.forma_fat === 'D' ? 'Depósito' :
                     modais.contaSelecionada.forma_fat === 'P' ? 'PIX' : modais.contaSelecionada.forma_fat || '-'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Banco:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.banco ? `${modais.contaSelecionada.banco} - ${modais.contaSelecionada.nro_banco || ''}` : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Conta Financeira:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.descricao_conta || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Vendedor:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.codvend ? `${modais.contaSelecionada.codvend} - ${modais.contaSelecionada.nome_vendedor || ''}` : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Operadora:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {modais.contaSelecionada.codopera ? `${modais.contaSelecionada.codopera} - ${modais.contaSelecionada.nome_operadora || ''}` : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          {modais.contaSelecionada.obs && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border">
              <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">
                📝 Observações
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {modais.contaSelecionada.obs}
              </p>
            </div>
          )}

          {/* Histórico de Recebimentos (se houver) */}
          {modais.contaSelecionada.status === 'recebido_parcial' && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <h4 className="text-md font-semibold text-orange-900 dark:text-orange-100 mb-2 flex items-center gap-2">
                <History className="w-4 h-4" />
                Status: Recebido Parcial
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Esta conta já teve recebimentos parciais. O valor restante a receber é de{' '}
                <strong>
                  {formatarMoeda(modais.contaSelecionada.valor_original - (modais.contaSelecionada.valor_recebido || 0))}
                </strong>.
              </p>
            </div>
          )}

          {/* Botão Fechar */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => modais.setModalDetalhesAberto(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}