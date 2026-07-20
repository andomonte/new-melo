import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, CheckSquare, Square } from 'lucide-react';
import { Promocao, ItemPromocao } from '@/data/promocoes/promocoes';
import {
  Filtro,
  getListaProdutosEnriquecidos,
  ProdutoEnriquecido,
  ProdutosEnriquecidosResponse,
} from '@/data/produtos/produtos';
import { Meta } from '@/data/common/meta';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTablePadrao';
import { useToast } from '@/hooks/use-toast';

interface AdicionarProdutosAoCarrinhoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itensConvertidos: ItemPromocao[]) => void;
  tipoPrecoCliente: string;
  itensAdicionadosCount?: number;
  clienteId?: string;
  promocao?: Promocao | null;
  houveAlteracoesNosItens?: boolean;
}

export const AdicionarProdutosAoCarrinhoModal: React.FC<AdicionarProdutosAoCarrinhoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tipoPrecoCliente,
  clienteId,
  promocao,
}) => {
  const [loadingProd, setLoadingProd] = useState(false);
  const [listaProd, setListaProd] = useState<ProdutoEnriquecido[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });
  const { toast } = useToast();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const ignorarPrimeiro = useRef(true);
  const ultimaChamada = useRef({ page: 0, perPage: 0, search: '', filtros: '[]' });

  const headers = ['ações', 'codprod', 'ref', 'descr', 'codmarca', 'qtest', 'prvenda', 'dolar'];
  const columnLabels: Record<string, string> = {
    ações: 'Sel',
    codprod: 'Código',
    ref: 'Referência',
    descr: 'Descrição',
    codmarca: 'Marca',
    qtest: 'Estoque',
    prvenda: 'Pr. Venda',
    dolar: 'Origem',
  };

  useEffect(() => {
    if (isOpen) {
      ignorarPrimeiro.current = true;
      setListaProd([]);
      setSelecionados(new Set());
      setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });
      setSearchInput('');
      setCurrentSearchTerm('');
      setFiltros([]);
      ultimaChamada.current = { page: 0, perPage: 0, search: '', filtros: '[]' };
    }
  }, [isOpen]);

  const fetchProdutos = useCallback(async ({
    page, perPage, productSearch, filtrosParam, cliId,
  }: {
    page: number; perPage: number; productSearch: string; filtrosParam: Filtro[]; cliId?: string;
  }) => {
    const key = `${page}-${perPage}-${productSearch}-${JSON.stringify(filtrosParam)}`;
    const lastKey = `${ultimaChamada.current.page}-${ultimaChamada.current.perPage}-${ultimaChamada.current.search}-${ultimaChamada.current.filtros}`;
    if (key === lastKey) return;

    ultimaChamada.current = { page, perPage, search: productSearch, filtros: JSON.stringify(filtrosParam) };
    setLoadingProd(true);

    try {
      const data: ProdutosEnriquecidosResponse = await getListaProdutosEnriquecidos({
        page, perPage, productSearch, tipoPreco: tipoPrecoCliente, filtros: filtrosParam, clienteId: cliId,
      });

      if (data?.data?.length > 0) {
        setListaProd(data.data as ProdutoEnriquecido[]);
        setMeta(data.meta);
      } else {
        setListaProd([]);
        setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage });
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      setListaProd([]);
    } finally {
      setLoadingProd(false);
    }
  }, [tipoPrecoCliente]);

  useEffect(() => {
    if (!isOpen) return;
    if (ignorarPrimeiro.current) { ignorarPrimeiro.current = false; return; }

    const termo = currentSearchTerm.trim();
    if (termo.length >= 3 || filtros.length > 0) {
      fetchProdutos({ page: meta.currentPage, perPage: meta.perPage, productSearch: termo, filtrosParam: filtros, cliId: clienteId });
    } else {
      setListaProd([]);
      setLoadingProd(false);
    }
  }, [isOpen, meta.currentPage, meta.perPage, currentSearchTerm, filtros, fetchProdutos, clienteId]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setCurrentSearchTerm(value);
    setMeta((prev) => ({ ...prev, currentPage: 1 }));
  }, 400);

  const toggleSelecionado = useCallback((codprod: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(codprod)) {
        novo.delete(codprod);
      } else {
        novo.add(codprod);
      }
      return novo;
    });
  }, []);

  const handleConfirmSelection = () => {
    if (selecionados.size === 0) {
      toast({ title: 'Nenhum produto selecionado', description: 'Selecione pelo menos um produto.', variant: 'destructive' });
      return;
    }

    const descontoPadrao = Number(promocao?.valor_desconto) || 0;
    const itens: ItemPromocao[] = [];

    selecionados.forEach((codprod) => {
      const produto = listaProd.find((p) => p.codprod === codprod);
      if (!produto) return;

      const precoVenda = Number(produto.precoFinalCalculado || produto.prvenda) || 0;
      const precoPromo = descontoPadrao > 0 ? precoVenda * (1 - descontoPadrao / 100) : precoVenda;

      itens.push({
        id_promocao_item: 0,
        id_promocao: promocao?.id_promocao || 0,
        codprod: produto.codprod,
        codgpp: null,
        descricao: produto.descr || '',
        ref: produto.ref || '',
        marca: produto.codmarca || '',
        qtddisponivel: produto.qtest || 0,
        preco: precoVenda,
        prcompra: Number((produto as any).prcompra) || 0,
        prcustoatual: Number((produto as any).prcustoatual) || 0,
        valor_desconto_item: descontoPadrao,
        tipo_desconto_item: 'PERC',
        preco_promocao: Math.round(precoPromo * 100) / 100,
        qtd_total_item: null,
        qtde_minima_item: null,
        qtde_maxima_item: null,
        qtdVendido: null,
        qtdFaturado: null,
        origem: (produto as any).dolar || '',
      });
    });

    onConfirm(itens);
    toast({ title: `${itens.length} produto(s) adicionado(s)` });
  };

  const rows = listaProd.map((produto) => {
    const isSelected = selecionados.has(produto.codprod);
    const row: Record<string, any> = {};

    headers.forEach((h) => {
      if (h === 'ações') {
        row[h] = (
          <button
            onClick={() => toggleSelecionado(produto.codprod)}
            className="p-1"
            title={isSelected ? 'Remover seleção' : 'Selecionar produto'}
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-green-500" />
            ) : (
              <Square className="h-4 w-4 text-gray-400" />
            )}
          </button>
        );
      } else if (h === 'prvenda') {
        const preco = Number(produto.precoFinalCalculado || produto.prvenda) || 0;
        row[h] = `R$ ${preco.toFixed(2)}`;
      } else if (h === 'dolar') {
        row[h] = (produto as any).dolar === 'S' ? 'Importado' : 'Nacional';
      } else {
        row[h] = (produto as any)[h] ?? '';
      }
    });
    return row;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-[90vw] h-[85vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-zinc-700">
          <h2 className="text-lg font-bold text-[#347AB6]">Adicionar Produtos à Promoção</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{selecionados.size} selecionado(s)</span>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              size="sm"
              disabled={selecionados.size === 0}
              onClick={handleConfirmSelection}
            >
              Confirmar Seleção
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* DataTable */}
        <div className="flex-1 min-h-0 flex flex-col p-2">
          <DataTable
            headers={headers}
            rows={rows}
            meta={meta}
            columnLabels={columnLabels}
            carregando={loadingProd}
            semColunaDeAcaoPadrao={true}
            nonsortableColumns={['ações']}
            onPageChange={(newPage) => setMeta((prev) => ({ ...prev, currentPage: newPage }))}
            onPerPageChange={(newPerPage) => setMeta((prev) => ({ ...prev, perPage: newPerPage, currentPage: 1 }))}
            searchValue={searchInput}
            onSearch={(e) => {
              setSearchInput(e.target.value);
              debouncedSearch(e.target.value);
            }}
            onSearchKeyDown={(e) => {
              if (e.key === 'Enter') {
                setCurrentSearchTerm(searchInput);
                setMeta((prev) => ({ ...prev, currentPage: 1 }));
              }
            }}
            searchInputPlaceholder="Digite pelo menos 3 caracteres para buscar produto..."
            noDataMessage={!currentSearchTerm || currentSearchTerm.length < 3
              ? 'Digite pelo menos 3 caracteres e pressione Enter para buscar...'
              : 'Nenhum produto encontrado.'
            }
            onFiltroChange={(novosFiltros) => {
              setFiltros(novosFiltros);
              setMeta((prev) => ({ ...prev, currentPage: 1 }));
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdicionarProdutosAoCarrinhoModal;
