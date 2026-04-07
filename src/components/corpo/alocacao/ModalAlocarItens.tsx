/**
 * Modal para alocar itens de uma entrada
 * UI dinamica: permite distribuir 1 produto em multiplos armazens
 * Romaneio planejado eh apenas SUGESTAO (pre-preenchido, editavel)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Package,
  CheckCircle,
  Loader2,
  Warehouse,
  Check,
  AlertTriangle,
  ClipboardList,
  MapPin,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import {
  EntradaParaAlocar,
  Alocador,
  ItemEntradaAlocacao,
  Armazem,
  AlocacaoDistribuicao,
  getItensEntradaAlocacao,
  alocarItemMultiplo,
  finalizarAlocacao,
} from '@/data/alocacao/alocacaoService';

interface ModalAlocarItensProps {
  entrada: EntradaParaAlocar;
  alocador: Alocador;
  onClose: () => void;
  onFinish: () => void;
  formatCurrency: (value: number) => string;
  armazens: Armazem[];
}

// Estado interno de distribuicao por item
interface ItemDistribuicao {
  entrada_item_id: number;
  produto_cod: string;
  alocacoes: AlocacaoDistribuicao[];
}

const ModalAlocarItens: React.FC<ModalAlocarItensProps> = ({
  entrada,
  alocador,
  onClose,
  onFinish,
  armazens,
}) => {
  const [itens, setItens] = useState<ItemEntradaAlocacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemEntradaAlocacao | null>(null);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true); // Controla auto-selecao apenas na primeira carga

  // Estado da distribuicao do item selecionado
  const [distribuicao, setDistribuicao] = useState<AlocacaoDistribuicao[]>([]);

  // Carregar itens
  const loadItens = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getItensEntradaAlocacao(entrada.entrada_id);
      setItens(data);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [entrada.entrada_id]);

  useEffect(() => {
    loadItens();
  }, [loadItens]);

  // Auto-selecionar primeiro item apenas na primeira carga
  useEffect(() => {
    if (itens.length > 0 && isFirstLoad) {
      handleSelectItem(itens[0]);
      setIsFirstLoad(false);
    }
  }, [itens, isFirstLoad]);

  // Selecionar item para alocar - pre-preenche com romaneio (SUGESTAO)
  // NOTA: Permite realocar itens já alocados (redistribuição)
  const handleSelectItem = (item: ItemEntradaAlocacao) => {
    // Toggle: desseleciona se já selecionado
    if (selectedItem?.entrada_item_id === item.entrada_item_id) {
      setSelectedItem(null);
      setDistribuicao([]);
      return;
    }
    setSelectedItem(item);

    // Sempre usar quantidade total recebida
    // Porque o backend faz DELETE + INSERT (redistribuicao completa)
    const qtdParaAlocar = item.qtd_recebida;

    // Pre-preencher com romaneio planejado como SUGESTAO
    if (item.romaneio_planejado && item.romaneio_planejado.length > 0) {
      // Calcular soma do romaneio
      const somaRomaneio = item.romaneio_planejado.reduce((acc, r) => acc + r.qtd, 0);

      // Usar distribuicao do romaneio como sugestao inicial
      let distribuicaoInicial = item.romaneio_planejado.map(r => ({
        arm_id: r.arm_id,
        qtd: r.qtd,
        localizacao: r.localizacao_existente || '',
      }));

      // Se romaneio tem menos que qtdParaAlocar, ajustar primeiro armazem
      if (somaRomaneio < qtdParaAlocar && distribuicaoInicial.length > 0) {
        const diferenca = qtdParaAlocar - somaRomaneio;
        distribuicaoInicial[0].qtd += diferenca;
      }
      // Se romaneio excede qtdParaAlocar, limitar proporcionalmente
      else if (somaRomaneio > qtdParaAlocar) {
        const fator = qtdParaAlocar / somaRomaneio;
        distribuicaoInicial = distribuicaoInicial.map(d => ({
          ...d,
          qtd: Math.round(d.qtd * fator),
        }));
      }

      // Se tem mais de 1 armazem no romaneio, ativar modo avancado
      if (distribuicaoInicial.length > 1) {
        setModoAvancado(true);
      }

      setDistribuicao(distribuicaoInicial);
    } else {
      // Sem romaneio: usar primeiro armazem disponivel
      setDistribuicao([{
        arm_id: armazens[0]?.arm_id || 0,
        qtd: qtdParaAlocar,
        localizacao: '',
      }]);
    }
  };

  // Atualizar distribuicao para um armazem especifico
  const handleDistChange = (armId: number, field: 'qtd' | 'localizacao', value: string | number) => {
    setDistribuicao(prev => {
      const idx = prev.findIndex(d => d.arm_id === armId);

      if (field === 'qtd') {
        const qtd = typeof value === 'number' ? value : parseFloat(value) || 0;

        if (qtd <= 0) {
          // Remover se quantidade for 0
          if (idx >= 0) {
            const newDist = [...prev];
            newDist.splice(idx, 1);
            return newDist;
          }
          return prev;
        }

        if (idx >= 0) {
          const newDist = [...prev];
          newDist[idx] = { ...newDist[idx], qtd };
          return newDist;
        } else {
          return [...prev, { arm_id: armId, qtd, localizacao: '' }];
        }
      } else {
        // Campo localizacao
        const localizacao = String(value);
        if (idx >= 0) {
          const newDist = [...prev];
          newDist[idx] = { ...newDist[idx], localizacao };
          return newDist;
        }
        return prev;
      }
    });
  };

  // Alocar toda quantidade em um armazem
  const handleAlocarTudoEm = (armId: number) => {
    if (!selectedItem) return;
    // Sempre usar quantidade total (backend faz DELETE + INSERT)
    const qtdParaAlocar = selectedItem.qtd_recebida;

    // Buscar localizacao existente do romaneio
    const romaneioArm = selectedItem.romaneio_planejado?.find(r => r.arm_id === armId);
    const locExistente = romaneioArm?.localizacao_existente || '';

    setDistribuicao([{
      arm_id: armId,
      qtd: qtdParaAlocar,
      localizacao: locExistente,
    }]);
  };

  // Limpar distribuicao
  const handleLimparDistribuicao = () => {
    setDistribuicao([]);
  };

  // Calcular soma da distribuicao
  const somaDistribuicao = distribuicao.reduce((acc, d) => acc + d.qtd, 0);
  const qtdRecebida = selectedItem?.qtd_recebida || 0;

  // Sempre validar contra quantidade total recebida
  // Porque o backend faz DELETE + INSERT (redistribuicao completa)
  const qtdEsperada = qtdRecebida;

  // Status da distribuicao
  const getDistStatus = () => {
    if (somaDistribuicao === 0) return { status: 'pendente', msg: 'Nenhuma distribuicao' };
    if (somaDistribuicao < qtdEsperada) return { status: 'parcial', msg: `Faltam ${qtdEsperada - somaDistribuicao}` };
    if (somaDistribuicao > qtdEsperada) return { status: 'excesso', msg: `Excesso de ${somaDistribuicao - qtdEsperada}` };
    return { status: 'ok', msg: 'OK' };
  };

  const distStatus = getDistStatus();

  // Confirmar alocacao do item
  const handleConfirmItem = async () => {
    if (!selectedItem) return;

    // Validar
    if (distStatus.status !== 'ok') {
      alert(`Distribuicao invalida: ${distStatus.msg}`);
      return;
    }

    // Filtrar alocacoes com quantidade > 0
    const alocacoesValidas = distribuicao.filter(d => d.qtd > 0);
    if (alocacoesValidas.length === 0) {
      alert('Informe pelo menos uma alocacao');
      return;
    }

    setIsSaving(true);
    try {
      await alocarItemMultiplo({
        entradaItemId: selectedItem.entrada_item_id,
        alocacoes: alocacoesValidas,
        matricula: alocador.matricula,
      });

      // Atualizar lista
      await loadItens();
      setSelectedItem(null);
      setDistribuicao([]);
    } catch (error) {
      console.error('Erro ao alocar item:', error);
      alert('Erro ao alocar item. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Alocar todos os itens pendentes (usa romaneio como sugestao)
  const handleAlocarTodos = async () => {
    if (!armazens[0]) {
      alert('Nenhum armazem disponivel');
      return;
    }

    const pendentes = itens.filter(i => i.status_alocacao !== 'ALOCADO');
    if (pendentes.length === 0) return;

    setIsSaving(true);
    try {
      for (const item of pendentes) {
        const qtdTotal = item.qtd_recebida;
        if (qtdTotal > 0) {
          // Usar distribuicao do romaneio se existir
          let alocacoes: AlocacaoDistribuicao[];

          if (item.romaneio_planejado && item.romaneio_planejado.length > 0) {
            const somaRomaneio = item.romaneio_planejado.reduce((acc, r) => acc + r.qtd, 0);
            alocacoes = item.romaneio_planejado.map(r => ({
              arm_id: r.arm_id,
              qtd: r.qtd,
              localizacao: r.localizacao_existente || '',
            }));
            // Ajustar se romaneio nao bate com qtd_recebida
            if (somaRomaneio < qtdTotal && alocacoes.length > 0) {
              alocacoes[0].qtd += (qtdTotal - somaRomaneio);
            }
          } else {
            alocacoes = [{
              arm_id: armazens[0].arm_id,
              qtd: qtdTotal,
              localizacao: '',
            }];
          }

          await alocarItemMultiplo({
            entradaItemId: item.entrada_item_id,
            alocacoes,
            matricula: alocador.matricula,
          });
        }
      }
      await loadItens();
    } catch (error) {
      console.error('Erro ao alocar itens:', error);
      alert('Erro ao alocar alguns itens. Verifique a lista.');
    } finally {
      setIsSaving(false);
    }
  };

  // Finalizar alocacao
  const handleFinalizar = async () => {
    const pendentes = itens.filter(i => i.status_alocacao !== 'ALOCADO');
    if (pendentes.length > 0) {
      const confirmar = window.confirm(
        `Ainda existem ${pendentes.length} item(ns) nao alocados. Deseja finalizar mesmo assim?`,
      );
      if (!confirmar) return;
    }

    setIsFinishing(true);
    try {
      await finalizarAlocacao({
        entradaId: entrada.entrada_id,
        matricula: alocador.matricula,
      });
      onFinish();
    } catch (error) {
      console.error('Erro ao finalizar alocacao:', error);
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        alert(axiosError.response?.data?.error || 'Erro ao finalizar alocacao');
      } else {
        alert('Erro ao finalizar alocacao. Tente novamente.');
      }
    } finally {
      setIsFinishing(false);
    }
  };

  // Estatisticas
  const alocados = itens.filter(i => i.status_alocacao === 'ALOCADO').length;
  const pendentes = itens.length - alocados;
  const progresso = itens.length > 0 ? Math.round((alocados / itens.length) * 100) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ALOCADO':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'PARCIAL':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <Warehouse className="w-6 h-6 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Alocar Itens - {entrada.numero_entrada}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{entrada.fornecedor}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progresso: {alocados} de {itens.length} itens alocados
            </span>
            <span className="text-sm font-bold text-amber-600">{progresso}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {itens.map((item, index) => (
                <div
                  key={`${item.entrada_item_id}-${index}`}
                  onClick={() => handleSelectItem(item)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedItem?.entrada_item_id === item.entrada_item_id
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : item.status_alocacao === 'ALOCADO'
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 cursor-default'
                        : 'border-gray-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.produto_cod}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(item.status_alocacao)}`}>
                          {item.status_alocacao === 'ALOCADO' ? 'Alocado' : item.status_alocacao === 'PARCIAL' ? 'Parcial' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                        {item.produto_nome}
                      </p>
                      {/* Romaneio Planejado (SUGESTAO) */}
                      {item.romaneio_planejado && item.romaneio_planejado.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            Sugestao:{' '}
                            {item.romaneio_planejado.map((r, idx) => (
                              <span key={r.arm_id}>
                                {idx > 0 && ', '}
                                <strong>{r.arm_descricao}</strong>: {r.qtd}
                                {r.localizacao_existente && (
                                  <span className="text-purple-600"> ({r.localizacao_existente})</span>
                                )}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Recebido</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {item.qtd_recebida} {item.unidade}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Alocado</p>
                        <p className={`font-semibold ${item.qtd_alocada >= item.qtd_recebida ? 'text-green-600' : 'text-amber-600'}`}>
                          {item.qtd_alocada || 0} {item.unidade}
                        </p>
                      </div>
                      {item.status_alocacao === 'ALOCADO' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>

                  {/* Formulario de alocacao dinamica - permite redistribuicao de itens ja alocados */}
                  {selectedItem?.entrada_item_id === item.entrada_item_id && (
                    <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                      {/* Toggle modo avancado */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModoAvancado(!modoAvancado);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            modoAvancado
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300'
                              : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600'
                          }`}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {modoAvancado ? 'Multiplos armazens' : 'Armazem unico'}
                        </button>

                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            distStatus.status === 'ok'
                              ? 'text-green-600'
                              : distStatus.status === 'excesso'
                                ? 'text-red-600'
                                : 'text-amber-600'
                          }`}>
                            {somaDistribuicao} / {qtdEsperada}
                          </span>
                          {distribuicao.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLimparDistribuicao();
                              }}
                              className="p-1 text-gray-400 hover:text-red-500"
                              title="Limpar"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Modo simples: select unico */}
                      {!modoAvancado && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Armazem
                            </label>
                            <select
                              value={distribuicao[0]?.arm_id || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const armId = parseInt(e.target.value);
                                const romaneioArm = item.romaneio_planejado?.find(r => r.arm_id === armId);
                                setDistribuicao([{
                                  arm_id: armId,
                                  qtd: qtdEsperada,
                                  localizacao: romaneioArm?.localizacao_existente || distribuicao[0]?.localizacao || '',
                                }]);
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                            >
                              {armazens.map(arm => (
                                <option key={arm.arm_id} value={arm.arm_id}>
                                  {arm.arm_descricao}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              <MapPin className="inline h-3.5 w-3.5 mr-1" />
                              Localizacao
                            </label>
                            <input
                              type="text"
                              value={distribuicao[0]?.localizacao || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setDistribuicao([{
                                  ...distribuicao[0],
                                  localizacao: e.target.value,
                                }]);
                              }}
                              placeholder="Ex: P1/35 D 1"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="flex items-end" onClick={(e) => e.stopPropagation()}>
                            <DefaultButton
                              text={isSaving ? 'Salvando...' : 'Confirmar'}
                              size="sm"
                              variant="primary"
                              onClick={handleConfirmItem}
                              disabled={isSaving || distStatus.status !== 'ok'}
                              className="w-full bg-amber-600 hover:bg-amber-700"
                              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            />
                          </div>
                        </div>
                      )}

                      {/* Modo avancado: grid de armazens */}
                      {modoAvancado && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {armazens.map(arm => {
                              const dist = distribuicao.find(d => d.arm_id === arm.arm_id);
                              const romaneioArm = item.romaneio_planejado?.find(r => r.arm_id === arm.arm_id);

                              return (
                                <div
                                  key={arm.arm_id}
                                  className={`p-3 rounded-lg border transition-all ${
                                    dist && dist.qtd > 0
                                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <button
                                      onClick={() => handleAlocarTudoEm(arm.arm_id)}
                                      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                        dist && dist.qtd > 0
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 hover:bg-blue-100'
                                      }`}
                                    >
                                      <Warehouse className="inline h-3 w-3 mr-1" />
                                      {arm.arm_descricao}
                                    </button>
                                    {romaneioArm && (
                                      <span className="text-xs text-blue-500" title="Sugestao do romaneio">
                                        ({romaneioArm.qtd})
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                                      <input
                                        type="number"
                                        value={dist?.qtd || ''}
                                        onChange={(e) => handleDistChange(arm.arm_id, 'qtd', e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Local</label>
                                      <input
                                        type="text"
                                        value={dist?.localizacao || romaneioArm?.localizacao_existente || ''}
                                        onChange={(e) => handleDistChange(arm.arm_id, 'localizacao', e.target.value)}
                                        placeholder="P1/35"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Botao confirmar no modo avancado */}
                          <div className="flex justify-end">
                            <DefaultButton
                              text={isSaving ? 'Salvando...' : 'Confirmar Distribuicao'}
                              size="sm"
                              variant="primary"
                              onClick={handleConfirmItem}
                              disabled={isSaving || distStatus.status !== 'ok'}
                              className="bg-amber-600 hover:bg-amber-700"
                              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex gap-2">
              {pendentes > 0 && (
                <DefaultButton
                  text={isSaving ? 'Alocando...' : 'Alocar Todos (Romaneio)'}
                  size="sm"
                  variant="secondary"
                  onClick={handleAlocarTodos}
                  disabled={isSaving || isFinishing}
                  icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                />
              )}
            </div>
            <div className="flex gap-2">
              <DefaultButton text="Fechar" size="sm" variant="secondary" onClick={onClose} />
              <DefaultButton
                text={isFinishing ? 'Finalizando...' : selectedItem ? 'Confirme o item primeiro' : 'Finalizar Alocacao'}
                size="sm"
                variant="primary"
                onClick={handleFinalizar}
                disabled={isFinishing || isSaving || !!selectedItem}
                className={selectedItem ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                icon={isFinishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalAlocarItens;
