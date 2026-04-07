/**
 * Modal para conferencia item a item no recebimento
 *
 * Permite ao recebedor:
 * - Informar quantidade recebida e status de cada item
 * - Alocar itens em armazens (romaneio)
 * - Itens vem como OK por padrao
 */

import React from 'react';
import {
  X,
  Package,
  CheckCircle,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { useConferirItens } from './hooks/useConferirItens';
import { ItemCard, ResumoSection, AlocarSection } from './components';
import { ModalConferirItensProps } from './constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ModalConferirItens: React.FC<ModalConferirItensProps> = ({
  isOpen,
  onClose,
  entrada,
  matricula,
  onFinalizar,
}) => {
  const {
    // Estados
    itens,
    isLoading,
    observacaoGeral,
    setObservacaoGeral,
    isSalvandoTodos,
    isFinalizando,
    armazens,
    armazemSelecionado,
    loadingArmazens,
    resumo,
    podeFinalizarRecebimento,

    // Estados de dialogs
    showDialogFechar,
    setShowDialogFechar,

    // Handlers
    handleQtdChange,
    handleStatusChange,
    handleObservacaoChange,
    handleArmazemChange,
    handleSelecionarArmazem,
    handleSalvarItem,
    handleSalvarTodos,
    handleMarcarTodosOK,
    handleFinalizar,
    handleClose,
    getArmazemNome,
    confirmarFechar,

    // Utils
    temItensModificados,
    contarModificados,
  } = useConferirItens({
    isOpen,
    entrada,
    matricula,
    onFinalizar,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-2">
      {/* Modal com largura maxima */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-500" />
              Conferir Itens - {entrada.numero_entrada}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {entrada.fornecedor} | NFe {entrada.nfe_numero}/{entrada.nfe_serie}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resumo */}
        <ResumoSection resumo={resumo} />

        {/* Secao de Alocacao/Romaneio - ao selecionar ja aplica para todos */}
        <AlocarSection
          armazens={armazens}
          armazemSelecionado={armazemSelecionado}
          onArmazemChange={handleSelecionarArmazem}
          loading={loadingArmazens}
        />

        {/* Acoes rapidas */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-700 flex flex-wrap gap-2">
          <DefaultButton
            text="Marcar Todos OK"
            size="sm"
            variant="secondary"
            onClick={handleMarcarTodosOK}
            icon={<CheckCircle className="w-3 h-3" />}
          />
          <DefaultButton
            text={`Salvar Alteracoes ${temItensModificados() ? `(${contarModificados()})` : ''}`}
            size="sm"
            variant="primary"
            onClick={handleSalvarTodos}
            icon={
              isSalvandoTodos ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )
            }
            disabled={isSalvandoTodos || !temItensModificados()}
          />
        </div>

        {/* Area scrollavel: observacao + lista de itens */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Observacao geral */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observacao Geral do Recebimento (opcional)
            </label>
            <textarea
              value={observacaoGeral}
              onChange={(e) => setObservacaoGeral(e.target.value)}
              placeholder="Observacoes sobre o recebimento..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-700 dark:text-white"
              rows={2}
            />
          </div>

          {/* Lista de itens */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Carregando itens...
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {itens.map((item, index) => (
                <ItemCard
                  key={item.id || item.entrada_item_id}
                  item={item}
                  index={index}
                  armazens={armazens}
                  onQtdChange={handleQtdChange}
                  onStatusChange={handleStatusChange}
                  onObservacaoChange={handleObservacaoChange}
                  onArmazemChange={handleArmazemChange}
                  onSalvarItem={handleSalvarItem}
                  getArmazemNome={getArmazemNome}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer - apenas botoes */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
          <div className="flex justify-between">
            <DefaultButton
              text="Fechar"
              size="sm"
              variant="secondary"
              onClick={handleClose}
            />
            <DefaultButton
              text={isFinalizando ? 'Finalizando...' : 'Finalizar Recebimento'}
              size="sm"
              variant="primary"
              onClick={handleFinalizar}
              className="bg-emerald-600 hover:bg-emerald-700"
              icon={
                isFinalizando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )
              }
              disabled={isFinalizando || resumo.pendente > 0}
              title={
                resumo.pendente > 0
                  ? 'Confira todos os itens primeiro'
                  : 'Finalizar recebimento'
              }
            />
          </div>
        </div>
      </div>

      {/* Dialog de confirmacao - Fechar com alteracoes nao salvas */}
      <Dialog open={showDialogFechar} onOpenChange={setShowDialogFechar}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alteracoes nao salvas
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Ha alteracoes que ainda nao foram salvas. Deseja realmente fechar e perder as alteracoes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDialogFechar(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarFechar}
            >
              Fechar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ModalConferirItens;
