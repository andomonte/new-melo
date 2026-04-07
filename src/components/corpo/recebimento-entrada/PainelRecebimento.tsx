/**
 * Painel principal do modulo de Recebimento de Entradas
 *
 * Exibe recebimento ativo, historico e permite iniciar novos recebimentos
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Recebedor,
  EntradaParaReceber,
  RecebimentoFinalizado,
  getEntradasParaReceber,
  finalizarRecebimento,
  getRecebimentosFinalizados,
} from '@/data/recebimento-entrada/recebimentoEntradaService';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut,
  RefreshCw,
  Plus,
  Key,
  Package,
  Clock,
} from 'lucide-react';
import ModalAlterarCodigo from '@/components/common/ModalAlterarCodigo';
import ModalConferirItens from './ModalConferirItens';
import ModalIniciarRecebimento from './ModalIniciarRecebimento';
import RecebimentosFinalizadosList from './RecebimentosFinalizadosList';
import CardEntrada from './CardEntrada';
import ClientOnly from '@/components/common/ClientOnly';

interface PainelRecebimentoProps {
  recebedor: Recebedor;
  onLogout: () => void;
}

const PainelRecebimento: React.FC<PainelRecebimentoProps> = ({
  recebedor,
  onLogout,
}) => {
  // Estados
  const [entradaAtiva, setEntradaAtiva] = useState<EntradaParaReceber | null>(null);
  const [recebimentosFinalizados, setRecebimentosFinalizados] = useState<RecebimentoFinalizado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFinalizados, setIsLoadingFinalizados] = useState(false);
  const [isAlterarCodigoOpen, setIsAlterarCodigoOpen] = useState(false);
  const [isModalItensOpen, setIsModalItensOpen] = useState(false);
  const [isModalIniciarOpen, setIsModalIniciarOpen] = useState(false);
  const [entradaSelecionada, setEntradaSelecionada] = useState<EntradaParaReceber | null>(null);
  const [recebimentosAtivos, setRecebimentosAtivos] = useState(0);

  const { dismiss, toast } = useToast();

  // Carregar entrada ativa do recebedor
  const loadEntradas = useCallback(async () => {
    setIsLoading(true);
    try {
      // Buscar entradas do recebedor atual
      const entradas = await getEntradasParaReceber(recebedor.nome);

      // Buscar apenas entrada ativa (EM_RECEBIMENTO)
      const ativa = entradas.find(e => e.status === 'EM_RECEBIMENTO');

      setEntradaAtiva(ativa || null);
      setRecebimentosAtivos(ativa ? 1 : 0);
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
      toast({
        title: 'Erro ao carregar entradas',
        description: 'Nao foi possivel obter os dados. Verifique sua conexao.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [recebedor.nome, toast]);

  // Carregar recebimentos finalizados
  const loadRecebimentosFinalizados = useCallback(async () => {
    setIsLoadingFinalizados(true);
    try {
      const finalizados = await getRecebimentosFinalizados(recebedor.matricula, 10);
      setRecebimentosFinalizados(finalizados);
    } catch (error) {
      console.error('Erro ao carregar recebimentos finalizados:', error);
      setRecebimentosFinalizados([]);
    } finally {
      setIsLoadingFinalizados(false);
    }
  }, [recebedor.matricula]);

  // Abrir modal para iniciar novo recebimento
  const handleOpenModalIniciar = useCallback(() => {
    // Verificar se já tem recebimento ativo
    if (recebimentosAtivos >= 1) {
      toast({
        title: 'Limite atingido',
        description: 'Voce ja possui um recebimento em andamento. Finalize-o primeiro.',
        variant: 'destructive',
      });
      return;
    }

    setIsModalIniciarOpen(true);
  }, [recebimentosAtivos, toast]);

  // Callback quando o recebimento for iniciado com sucesso
  const handleRecebimentoIniciado = useCallback(async (entrada: EntradaParaReceber) => {
    // Recarregar dados
    await loadEntradas();
  }, [loadEntradas]);

  // Abrir modal de conferência de itens
  const handleAbrirConferencia = useCallback((entrada: EntradaParaReceber) => {
    setEntradaSelecionada(entrada);
    setIsModalItensOpen(true);
  }, []);

  // Finalizar recebimento
  const handleFinalizarRecebimento = useCallback(async (
    entrada: EntradaParaReceber,
    observacao?: string,
  ) => {
    try {
      await finalizarRecebimento({
        entradaId: entrada.entrada_id,
        matricula: recebedor.matricula,
        observacao,
      });

      toast({
        title: 'Recebimento finalizado',
        description: `Entrada ${entrada.numero_entrada} finalizada com sucesso.`,
        variant: 'default',
      });

      setIsModalItensOpen(false);
      setEntradaSelecionada(null);

      // Recarregar dados
      await loadEntradas();
      await loadRecebimentosFinalizados();
    } catch (error: any) {
      console.error('Erro ao finalizar recebimento:', error);
      toast({
        title: 'Erro ao finalizar recebimento',
        description: error?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [recebedor.matricula, toast, loadEntradas, loadRecebimentosFinalizados]);

  // Carregar dados ao montar (apenas uma vez)
  useEffect(() => {
    loadEntradas();
    loadRecebimentosFinalizados();
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="w-full flex flex-col bg-gray-50 dark:bg-zinc-900 min-h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 shadow-sm border-b border-gray-200 dark:border-zinc-700 px-2 sm:px-4 py-2 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
          {/* Info do usuario */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Recebimento de Entradas
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="truncate">
                <span className="font-medium">{recebedor.nome}</span>
                <span className="hidden sm:inline"> | Mat: {recebedor.matricula}</span>
                <span className="sm:hidden block text-xs">Mat: {recebedor.matricula}</span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    recebimentosAtivos > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {recebimentosAtivos === 0
                    ? 'Nenhum ativo'
                    : '1 em andamento'}
                </span>
              </div>
            </div>
          </div>

          {/* Botoes */}
          <div className="flex flex-wrap gap-1 sm:gap-2 lg:gap-3 justify-end">
            {/* Botao Adicionar - Principal */}
            <DefaultButton
              text={recebimentosAtivos >= 1 ? 'Finalizar' : 'Adicionar'}
              size="sm"
              variant={recebimentosAtivos >= 1 ? 'secondary' : 'primary'}
              onClick={handleOpenModalIniciar}
              icon={<Plus className="w-3 h-3 sm:w-4 sm:h-4" />}
              disabled={recebimentosAtivos >= 1}
              title={
                recebimentosAtivos >= 1
                  ? 'Voce ja possui um recebimento ativo. Finalize-o primeiro.'
                  : 'Adicionar novo recebimento'
              }
            />

            {/* Botao Alterar Codigo */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="secondary"
                onClick={() => setIsAlterarCodigoOpen(true)}
                icon={<Key className="w-4 h-4" />}
                title="Alterar Codigo"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Alterar Codigo"
                size="sm"
                variant="secondary"
                onClick={() => setIsAlterarCodigoOpen(true)}
                icon={<Key className="w-4 h-4" />}
              />
            </div>

            {/* Botao Atualizar */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="secondary"
                onClick={loadEntradas}
                icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                disabled={isLoading}
                title="Atualizar"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Atualizar"
                size="sm"
                variant="secondary"
                onClick={loadEntradas}
                icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                disabled={isLoading}
              />
            </div>

            {/* Botao Sair */}
            <div className="block sm:hidden">
              <DefaultButton
                text=""
                size="sm"
                variant="destructive"
                onClick={onLogout}
                icon={<LogOut className="w-4 h-4" />}
                title="Sair"
              />
            </div>
            <div className="hidden sm:block">
              <DefaultButton
                text="Sair"
                size="sm"
                variant="destructive"
                onClick={onLogout}
                icon={<LogOut className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conteudo principal */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2">
          <div className="max-w-7xl mx-auto space-y-4">

            {/* Recebimento Ativo */}
            {entradaAtiva && (
              <div className="space-y-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Recebimento em Andamento
                </h2>
                <CardEntrada
                  entrada={entradaAtiva}
                  isAtiva={true}
                  onConferir={() => handleAbrirConferencia(entradaAtiva)}
                  formatCurrency={formatCurrency}
                />
              </div>
            )}

            {/* Estado vazio - Iniciar novo recebimento */}
            {!entradaAtiva && !isLoading && (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhum recebimento em andamento
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  Clique no botao abaixo para iniciar um novo recebimento escaneando ou digitando a chave da NFe.
                </p>
                <DefaultButton
                  text="Iniciar Novo Recebimento"
                  variant="primary"
                  onClick={handleOpenModalIniciar}
                  icon={<Plus className="w-4 h-4" />}
                />
              </div>
            )}

            {/* Loading state */}
            {isLoading && !entradaAtiva && (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  ))}
                </div>
              </div>
            )}

            {/* Recebimentos Finalizados */}
            <ClientOnly
              fallback={
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      ))}
                    </div>
                  </div>
                </div>
              }
            >
              <RecebimentosFinalizadosList
                recebimentos={recebimentosFinalizados}
                isLoading={isLoadingFinalizados}
                onRefresh={loadRecebimentosFinalizados}
                formatCurrency={formatCurrency}
              />
            </ClientOnly>
          </div>
        </div>
      </div>

      {/* Modal Alterar Codigo */}
      <ModalAlterarCodigo
        isOpen={isAlterarCodigoOpen}
        onClose={() => setIsAlterarCodigoOpen(false)}
        matricula={recebedor.matricula}
        nome={recebedor.nome}
      />

      {/* Modal Conferir Itens */}
      {isModalItensOpen && entradaSelecionada && (
        <ModalConferirItens
          isOpen={isModalItensOpen}
          onClose={() => {
            setIsModalItensOpen(false);
            setEntradaSelecionada(null);
          }}
          entrada={entradaSelecionada}
          matricula={recebedor.matricula}
          onFinalizar={(observacao) =>
            handleFinalizarRecebimento(entradaSelecionada, observacao)
          }
        />
      )}

      {/* Modal Iniciar Recebimento */}
      <ModalIniciarRecebimento
        isOpen={isModalIniciarOpen}
        onClose={() => setIsModalIniciarOpen(false)}
        recebedor={recebedor}
        onSuccess={handleRecebimentoIniciado}
      />
    </div>
  );
};

export default PainelRecebimento;
