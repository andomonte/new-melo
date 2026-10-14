/**
 * Modal "Associar à Ordem" — associação de UM item da DI a UMA ou MAIS ordens de
 * compra, espelhando o fluxo da ENTRADA NACIONAL (PedidosDisponiveisModal):
 *
 *   - lista as ordens ABERTAS do fornecedor com SALDO (itens-pedido);
 *   - o usuário aloca a quantidade do item entre uma ou mais ordens (quantidade por
 *     ordem, limitada ao saldo da ordem e ao restante do item);
 *   - mostra "Quantidade / Alocado / Restante" e só confirma quando o RESTANTE = 0;
 *   - todas as alocações são do MESMO produto (a 1ª ordem escolhida fixa o codprod).
 *
 * Ao confirmar, o item é dividido em N linhas (uma por ordem), cada uma com o seu
 * codprod + id_orc + quantidade — o `gerar-entradas` já agrupa por (codprod, id_orc)
 * e baixa o saldo de cada ordem na geração da entrada. NÃO baixa saldo aqui.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Loader2, ShoppingCart, Link2, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import { fmtDecimal } from '../utils/formatters';
import { BuscarProdutoModal } from './BuscarProdutoModal';

interface OrdemCandidata {
  orc_id: string;
  codprod: string;
  ref: string;
  descricao: string;
  qtd_disponivel: number;
  preco_unit: number;
  unidade: string;
  ncm: string;
}

export interface AlocacaoOrdem {
  orc_id: number;
  qtd: number;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Confirma a associação do item às ordens (dividindo o item nas alocações). */
  onConfirmar: (codprod: string, referencia: string, alocacoes: AlocacaoOrdem[]) => void;
  codCredor?: string;
  fornecedorNome?: string;
  /** Pré-filtro: referência/código do item da DI. */
  buscaInicial?: string;
  /** Quantidade do item da DI a alocar (obrigatório para o controle restante/total). */
  qtdItem: number;
  /** Se o item já tem produto associado, trava nesse codprod. */
  codprodAtual?: string;
  /** Descrição do item (para a busca de produto quando não há ordem). */
  descricaoItem?: string;
  /** Chamado ao buscar/escolher um produto dentro do modal (associa o produto na hora). */
  onProdutoAssociado?: (codprod: string, referencia: string, marca?: string) => void;
}

export const AssociarOrdemModal: React.FC<Props> = ({
  aberto,
  onFechar,
  onConfirmar,
  codCredor,
  fornecedorNome,
  buscaInicial,
  qtdItem,
  codprodAtual,
  descricaoItem,
  onProdutoAssociado,
}) => {
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<OrdemCandidata[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aloc, setAloc] = useState<Map<string, number>>(new Map()); // key orc_id__codprod -> qtd
  const [codprodLock, setCodprodLock] = useState<string | null>(codprodAtual ?? null);
  const [modalProdAberto, setModalProdAberto] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const temFornecedor = !!(codCredor || fornecedorNome);
  const chave = (o: { orc_id: string; codprod: string }) => `${o.orc_id}__${o.codprod}`;

  const fetchItens = useCallback(
    async (termo: string) => {
      if (!temFornecedor) return;
      setCarregando(true);
      try {
        const params = new URLSearchParams();
        if (codCredor) params.set('cod_credor', codCredor);
        else if (fornecedorNome) params.set('fornecedor_nome', fornecedorNome);
        if (termo) params.set('search', termo);
        const res = await api.get(`/api/importacao/itens-pedido?${params}`);
        setItens(res.data?.itens || []);
      } catch {
        setItens([]);
      } finally {
        setCarregando(false);
      }
    },
    [codCredor, fornecedorNome, temFornecedor],
  );

  useEffect(() => {
    if (!aberto || !temFornecedor) return;
    const inicial = (buscaInicial || '').trim();
    setBusca(inicial);
    setItens([]);
    setAloc(new Map());
    setCodprodLock(codprodAtual ?? null);
    fetchItens(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, codCredor, fornecedorNome]);

  const handleBuscaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusca(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchItens(val), 400);
  };

  const totalAlocado = useMemo(() => Array.from(aloc.values()).reduce((s, q) => s + q, 0), [aloc]);
  const restante = Math.max(0, qtdItem - totalAlocado);

  // Quantidade da alocação atual de uma ordem
  const getQtd = (o: OrdemCandidata) => aloc.get(chave(o)) || 0;

  const setQtd = (o: OrdemCandidata, valor: string) => {
    const k = chave(o);
    const atual = aloc.get(k) || 0;
    const teto = Math.min(o.qtd_disponivel, restante + atual); // não passa do saldo nem do restante
    let v = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > teto) v = teto;
    setAloc((prev) => {
      const novo = new Map(prev);
      if (v <= 0) novo.delete(k);
      else novo.set(k, v);
      // trava/solta o codprod conforme o conteúdo
      if (v > 0 && !codprodLock) setCodprodLock(o.codprod);
      return novo;
    });
    if (v <= 0 && !codprodAtual) {
      // se esvaziou tudo, libera a trava
      const restantes = Array.from(aloc.entries()).filter(([kk]) => kk !== k);
      if (restantes.length === 0) setCodprodLock(null);
    }
  };

  // Uma ordem é alocável se não há trava, ou se o codprod bate com a trava.
  const alocavel = (o: OrdemCandidata) => !codprodLock || o.codprod === codprodLock;

  const refDoProduto = useMemo(() => {
    if (!codprodLock) return '';
    return itens.find((o) => o.codprod === codprodLock)?.ref || '';
  }, [itens, codprodLock]);

  const podeConfirmar = aloc.size > 0 && restante === 0;

  const confirmar = () => {
    if (!podeConfirmar || !codprodLock) return;
    const alocacoes: AlocacaoOrdem[] = Array.from(aloc.entries())
      .map(([k, qtd]) => ({ orc_id: parseInt(k.split('__')[0], 10), qtd }))
      .filter((a) => a.qtd > 0);
    onConfirmar(codprodLock, refDoProduto, alocacoes);
  };

  // Busca de produto DENTRO do modal (quando não há ordem pela referência da DI):
  // associa o produto na hora e re-busca as ordens abertas desse produto.
  const handleProdutoEscolhido = (codprod: string, _descricao: string, referencia?: string, marca?: string) => {
    setModalProdAberto(false);
    onProdutoAssociado?.(codprod, referencia || '', marca);
    setAloc(new Map());
    setCodprodLock(codprod);
    const termo = (referencia || codprod).trim();
    setBusca(termo);
    fetchItens(termo);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#347AB6]" />
            <h3 className="text-lg font-bold text-[#347AB6]">Associar à Ordem de Compra</h3>
          </div>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Busca + resumo restante/total */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={handleBuscaChange}
                placeholder="Buscar por ordem, código, referência ou descrição..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
                autoFocus
              />
            </div>
            {onProdutoAssociado && (
              <button
                onClick={() => setModalProdAberto(true)}
                title="Buscar e associar um produto do cadastro (depois busca a ordem dele)"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-[#347AB6]/40 text-[#347AB6] dark:text-blue-400 hover:bg-[#347AB6]/10 transition-colors shrink-0"
              >
                <PackageSearch size={14} /> Buscar produto
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Quantidade do item: <b className="text-gray-800 dark:text-gray-100">{fmtDecimal(qtdItem, 0)}</b>
            </span>
            <span className="text-blue-600 dark:text-blue-400">Alocado: <b>{fmtDecimal(totalAlocado, 0)}</b></span>
            <span className={restante === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              Restante: <b>{fmtDecimal(restante, 0)}</b>
            </span>
            {codprodLock && (
              <span className="ml-auto text-gray-400 dark:text-gray-500">
                Produto travado: <span className="font-mono">{codprodLock}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tabela de ordens candidatas */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {!temFornecedor ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
              Vincule o fornecedor desta fatura a um credor para buscar ordens.
            </div>
          ) : carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
          ) : itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma ordem de compra aberta com saldo para este produto/fornecedor.
              </p>
              {onProdutoAssociado && (
                <button
                  onClick={() => setModalProdAberto(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#347AB6] text-white hover:bg-[#2a5f8f] transition-colors"
                >
                  <PackageSearch size={16} /> Buscar produto para associar
                </button>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 max-w-md">
                Associe um produto do cadastro e o sistema busca as ordens abertas dele.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                <tr className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <th className="text-left py-2 px-2">Ordem (OC)</th>
                  <th className="text-left py-2 px-2">Código</th>
                  <th className="text-left py-2 px-2">REF</th>
                  <th className="text-left py-2 px-2">Descrição</th>
                  <th className="text-right py-2 px-2">Saldo</th>
                  <th className="text-right py-2 px-2">Pr. Unit</th>
                  <th className="text-right py-2 px-2 w-28">Alocar</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((o) => {
                  const habilitado = alocavel(o);
                  const atual = getQtd(o);
                  const teto = Math.min(o.qtd_disponivel, restante + atual);
                  return (
                    <tr
                      key={chave(o)}
                      className={`border-b border-gray-100 dark:border-zinc-700 ${habilitado ? '' : 'opacity-40'} ${atual > 0 ? 'bg-[#347AB6]/5 dark:bg-blue-900/10' : ''}`}
                    >
                      <td className="py-2 px-2 font-mono text-indigo-700 dark:text-indigo-300">#{o.orc_id}</td>
                      <td className="py-2 px-2 font-mono text-gray-900 dark:text-gray-100">{o.codprod}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300">{o.ref || '-'}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                        {o.descricao || '-'}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                        {fmtDecimal(o.qtd_disponivel, 0)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                        {fmtDecimal(o.preco_unit)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={atual || ''}
                            placeholder="0"
                            disabled={!habilitado || (teto <= 0 && atual <= 0)}
                            onChange={(e) => setQtd(o, e.target.value)}
                            title={habilitado ? 'Quantidade a alocar desta ordem' : 'Outro produto já está travado nesta associação'}
                            className="w-16 text-right font-mono px-1 py-0.5 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[#347AB6]"
                          />
                          {habilitado && teto > atual && (
                            <button
                              onClick={() => setQtd(o, String(teto))}
                              title="Alocar o máximo possível desta ordem"
                              className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-500 hover:text-[#347AB6]"
                            >
                              máx
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-zinc-700 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {restante > 0
              ? `Faltam ${fmtDecimal(restante, 0)} para alocar — distribua entre as ordens.`
              : aloc.size > 0
                ? `${aloc.size} ordem(ns) alocada(s) — pronto.`
                : 'Aloque a quantidade do item em uma ou mais ordens.'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!podeConfirmar}
              onClick={confirmar}
              className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white flex items-center gap-1"
            >
              <Link2 size={14} /> Associar {aloc.size > 1 ? `(${aloc.size} ordens)` : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* Busca de produto (quando não há ordem pela referência) */}
      <BuscarProdutoModal
        aberto={modalProdAberto}
        onFechar={() => setModalProdAberto(false)}
        onSelecionar={handleProdutoEscolhido}
        descricaoItem={descricaoItem}
      />
    </div>
  );
};
