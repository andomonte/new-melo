/**
 * Painel principal de Alocacao
 * Exibe entradas disponiveis para alocar e historico
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, RefreshCw, Warehouse, Package, Search, X } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import CardEntradaAlocacao from './CardEntradaAlocacao';
import ModalAlocarItens from './ModalAlocarItens';
import AlocacoesFinalizadasList from './AlocacoesFinalizadasList';
import {
  Alocador,
  EntradaParaAlocar,
  AlocacaoFinalizada,
  getEntradasParaAlocar,
  getAlocacoesFinalizadas,
  iniciarAlocacao,
  getArmazens,
  Armazem,
} from '@/data/alocacao/alocacaoService';

interface PainelAlocacaoProps {
  alocador: Alocador;
  onLogout: () => void;
}

const PainelAlocacao: React.FC<PainelAlocacaoProps> = ({ alocador, onLogout }) => {
  const [entradas, setEntradas] = useState<EntradaParaAlocar[]>([]);
  const [finalizados, setFinalizados] = useState<AlocacaoFinalizada[]>([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFinalizados, setIsLoadingFinalizados] = useState(true);
  const [entradaAtiva, setEntradaAtiva] = useState<EntradaParaAlocar | null>(null);
  const [showModal, setShowModal] = useState(false);
  // busca por NF, chave, fornecedor, CNPJ ou entrada (no servidor)
  const [busca, setBusca] = useState('');
  const [buscaDeb, setBuscaDeb] = useState('');
  const [erroIniciar, setErroIniciar] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  // Formatar moeda
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  // Carregar entradas disponiveis
  const loadEntradas = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getEntradasParaAlocar(alocador.nome, buscaDeb);
      setEntradas(data);

      // Verificar se tem alocacao ativa
      const ativa = data.find(e => e.status === 'EM_ALOCACAO' && e.alocador_nome === alocador.nome);
      if (ativa) {
        setEntradaAtiva(ativa);
      }
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [alocador.nome, buscaDeb]);

  // Carregar finalizados
  const loadFinalizados = useCallback(async () => {
    setIsLoadingFinalizados(true);
    try {
      const data = await getAlocacoesFinalizadas(alocador.matricula);
      setFinalizados(data);
    } catch (error) {
      console.error('Erro ao carregar finalizados:', error);
    } finally {
      setIsLoadingFinalizados(false);
    }
  }, [alocador.matricula]);

  // Carregar armazens
  const loadArmazens = useCallback(async () => {
    try {
      const data = await getArmazens();
      setArmazens(data);
    } catch (error) {
      console.error('Erro ao carregar armazens:', error);
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadEntradas();
    loadFinalizados();
    loadArmazens();
  }, [loadEntradas, loadFinalizados, loadArmazens]);

  // Iniciar alocacao
  const handleIniciar = useCallback(
    async (entrada: EntradaParaAlocar, armId: number) => {
      setErroIniciar('');
      try {
        await iniciarAlocacao({
          entradaId: entrada.entrada_id,
          matriculaAlocador: alocador.matricula,
          nomeAlocador: alocador.nome,
          armId,
        });
        setEntradaAtiva(entrada);
        await loadEntradas();
      } catch (error: any) {
        console.error('Erro ao iniciar alocacao:', error);
        // mostra o motivo real (ex.: preço não confirmado)
        setErroIniciar(error?.response?.data?.error || 'Erro ao iniciar a alocação. Tente novamente.');
      }
    },
    [alocador, loadEntradas],
  );

  // Abrir modal de conferencia
  const handleAlocar = useCallback(() => {
    setShowModal(true);
  }, []);

  // Fechar modal
  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Alocacao finalizada
  const handleAlocacaoFinalizada = useCallback(() => {
    setShowModal(false);
    setEntradaAtiva(null);
    loadEntradas();
    loadFinalizados();
  }, [loadEntradas, loadFinalizados]);

  // Refresh
  const handleRefresh = useCallback(() => {
    loadEntradas();
  }, [loadEntradas]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Warehouse className="w-6 h-6 text-amber-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Alocacao
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{alocador.nome}</p>
              </div>
            </div>
            <DefaultButton
              text="Sair"
              size="sm"
              variant="secondary"
              onClick={onLogout}
              icon={<LogOut className="w-4 h-4" />}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entradas disponiveis */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                Entradas para Alocar
                <span className="text-xs font-normal text-gray-500">
                  ({entradas.length}{entradas.length === 100 ? '+' : ''})
                </span>
              </h2>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {/* busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nº da nota, chave, fornecedor, CNPJ ou entrada"
                className="w-full pl-9 pr-9 py-2 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {erroIniciar && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2">
                <span className="flex-1">{erroIniciar}</span>
                <button onClick={() => setErroIniciar('')} aria-label="Fechar aviso">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-6 animate-pulse"
                  >
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : entradas.length === 0 ? (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  {buscaDeb ? 'Nenhuma entrada encontrada para esta busca' : 'Nenhuma entrada disponivel para alocacao'}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  As entradas aparecerao aqui apos serem recebidas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {entradas.map(entrada => (
                  <CardEntradaAlocacao
                    key={entrada.id || entrada.entrada_id}
                    entrada={entrada}
                    isAtiva={
                      entradaAtiva?.entrada_id === entrada.entrada_id ||
                      (entrada.status === 'EM_ALOCACAO' && entrada.alocador_nome === alocador.nome)
                    }
                    onIniciar={armId => handleIniciar(entrada, armId)}
                    onAlocar={handleAlocar}
                    formatCurrency={formatCurrency}
                    disabled={
                      (entradaAtiva !== null && entradaAtiva.entrada_id !== entrada.entrada_id) ||
                      // alocação libera para venda: sem preço confirmado não inicia
                      (entrada.preco_confirmado === false && entrada.status !== 'EM_ALOCACAO')
                    }
                    armazens={armazens}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Historico */}
          <div className="lg:col-span-1">
            <AlocacoesFinalizadasList
              alocacoes={finalizados}
              isLoading={isLoadingFinalizados}
              onRefresh={loadFinalizados}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </main>

      {/* Modal de alocacao */}
      {showModal && entradaAtiva && (
        <ModalAlocarItens
          entrada={entradaAtiva}
          alocador={alocador}
          onClose={handleCloseModal}
          onFinish={handleAlocacaoFinalizada}
          formatCurrency={formatCurrency}
          armazens={armazens}
        />
      )}
    </div>
  );
};

export default PainelAlocacao;
