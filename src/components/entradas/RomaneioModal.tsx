import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Warehouse, Package, Info, Box, Settings2, RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Armazem = {
  arm_id: number;
  arm_descricao: string;
  arm_status: string;
  arm_municipio: string | null;
  arm_uf: string | null;
};

type RomaneioDistribuicao = {
  arm_id: number;
  qtd: number;
};

type ItemEntradaComDistribuicao = {
  produto_cod: string;
  produto_ref: string | null;
  produto_descr: string | null;
  quantidade_total: number;
  multiplo: number;
  distribuicao: RomaneioDistribuicao[];
};

type Props = {
  open: boolean;
  onClose?: () => void;
  entradaId: number;
  numeroEntrada: string;
  obrigatorio?: boolean;
  onSalvoComSucesso?: () => void;
};

export default function RomaneioModal({
  open,
  onClose,
  entradaId,
  numeroEntrada,
  obrigatorio = true,
  onSalvoComSucesso,
}: Props) {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [itens, setItens] = useState<ItemEntradaComDistribuicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState('');
  const [temRomaneioSalvo, setTemRomaneioSalvo] = useState(false);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [armazemSelecionado, setArmazemSelecionado] = useState<number | null>(null);
  const [romaneioSalvoInfo, setRomaneioSalvoInfo] = useState<string>('');

  useEffect(() => {
    if (open) {
      carregarDados();
    }
  }, [open, entradaId]);

  const carregarDados = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Buscar armazens ativos
      const armazensRes = await fetch('/api/armazens/listar');
      if (!armazensRes.ok) throw new Error('Erro ao buscar armazens');
      const armazensData = await armazensRes.json();
      setArmazens(armazensData.armazens);

      // 2. Buscar romaneio da entrada
      const romaneioRes = await fetch(`/api/entradas/${entradaId}/romaneio/buscar`);
      if (!romaneioRes.ok) throw new Error('Erro ao buscar romaneio');
      const romaneioData = await romaneioRes.json();

      setTemRomaneioSalvo(romaneioData.tem_romaneio_salvo);

      // Transformar para formato do estado com distribuicao
      const itensFormatados: ItemEntradaComDistribuicao[] = romaneioData.itens.map((item: any) => ({
        produto_cod: item.produto_cod,
        produto_ref: item.produto_ref,
        produto_descr: item.produto_descr,
        quantidade_total: item.quantidade_total,
        multiplo: item.multiplo,
        distribuicao: item.romaneio && item.romaneio.length > 0
          ? item.romaneio.map((r: any) => ({ arm_id: r.arm_id, qtd: r.qtd }))
          : [],
      }));

      setItens(itensFormatados);

      // Se ja tem romaneio salvo, mostrar info
      if (romaneioData.tem_romaneio_salvo && romaneioData.itens.length > 0) {
        // Verificar se tem distribuicao em multiplos armazens
        const armazensUsados = new Set<number>();
        romaneioData.itens.forEach((item: any) => {
          item.romaneio?.forEach((r: any) => armazensUsados.add(r.arm_id));
        });

        if (armazensUsados.size === 1) {
          const armId = Array.from(armazensUsados)[0];
          const arm = armazensData.armazens.find((a: Armazem) => a.arm_id === armId);
          setRomaneioSalvoInfo(arm?.arm_descricao || `Armazem ${armId}`);
          setArmazemSelecionado(armId);
        } else {
          setRomaneioSalvoInfo(`${armazensUsados.size} armazens`);
          setModoAvancado(true);
        }
      } else {
        // Pre-selecionar GERAL (1001) como padrao
        const armazemPadrao = armazensData.armazens.find((a: Armazem) => a.arm_id === 1001)
          || armazensData.armazens[0];
        if (armazemPadrao) {
          setArmazemSelecionado(armazemPadrao.arm_id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar distribuicao de um item para um armazem
  const handleDistribuicaoChange = (produtoCod: string, armId: number, qtd: number) => {
    setItens(prev => prev.map(item => {
      if (item.produto_cod !== produtoCod) return item;

      const novaDistribuicao = [...item.distribuicao];
      const idx = novaDistribuicao.findIndex(d => d.arm_id === armId);

      if (qtd === 0 || isNaN(qtd)) {
        // Remover se quantidade for 0
        if (idx >= 0) {
          novaDistribuicao.splice(idx, 1);
        }
      } else {
        if (idx >= 0) {
          novaDistribuicao[idx].qtd = qtd;
        } else {
          novaDistribuicao.push({ arm_id: armId, qtd });
        }
      }

      return { ...item, distribuicao: novaDistribuicao };
    }));
  };

  // Colocar toda quantidade de um item em um armazem
  const handleAlocarTudoEm = (produtoCod: string, armId: number) => {
    setItens(prev => prev.map(item => {
      if (item.produto_cod !== produtoCod) return item;
      return {
        ...item,
        distribuicao: [{ arm_id: armId, qtd: item.quantidade_total }],
      };
    }));
  };

  // Limpar distribuicao de um item
  const handleLimparDistribuicao = (produtoCod: string) => {
    setItens(prev => prev.map(item => {
      if (item.produto_cod !== produtoCod) return item;
      return { ...item, distribuicao: [] };
    }));
  };

  // Verificar se a distribuicao de um item esta valida
  const getDistribuicaoStatus = (item: ItemEntradaComDistribuicao) => {
    const soma = item.distribuicao.reduce((acc, d) => acc + d.qtd, 0);
    if (soma === 0) return { status: 'pendente', msg: 'Nenhuma distribuicao' };
    if (soma < item.quantidade_total) return { status: 'parcial', msg: `Faltam ${item.quantidade_total - soma} un` };
    if (soma > item.quantidade_total) return { status: 'excesso', msg: `Excesso de ${soma - item.quantidade_total} un` };
    return { status: 'ok', msg: 'OK' };
  };

  const handleSalvar = async () => {
    setError('');

    // Validar distribuicao
    if (modoAvancado) {
      for (const item of itens) {
        const status = getDistribuicaoStatus(item);
        if (status.status !== 'ok') {
          setError(`Produto ${item.produto_cod}: ${status.msg}`);
          return;
        }
      }
    } else {
      if (!armazemSelecionado) {
        setError('Selecione um armazem de destino');
        return;
      }
    }

    setSalvando(true);

    try {
      const payload = {
        itens: itens.map(item => ({
          produto_cod: item.produto_cod,
          quantidade_total: item.quantidade_total,
          multiplo: item.multiplo,
          romaneio: modoAvancado
            ? item.distribuicao.filter(d => d.qtd > 0)
            : [{ arm_id: armazemSelecionado, qtd: item.quantidade_total }],
        })),
      };

      const response = await fetch(`/api/entradas/${entradaId}/romaneio/salvar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar romaneio');
      }

      setTemRomaneioSalvo(true);
      if (!modoAvancado) {
        setRomaneioSalvoInfo(getArmazemNome(armazemSelecionado));
      } else {
        const armazensUsados = new Set<number>();
        itens.forEach(item => item.distribuicao.forEach(d => armazensUsados.add(d.arm_id)));
        setRomaneioSalvoInfo(`${armazensUsados.size} armazens`);
      }

      if (onSalvoComSucesso) {
        onSalvoComSucesso();
      }

      if (!obrigatorio && onClose) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar romaneio');
    } finally {
      setSalvando(false);
    }
  };

  const handleFechar = () => {
    if (obrigatorio && !temRomaneioSalvo) {
      setError('O romaneio e obrigatorio! Selecione o armazem e salve.');
      return;
    }
    if (onClose) {
      onClose();
    }
  };

  const getArmazemNome = (armId: number | null) => {
    if (!armId) return '-';
    const arm = armazens.find(a => a.arm_id === armId);
    return arm?.arm_descricao || `Armazem ${armId}`;
  };

  // Validar se pode salvar
  const podeSalvar = (() => {
    if (temRomaneioSalvo || salvando) return false;
    if (modoAvancado) {
      return itens.every(item => getDistribuicaoStatus(item).status === 'ok');
    }
    return armazemSelecionado !== null;
  })();

  const totalItens = itens.length;
  const totalQuantidade = itens.reduce((acc, item) => acc + item.quantidade_total, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Warehouse className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Romaneio de Entrada
                </h2>
                <p className="text-blue-100 text-sm">
                  {numeroEntrada}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-white/90 text-sm">
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                  <Package className="h-4 w-4" />
                  <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                  <Box className="h-4 w-4" />
                  <span>{totalQuantidade} un.</span>
                </div>
              </div>
              {(!obrigatorio || temRomaneioSalvo) && (
                <button
                  onClick={handleFechar}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mensagens de Status */}
        {temRomaneioSalvo && (
          <div className="mx-6 mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-800 dark:text-green-200 font-medium">Romaneio salvo com sucesso</p>
              <p className="text-green-600 dark:text-green-400 text-sm">
                Itens distribuidos para: <strong>{romaneioSalvoInfo}</strong>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toggle Modo Avancado */}
            {!temRomaneioSalvo && (
              <div className="px-6 pt-4">
                <button
                  onClick={() => setModoAvancado(!modoAvancado)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    modoAvancado
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Settings2 className="h-4 w-4" />
                  {modoAvancado ? 'Distribuicao por item (avancado)' : 'Armazem unico (simples)'}
                </button>
              </div>
            )}

            {/* Modo Simples: Seletor de Armazem Unico */}
            {!temRomaneioSalvo && !modoAvancado && armazens.length > 0 && (
              <div className="px-6 pt-4">
                <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Selecione o armazem de destino para todos os itens:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {armazens.map(arm => (
                      <button
                        key={arm.arm_id}
                        onClick={() => setArmazemSelecionado(arm.arm_id)}
                        className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                          armazemSelecionado === arm.arm_id
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                            : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:shadow-md'
                        }`}
                      >
                        {armazemSelecionado === arm.arm_id && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        )}
                        <div className={`flex items-center gap-2 mb-1 ${armazemSelecionado === arm.arm_id ? 'text-white' : ''}`}>
                          <Warehouse className={`h-4 w-4 ${armazemSelecionado === arm.arm_id ? 'text-white' : 'text-blue-500'}`} />
                          <span className="font-semibold text-sm">{arm.arm_descricao}</span>
                        </div>
                        {arm.arm_municipio && (
                          <p className={`text-xs ${armazemSelecionado === arm.arm_id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {arm.arm_municipio}/{arm.arm_uf}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Modo Avancado: Distribuicao por Item */}
            {!temRomaneioSalvo && modoAvancado && (
              <div className="px-6 pt-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm">
                    <Settings2 className="h-4 w-4" />
                    <span>Configure a distribuicao de cada item nos armazens abaixo</span>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Itens */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Itens da Entrada
                </h3>
              </div>
              <div className="space-y-3">
                {itens.map((item) => {
                  const distribuicaoStatus = getDistribuicaoStatus(item);
                  const somaDistribuida = item.distribuicao.reduce((acc, d) => acc + d.qtd, 0);

                  return (
                    <div
                      key={item.produto_cod}
                      className={`p-4 rounded-xl border transition-all ${
                        temRomaneioSalvo
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                          : modoAvancado && distribuicaoStatus.status === 'ok'
                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : modoAvancado && distribuicaoStatus.status === 'excesso'
                              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                              : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                      }`}
                    >
                      {/* Info do Produto */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                              {item.produto_ref || item.produto_cod}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-zinc-700 rounded text-xs font-semibold text-gray-700 dark:text-gray-300">
                              {item.quantidade_total} un
                            </span>
                          </div>
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1 max-w-md cursor-default">
                                  {item.produto_descr || '-'}
                                </p>
                              </TooltipTrigger>
                              {item.produto_descr && item.produto_descr.length > 40 && (
                                <TooltipContent side="top" className="max-w-md">
                                  <p>{item.produto_descr}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {/* Status/Destino no Modo Simples */}
                        {!modoAvancado && (
                          <div className="flex items-center gap-2">
                            {(armazemSelecionado || temRomaneioSalvo) && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                temRomaneioSalvo
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              }`}>
                                <Warehouse className="h-3.5 w-3.5" />
                                {getArmazemNome(armazemSelecionado)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Status no Modo Avancado */}
                        {modoAvancado && !temRomaneioSalvo && (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              distribuicaoStatus.status === 'ok'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : distribuicaoStatus.status === 'excesso'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            }`}>
                              {somaDistribuida}/{item.quantidade_total}
                            </span>
                            {item.distribuicao.length > 0 && (
                              <button
                                onClick={() => handleLimparDistribuicao(item.produto_cod)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                title="Limpar distribuicao"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Distribuicao por Armazem (Modo Avancado) */}
                      {modoAvancado && !temRomaneioSalvo && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
                          {armazens.map(arm => {
                            const dist = item.distribuicao.find(d => d.arm_id === arm.arm_id);
                            const qtd = dist?.qtd || 0;

                            return (
                              <div key={arm.arm_id} className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAlocarTudoEm(item.produto_cod, arm.arm_id)}
                                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                    qtd > 0
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                      : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-600'
                                  }`}
                                  title={`Alocar tudo em ${arm.arm_descricao}`}
                                >
                                  {arm.arm_descricao.substring(0, 8)}
                                </button>
                                <input
                                  type="number"
                                  value={qtd || ''}
                                  onChange={(e) => handleDistribuicaoChange(item.produto_cod, arm.arm_id, parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  min="0"
                                  max={item.quantidade_total}
                                  className="w-16 px-2 py-1.5 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs text-center"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Distribuicao Salva (Modo Avancado) */}
                      {modoAvancado && temRomaneioSalvo && item.distribuicao.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.distribuicao.map(dist => (
                            <span
                              key={dist.arm_id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
                            >
                              <Warehouse className="h-3 w-3" />
                              {getArmazemNome(dist.arm_id)}: {dist.qtd}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {!temRomaneioSalvo && podeSalvar && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Pronto para salvar</span>
                  </div>
                )}
                {!temRomaneioSalvo && !podeSalvar && !modoAvancado && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Selecione um armazem</span>
                  </div>
                )}
                {!temRomaneioSalvo && !podeSalvar && modoAvancado && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Complete a distribuicao de todos os itens</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {(!obrigatorio || temRomaneioSalvo) && (
                  <button
                    onClick={handleFechar}
                    className="px-5 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 font-medium transition-colors"
                  >
                    Fechar
                  </button>
                )}
                {!temRomaneioSalvo && (
                  <button
                    onClick={handleSalvar}
                    disabled={!podeSalvar}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                  >
                    {salvando ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar Romaneio
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
