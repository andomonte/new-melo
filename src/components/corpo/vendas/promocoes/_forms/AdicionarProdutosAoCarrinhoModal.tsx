// src/components/modals/AdicionarProdutosAoCarrinhoModal.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MdClose } from 'react-icons/md';
import { Plus, Minus, CheckSquare, Square } from 'lucide-react';
import {
  Promocao,
  ProdutoCarrinhoTemp,
  ItemPromocao,
} from '@/data/promocoes/promocoes'; // Certifique-se de que ItemPromocao pode lidar com qtd_minima_item e qtd_maxima_item
import {
  Filtro,
  getListaProdutosEnriquecidos,
  ProdutoEnriquecido,
  ProdutosEnriquecidosResponse,
} from '@/data/produtos/produtos';
import { Meta } from '@/data/common/meta';

import { useDebouncedCallback } from 'use-debounce';

import DataTable from '@/components/common/DataTableFiltroProdPromo'; // Verifique o caminho se necessário
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

// NOTE: Removido 'valorDesconto' do tipo, usaremos 'desconto' que já existe
function createProdutoTemp(
  codigo: string,
  descrição: string,
  marca: string,
  estoque: string,
  preço: string,
  ref: string,
  quantidade: string,
  descriçãoEditada: string,
  totalItem: string,
  precoItemEditado: string,
  tipoPreço: string,
  desconto: number,
  origem: string,
  qtdVendido: number | null,
  qtdFaturado: number | null,
  tipoDescontoItem: 'PERC' | 'VALO' | 'PREF',
  qtdMinima?: number, // NOVO: para o ProdutoCarrinhoTemp
  qtdMaxima?: number, // NOVO: para o ProdutoCarrinhoTemp
): ProdutoCarrinhoTemp {
  return {
    codigo,
    descrição,
    marca,
    estoque,
    preço,
    ref,
    quantidade,
    descriçãoEditada,
    totalItem,
    precoItemEditado,
    tipoPreço,
    desconto,
    origem,
    qtdVendido,
    qtdFaturado,
    tipoDescontoItem,
    qtdMinima, // Mapeado aqui
    qtdMaxima, // Mapeado aqui
  };
}

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

const DEFAULT_INITIAL_HEADERS = [
  'ações',
  'desconto',
  'quantidade',
  'Qtd. Mínima', // Nova coluna
  'Qtd. Máxima', // Nova coluna

  'DESCR',
  'QTDDISPONIVEL',
  'CODMARCA',
  'PRVENDA',
  'CODPROD',
  'DOLAR',
];

function transformarParaItemPromocao(
  produto: ProdutoCarrinhoTemp,
  id_promocao: number,
): ItemPromocao {
  return {
    codprod: produto.codigo,
    descricao: produto.descrição,
    id_promocao,
    id_promocao_item: 0, // será gerado pelo banco
    qtdFaturado: null,
    qtdVendido: null,
    qtd_total_item: Number(produto.quantidade),
    qtde_maxima_item: produto.qtdMaxima ?? null, // Usar qtdMaxima, se existir
    qtde_minima_item: produto.qtdMinima ?? null, // Usar qtdMinima, se existir
    tipo_desconto_item: produto.tipoDescontoItem,
    valor_desconto_item: produto.desconto ?? 0,
    origem: produto.origem ?? '',
    codgpp: produto.codgpp ?? '',
  };
}
export const AdicionarProdutosAoCarrinhoModal: React.FC<
  AdicionarProdutosAoCarrinhoModalProps
> = ({ isOpen, onClose, onConfirm, tipoPrecoCliente, clienteId, promocao }) => {
  const maxQuantity = promocao?.qtde_maxima_total; // maxQuantity da promoção
  const [loadingProd, setLoadingProd] = useState(false);

  const discountInputRefs = useRef<{
    [codprod: string]: HTMLInputElement | null;
  }>({});

  const [listaProd, setListaProd] = useState<ProdutoEnriquecido[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    lastPage: 1,
    currentPage: 1,
    perPage: 10,
  });
  const { toast } = useToast();

  const [
    produtosSelecionadosTemporariamente,
    setProdutosSelecionadosTemporariamente,
  ] = useState<ProdutoCarrinhoTemp[]>([]);

  const [quantities, setQuantities] = useState<{
    [codprod: string]: number | string;
  }>({});
  const [discounts, setDiscounts] = useState<{
    [codprod: string]: number | string;
  }>({});
  const [discountTypes, setDiscountTypes] = useState<{
    [codprod: string]: 'PERC' | 'VALO' | 'PREF';
  }>({});
  // NOVOS ESTADOS PARA QTD. MÍNIMA E MÁXIMA
  const [minQuantities, setMinQuantities] = useState<{
    [codprod: string]: number | string;
  }>({});
  const [maxQuantities, setMaxQuantities] = useState<{
    [codprod: string]: number | string;
  }>({});

  const [colunasDbProd, setColunasDbProd] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasProdutosModal');
    return salvo
      ? Math.max(parseInt(salvo, 10), DEFAULT_INITIAL_HEADERS.length)
      : DEFAULT_INITIAL_HEADERS.length;
  });
  const [headers, setHeaders] = useState<string[]>(() => {
    return DEFAULT_INITIAL_HEADERS;
  });

  const [searchInput, setSearchInput] = useState<string>('');
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>('');
  const [currentFiltros, setCurrentFiltros] = useState<Filtro[]>([]);
  const ignorarPrimeiroUseEffect = useRef(true);
  const ultimaChamada = useRef({
    page: 0,
    perPage: 0,
    productSearch: '',
    tipoPreco: '',
    limiteColunas: 0,
    filtros: [] as Filtro[],
    clienteId: '' as string | undefined,
  });

  // Este useEffect é responsável por resetar o estado quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      ignorarPrimeiroUseEffect.current = true;

      setListaProd([]);
      setProdutosSelecionadosTemporariamente([]);
      setQuantities({});
      setDiscounts({});
      setDiscountTypes({});
      setMinQuantities({});
      setMaxQuantities({});
      setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });

      setColunasDbProd([]);
      setSearchInput('');
      setCurrentSearchTerm(''); // <-- ISSO AQUI FALTAVA

      setCurrentFiltros([]);
      setHeaders(DEFAULT_INITIAL_HEADERS);

      const savedLimit = localStorage.getItem('limiteColunasProdutosModal');
      setLimiteColunas(
        savedLimit
          ? Math.max(parseInt(savedLimit, 10), DEFAULT_INITIAL_HEADERS.length)
          : DEFAULT_INITIAL_HEADERS.length,
      );

      ultimaChamada.current = {
        page: 0,
        perPage: 0,
        productSearch: '',
        tipoPreco: '',
        limiteColunas: 0,
        filtros: [],
        clienteId: undefined,
      };
    }
  }, [isOpen]);

  // useEffect para inicializar descontos da promoção
  useEffect(() => {
    if (promocao && promocao.itens_promocao) {
      const initialDiscounts: Record<string, number> = {};
      const initialMinQtys: Record<string, number> = {};
      const initialMaxQtys: Record<string, number> = {};
      const initialDiscountTypes: Record<string, 'PERC' | 'VALO' | 'PREF'> = {};

      promocao.itens_promocao.forEach((item) => {
        if (item.codprod) {
          initialDiscounts[item.codprod] = Number(
            item.valor_desconto_item ?? 0,
          );

          initialMinQtys[item.codprod] = Number(item.qtde_minima_item ?? 1);
          initialMaxQtys[item.codprod] = Number(item.qtde_maxima_item ?? 1);
          if (
            item.tipo_desconto_item === 'VALO' ||
            item.tipo_desconto_item === 'PERC'
          ) {
            initialDiscountTypes[item.codprod] = item.tipo_desconto_item;
          } else {
            initialDiscountTypes[item.codprod] = 'PERC'; // fallback
          }
        }
      });

      setDiscounts(initialDiscounts);
      setMinQuantities(initialMinQtys);
      setMaxQuantities(initialMaxQtys);
      setDiscountTypes(initialDiscountTypes); // ✅ Agora também inicializa o tipo corretamente
    }
  }, [promocao]);

  // Função para buscar produtos no backend
  const fetchProdutos = useCallback(
    async ({
      page,
      perPage,
      productSearch,
      filtros,
      cliId,
    }: {
      page: number;
      perPage: number;
      productSearch: string;
      filtros: Filtro[];
      cliId?: string;
    }) => {
      const ultima = ultimaChamada.current;
      const filtrosString = JSON.stringify(filtros);
      const ultimaFiltrosString = JSON.stringify(ultima.filtros);

      if (
        ultima.page === page &&
        ultima.perPage === perPage &&
        ultima.productSearch === productSearch &&
        ultima.tipoPreco === tipoPrecoCliente &&
        ultima.limiteColunas === limiteColunas &&
        filtrosString === ultimaFiltrosString &&
        ultima.clienteId === cliId
      ) {
        return;
      }

      ultimaChamada.current = {
        page,
        perPage,
        productSearch,
        tipoPreco: tipoPrecoCliente,
        limiteColunas,
        filtros,
        clienteId: cliId,
      };

      setLoadingProd(true);

      try {
        const data: ProdutosEnriquecidosResponse =
          await getListaProdutosEnriquecidos({
            page,
            perPage,
            productSearch,
            tipoPreco: tipoPrecoCliente,
            filtros,
            clienteId: cliId,
          });
        if (data && data.data && data.data.length > 0) {
          setListaProd(data.data as ProdutoEnriquecido[]);
          setMeta(data.meta);

          // Inicializa as quantidades
          setQuantities((prevQuantities) => {
            const newQuantities = { ...prevQuantities };
            data.data.forEach((produto) => {
              const initialQty =
                maxQuantity && maxQuantity > 0 ? maxQuantity : 1;
              if (newQuantities[produto.codprod] === undefined) {
                newQuantities[produto.codprod] = Math.min(
                  initialQty,
                  produto.qtest || 1,
                );
              } else {
                newQuantities[produto.codprod] = Math.min(
                  Number(newQuantities[produto.codprod]),
                  produto.qtest || 1,
                );
              }
            });
            return newQuantities;
          });

          // Inicializa os descontos
          const descontoGlobal = Number(promocao?.valor_desconto);
          const valorDescontoInicial = descontoGlobal > 0 ? descontoGlobal : 0; // Padrão 0 para desconto

          setDiscounts((prevDiscounts) => {
            // Mude o tipo de 'novosDescontos' para aceitar 'number | string'
            const novosDescontos: Record<string, number | string> = {
              ...prevDiscounts,
            };

            data.data.forEach((produto) => {
              if (novosDescontos[produto.codprod] === undefined) {
                // Aqui, valorDescontoInicial é um número, o que é compatível com number | string
                novosDescontos[produto.codprod] = valorDescontoInicial;
              }
            });
            return novosDescontos;
          });

          // Inicializa os tipos de desconto (padrão 'PERC')
          setDiscountTypes((prevTypes) => {
            const newTypes = { ...prevTypes };
            data.data.forEach((produto) => {
              if (newTypes[produto.codprod] === undefined) {
                // Define o tipo com base na promoção atual
                const tipoPromo = promocao?.tipo_desconto || 'PERC';
                newTypes[produto.codprod] = tipoPromo as
                  | 'PERC'
                  | 'VALO'
                  | 'PREF';
              }
            });
            return newTypes;
          });

          // **********************************************
          // NOVAS INICIALIZAÇÕES PARA QTD. MÍNIMA E MÁXIMA
          // **********************************************
          setMinQuantities((prevMinQtys) => {
            const newMinQtys = { ...prevMinQtys };
            data.data.forEach((produto) => {
              if (newMinQtys[produto.codprod] === undefined) {
                // Se a promoção tiver qtde_minima_ativacao, usa-a, senão 1
                newMinQtys[produto.codprod] =
                  promocao?.qtde_minima_ativacao ?? 1;
              }
            });
            return newMinQtys;
          });

          setMaxQuantities((prevMaxQtys) => {
            const newMaxQtys = { ...prevMaxQtys };
            data.data.forEach((produto) => {
              const codprod = produto.codprod;
              const initialQty =
                maxQuantity && maxQuantity > 0 ? maxQuantity : 1;
              const quantidadeAtual = Math.min(initialQty, produto.qtest || 1);

              if (newMaxQtys[codprod] === undefined) {
                const initialMax =
                  promocao?.qtde_maxima_por_cliente ?? quantidadeAtual;
                newMaxQtys[codprod] = Math.min(initialMax, quantidadeAtual);
              } else {
                newMaxQtys[codprod] = Math.min(
                  Number(newMaxQtys[codprod]),
                  quantidadeAtual,
                );
              }
            });
            return newMaxQtys;
          });

          // **********************************************

          // Lógica para determinar as colunas a serem exibidas
          const allColumns = Object.keys(data.data[0]).filter(
            (col) =>
              col.toLowerCase() !== 'acoes' && col.toLowerCase() !== 'ações',
          );
          setColunasDbProd(allColumns);

          let currentHeaders = [...DEFAULT_INITIAL_HEADERS];
          const existingDataKeys = new Set(
            Object.keys(data.data[0]).map((k) => k.toLowerCase()),
          );

          currentHeaders = currentHeaders.filter(
            (header) =>
              DEFAULT_INITIAL_HEADERS.includes(header) ||
              existingDataKeys.has(header.toLowerCase()),
          );

          const dynamicHeaders = allColumns.filter(
            (col) =>
              !currentHeaders.includes(col.toUpperCase()) &&
              !DEFAULT_INITIAL_HEADERS.map((h) => h.toLowerCase()).includes(
                col.toLowerCase(),
              ), // Evitar duplicar colunas padrão
          );

          const availableSpace = limiteColunas - currentHeaders.length;
          if (availableSpace > 0) {
            currentHeaders = [
              ...currentHeaders,
              ...dynamicHeaders.slice(0, availableSpace),
            ];
          }

          // Garantir ordem das colunas fixas
          const fixedHeadersOrder = [
            'ações',
            'desconto',
            'quantidade',
            'Qtd. Mínima',
            'Qtd. Máxima',
          ];
          fixedHeadersOrder.forEach((fixedHeader) => {
            const index = currentHeaders.indexOf(fixedHeader);
            if (index > -1) {
              currentHeaders.splice(index, 1);
            }
          });
          currentHeaders = [...fixedHeadersOrder, ...currentHeaders];

          setHeaders(currentHeaders);
        } else {
          setListaProd([]);
          setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });

          setQuantities({});
          setDiscounts({});
          setDiscountTypes({});
          setMinQuantities({}); // Limpa Qtd. Mínima
          setMaxQuantities({}); // Limpa Qtd. Máxima
        }
      } catch (error) {
        console.error('Erro ao buscar produtos enriquecidos:', error);
        setListaProd([]);
        setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });

        setQuantities({});
        setDiscounts({});
        setDiscountTypes({});
        setMinQuantities({});
        setMaxQuantities({});
      } finally {
        setLoadingProd(false);
      }
    },
    [tipoPrecoCliente, promocao, limiteColunas, maxQuantity],
  );

  // Debounce para aplicar filtros avançados
  const debouncedFetchProdutosFiltros = useDebouncedCallback(
    (newFiltros: Filtro[]) => {
      setCurrentFiltros(newFiltros);
      setMeta((prev) => ({ ...prev, currentPage: 1 }));

      if (currentSearchTerm.trim() || newFiltros.length > 0) {
        fetchProdutos({
          page: 1,
          perPage: meta.perPage,
          productSearch: currentSearchTerm,
          filtros: newFiltros,
          cliId: clienteId,
        });
      } else {
        setListaProd([]);
        setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });
      }
    },
    300,
  );

  // Este useEffect reage a mudanças no termo de busca principal ou paginação
  // e dispara a busca SE houver um termo OU filtros.
  useEffect(() => {
    if (!isOpen) return;

    // ⛔️ Ignora a primeira execução ao abrir o modal
    if (ignorarPrimeiroUseEffect.current) {
      ignorarPrimeiroUseEffect.current = false;
      return;
    }

    const termo = currentSearchTerm.trim();

    if (termo.length >= 3 || currentFiltros.length > 0) {
      fetchProdutos({
        page: meta.currentPage,
        perPage: meta.perPage,
        productSearch: termo,
        filtros: currentFiltros,
        cliId: clienteId,
      });
    } else {
      setListaProd([]);
      setLoadingProd(false);
      setMeta({ total: 0, lastPage: 1, currentPage: 1, perPage: 10 });
    }
  }, [
    isOpen,
    meta.currentPage,
    meta.perPage,
    currentSearchTerm,
    currentFiltros,
    limiteColunas,
    fetchProdutos,
    clienteId,
  ]);

  useEffect(() => {
    if (colunasDbProd.length > 0) {
      const allAvailableColumns = new Set(
        colunasDbProd.map((col) => col.toLowerCase()),
      );

      let initialKnownHeaders = DEFAULT_INITIAL_HEADERS.filter(
        (h) => h === 'ações' || allAvailableColumns.has(h.toLowerCase()),
      );

      // Garante que as colunas fixas estejam presentes e na ordem correta no início
      const fixedHeadersOrder = [
        'ações',
        'desconto',
        'quantidade',
        'Qtd. Mínima',
        'Qtd. Máxima',
      ];

      fixedHeadersOrder.forEach((fixedHeader) => {
        if (!initialKnownHeaders.includes(fixedHeader)) {
          // Adiciona se não estiver presente
          if (fixedHeader === 'ações') initialKnownHeaders.unshift(fixedHeader);
          else if (fixedHeader === 'quantidade') {
            const acoesIndex = initialKnownHeaders.indexOf('ações');
            initialKnownHeaders.splice(acoesIndex + 1, 0, fixedHeader);
          } else if (fixedHeader === 'Qtd. Mínima') {
            const qtyIndex = initialKnownHeaders.indexOf('quantidade');
            initialKnownHeaders.splice(qtyIndex + 1, 0, fixedHeader);
          } else if (fixedHeader === 'Qtd. Máxima') {
            const minQtyIndex = initialKnownHeaders.indexOf('Qtd. Mínima');
            initialKnownHeaders.splice(minQtyIndex + 1, 0, fixedHeader);
          } else if (fixedHeader === 'desconto') {
            const maxQtyIndex = initialKnownHeaders.indexOf('Qtd. Máxima');
            initialKnownHeaders.splice(maxQtyIndex + 1, 0, fixedHeader);
          }
        }
      });

      // Filtra duplicatas e reordena para manter as fixas no início
      initialKnownHeaders = Array.from(new Set(initialKnownHeaders));
      const sortedKnownHeaders = fixedHeadersOrder.filter((h) =>
        initialKnownHeaders.includes(h),
      );
      const remainingHeaders = initialKnownHeaders.filter(
        (h) => !fixedHeadersOrder.includes(h),
      );
      initialKnownHeaders = [...sortedKnownHeaders, ...remainingHeaders];

      const otherColumns = colunasDbProd.filter(
        (col) =>
          !initialKnownHeaders.some(
            (h) => h.toLowerCase() === col.toLowerCase(),
          ) &&
          col.toLowerCase() !== 'id' &&
          !fixedHeadersOrder
            .map((h) => h.toLowerCase())
            .includes(col.toLowerCase()), // Evitar colunas fixas
      );

      let newHeaders: string[] = [];
      if (limiteColunas <= initialKnownHeaders.length) {
        newHeaders = initialKnownHeaders.slice(0, limiteColunas);
      } else {
        const remainingLimit = limiteColunas - initialKnownHeaders.length;
        newHeaders = [
          ...initialKnownHeaders,
          ...otherColumns.slice(0, remainingLimit),
        ];
      }
      setHeaders(newHeaders);
    } else {
      setHeaders(DEFAULT_INITIAL_HEADERS);
    }
  }, [limiteColunas, colunasDbProd]);

  // Funções de manipulação de Quantidade
  const handleIncreaseQuantity = useCallback(
    (codprod: string, currentStock: number) => {
      setQuantities((prevQuantities) => {
        const currentQty = prevQuantities[codprod] || 0;
        const newQty = Number(currentQty) + 1;

        if (newQty > currentStock) {
          toast({
            title: 'Estoque Insuficiente',
            description: `Não há ${newQty} unidades disponíveis em estoque para este produto.`,
            variant: 'destructive',
          });
          return prevQuantities;
        }

        return {
          ...prevQuantities,
          [codprod]: newQty,
        };
      });
    },
    [toast],
  );

  const handleDecreaseQuantity = useCallback((codprod: string) => {
    setQuantities((prevQuantities) => {
      const currentQty = prevQuantities[codprod] || 0;
      const newQty = Math.max(1, Number(currentQty) - 1);
      return {
        ...prevQuantities,
        [codprod]: newQty,
      };
    });
  }, []);

  const handleQuantityInputChange = useCallback(
    (codprod: string, value: string, currentStock: number) => {
      if (value === '') {
        setQuantities((prev) => ({
          ...prev,
          [codprod]: '',
        }));
        return;
      }

      const parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue < 1) return;

      let newQty = parsedValue;

      if (newQty > currentStock) {
        newQty = currentStock;
        toast({
          title: 'Estoque Insuficiente',
          description: `A quantidade foi ajustada para o estoque disponível de ${currentStock} unidades.`,
          variant: 'default',
        });
      }

      setQuantities((prevQuantities) => ({
        ...prevQuantities,
        [codprod]: newQty,
      }));
    },
    [toast],
  );

  const handleQuantityInputBlur = useCallback(
    (codprod: string) => {
      const currentValue = quantities[codprod];
      if (
        currentValue === '' ||
        currentValue === 0 ||
        isNaN(Number(currentValue))
      ) {
        setQuantities((prev) => ({
          ...prev,
          [codprod]: 1,
        }));
      }
    },
    [quantities],
  );

  // Funções de manipulação de Desconto
  const handleIncreaseDiscount = useCallback(
    (codprod: string, type: 'PERC' | 'VALO', price: number) => {
      setDiscounts((prevDiscounts) => {
        const currentDiscount = Number(prevDiscounts[codprod]) || 0;
        let newDiscount = currentDiscount;

        if (type === 'PERC') {
          newDiscount = Math.min(100, currentDiscount + 1); // Limita a 100%
        } else {
          // type === 'VALO'
          newDiscount = currentDiscount + 1; // Aumenta R$1,00
          if (newDiscount > price) {
            // Não permite desconto em valor maior que o preço
            newDiscount = price;
            toast({
              title: 'Desconto Máximo Atingido',
              description:
                'O desconto em valor não pode ser maior que o preço do produto.',
              variant: 'destructive',
            });
          }
        }
        return {
          ...prevDiscounts,
          [codprod]: newDiscount,
        };
      });
    },
    [toast],
  );

  const handleDecreaseDiscount = useCallback(
    (codprod: string, type: 'PERC' | 'VALO') => {
      setDiscounts((prevDiscounts) => {
        const currentDiscount = Number(prevDiscounts[codprod]) || 0;
        let newDiscount = currentDiscount;

        if (type === 'PERC') {
          newDiscount = Math.max(0, currentDiscount - 1); // Não permite desconto negativo
        } else {
          // type === 'VALO'
          newDiscount = Math.max(0, currentDiscount - 1); // Diminui R$1,00
        }
        return {
          ...prevDiscounts,
          [codprod]: newDiscount,
        };
      });
    },
    [],
  );

  const handleDiscountInputChange = useCallback(
    (codprod: string, value: string, type: 'PERC' | 'VALO', price: number) => {
      if (value === '') {
        setDiscounts((prev) => ({
          ...prev,
          [codprod]: '',
        }));
        return;
      }

      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) return;

      let newDiscount = parsedValue;

      if (newDiscount < 0) {
        newDiscount = 0;
        toast({
          title: 'Desconto Inválido',
          description: 'O desconto não pode ser negativo. Ajustado para 0.',
          variant: 'destructive',
        });
      } else if (type === 'PERC' && newDiscount > 100) {
        newDiscount = 100;
        toast({
          title: 'Desconto Inválido',
          description:
            'O desconto em porcentagem não pode ser maior que 100%. Ajustado para 100%.',
          variant: 'destructive',
        });
      } else if (type === 'VALO' && newDiscount > price) {
        newDiscount = price;
        toast({
          title: 'Desconto Inválido',
          description:
            'O desconto em valor não pode ser maior que o preço do produto. Ajustado para o preço do produto.',
          variant: 'destructive',
        });
      }

      setDiscounts((prevDiscounts) => ({
        ...prevDiscounts,
        [codprod]: newDiscount,
      }));
    },
    [toast],
  );

  const handleDiscountInputBlur = useCallback(
    (codprod: string) => {
      const currentValue = discounts[codprod];
      if (currentValue === '' || isNaN(Number(currentValue))) {
        setDiscounts((prev) => ({
          ...prev,
          [codprod]: 0,
        }));
      }
    },
    [discounts],
  );

  const handleToggleDiscountType = useCallback(
    (codprod: string) => {
      setDiscountTypes((prevTypes) => {
        const currentType = prevTypes[codprod];
        const newType = currentType === 'PERC' ? 'VALO' : 'PERC';

        // Limpa o valor no estado
        setDiscounts((prevDiscounts) => ({
          ...prevDiscounts,
          [codprod]: '',
        }));

        // Foca o input após a atualização do estado
        setTimeout(() => {
          discountInputRefs.current[codprod]?.focus();
        }, 0); // Aguarda próximo ciclo de renderização

        toast({
          title: 'Tipo de Desconto Alterado',
          description: `Desconto para ${codprod} agora é em ${
            newType === 'PERC' ? 'Porcentagem' : 'Valor Fixo'
          }.`,
          variant: 'default',
        });

        return {
          ...prevTypes,
          [codprod]: newType,
        };
      });
    },
    [toast],
  );

  // Funções para Qtd. Mínima
  const handleIncreaseMinQuantity = useCallback((codprod: string) => {
    setMinQuantities((prevMinQtys) => {
      const currentMin = Number(prevMinQtys[codprod]) || 0;
      return {
        ...prevMinQtys,
        [codprod]: currentMin + 1,
      };
    });
  }, []);

  const handleDecreaseMinQuantity = useCallback((codprod: string) => {
    setMinQuantities((prevMinQtys) => {
      const currentMin = Number(prevMinQtys[codprod]) || 0;
      const newMin = Math.max(1, currentMin - 1); // Qtd mínima não pode ser menor que 1
      return {
        ...prevMinQtys,
        [codprod]: newMin,
      };
    });
  }, []);

  const handleMinQuantityInputChange = useCallback(
    (codprod: string, value: string) => {
      if (value === '') {
        setMinQuantities((prev) => ({ ...prev, [codprod]: '' }));
        return;
      }
      const parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue < 1) return; // Qtd mínima não pode ser menor que 1
      setMinQuantities((prevMinQtys) => ({
        ...prevMinQtys,
        [codprod]: parsedValue,
      }));
    },
    [],
  );

  const handleMinQuantityInputBlur = useCallback(
    (codprod: string) => {
      const currentValue = minQuantities[codprod];
      if (
        currentValue === '' ||
        currentValue === 0 ||
        isNaN(Number(currentValue))
      ) {
        setMinQuantities((prev) => ({
          ...prev,
          [codprod]: 1, // Valor padrão ao perder o foco
        }));
      }
    },
    [minQuantities],
  );

  const handleIncreaseMaxQuantity = useCallback(
    (codprod: string) => {
      setMaxQuantities((prevMaxQtys) => {
        const currentMax = Number(prevMaxQtys[codprod]) || 0;
        const quantidadeAtual = Number(quantities[codprod]) || 1; // ← base para limite
        const newMax = currentMax + 1;

        if (newMax > quantidadeAtual) {
          toast({
            title: 'Limite Atingido',
            description: `A quantidade máxima não pode ser maior que a quantidade atual (${quantidadeAtual}).`,
            variant: 'destructive',
          });
          return prevMaxQtys;
        }

        return {
          ...prevMaxQtys,
          [codprod]: newMax,
        };
      });
    },
    [toast, quantities], // ← inclui 'quantities' como dependência
  );

  const handleDecreaseMaxQuantity = useCallback(
    (codprod: string, minLimit: number) => {
      setMaxQuantities((prevMaxQtys) => {
        const currentMax = Number(prevMaxQtys[codprod]) || 0;
        const newMax = Math.max(minLimit, currentMax - 1); // Não permite ser menor que a Qtd. Mínima
        return {
          ...prevMaxQtys,
          [codprod]: newMax,
        };
      });
    },
    [],
  );

  const handleMaxQuantityInputChange = useCallback(
    (codprod: string, value: string) => {
      if (value === '') {
        setMaxQuantities((prev) => ({ ...prev, [codprod]: '' }));
        return;
      }
      const parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue < 1) return;

      let newMax = parsedValue;
      const quantidadeAtual = Number(quantities[codprod]) || 1;
      if (newMax > quantidadeAtual) {
        newMax = quantidadeAtual;
        toast({
          title: 'Limite Atingido',
          description: `A quantidade máxima foi ajustada para a quantidade atual (${quantidadeAtual}).`,
          variant: 'default',
        });
      }

      setMaxQuantities((prevMaxQtys) => ({
        ...prevMaxQtys,
        [codprod]: newMax,
      }));
    },
    [toast, quantities],
  );

  const handleMaxQuantityInputBlur = useCallback(
    (codprod: string) => {
      const currentValue = maxQuantities[codprod];
      if (
        currentValue === '' ||
        currentValue === 0 ||
        isNaN(Number(currentValue))
      ) {
        setMaxQuantities((prev) => ({
          ...prev,
          [codprod]: Number(quantities[codprod]) || 1, // Valor padrão ao perder o foco (estoque ou 1)
        }));
      }
    },
    [maxQuantities, quantities],
  );

  const handleToggleProductSelection = useCallback(
    (produtoData: ProdutoEnriquecido) => {
      setProdutosSelecionadosTemporariamente((prevSelected) => {
        const produtoExistenteIndex = prevSelected.findIndex(
          (item) => item.codigo === produtoData.codprod,
        );

        const rawType = discountTypes[produtoData.codprod];
        const currentDiscountType: 'PERC' | 'VALO' =
          rawType === 'PREF' || !rawType ? 'PERC' : rawType;
        const precoVenda =
          Number(produtoData.precoFinalCalculado || produtoData.prvenda) || 0;
        const valorDescontoAplicado =
          Number(discounts[produtoData.codprod]) || 0;
        const quantidadeSelecionada =
          Number(quantities[produtoData.codprod]) || 1;
        if (
          !valorDescontoAplicado ||
          isNaN(valorDescontoAplicado) ||
          valorDescontoAplicado <= 0
        ) {
          setTimeout(() => {
            const inputElement = document.getElementById(
              `input-desconto-${produtoData.codprod}`,
            ) as HTMLInputElement | null;
            if (inputElement) {
              inputElement.focus();
            }
          }, 0);

          toast({
            title: 'Desconto obrigatório',
            description:
              'Informe um valor de desconto maior que zero antes de adicionar o produto.',
            variant: 'destructive',
          });

          return prevSelected; // Impede a seleção
        }

        // VALORES DE QTD. MÍNIMA E MÁXIMA PARA O PRODUTO SELECIONADO
        const quantidadeMinima =
          Number(minQuantities[produtoData.codprod]) || 1;
        // Garante que a Qtd. Máxima não seja maior que o estoque disponível
        const quantidadeMaxima = Math.min(
          Number(maxQuantities[produtoData.codprod]) || produtoData.qtest || 1,
          produtoData.qtest || 1,
        );

        if (produtoExistenteIndex > -1) {
          toast({
            title: 'Produto Removido',
            description: `${produtoData.descr} removido da lista.`,
            variant: 'default',
          });
          return prevSelected.filter(
            (item) => item.codigo !== produtoData.codprod,
          );
        } else {
          const currentStock = produtoData.qtest || 0;

          if (quantidadeSelecionada > currentStock) {
            toast({
              title: 'Estoque Insuficiente',
              description: `A quantidade selecionada (${quantidadeSelecionada}) é maior que o estoque disponível (${currentStock}) para este produto.`,
              variant: 'destructive',
            });
            return prevSelected;
          }
          // Validações para Qtd. Mínima e Máxima ao adicionar
          if (quantidadeMinima > quantidadeMaxima) {
            toast({
              title: 'Erro de Quantidade',
              description: `A Quantidade Mínima (${quantidadeMinima}) não pode ser maior que a Quantidade Máxima (${quantidadeMaxima}) para este produto.`,
              variant: 'destructive',
            });
            return prevSelected;
          }

          if (quantidadeSelecionada > currentStock) {
            toast({
              title: 'Estoque Insuficiente',
              description: `A quantidade selecionada (${quantidadeSelecionada}) foi ajustada para o estoque disponível (${currentStock}).`,
              variant: 'default',
            });

            // Ajusta automaticamente a quantidade no estado
            setQuantities((prev) => ({
              ...prev,
              [produtoData.codprod]: currentStock,
            }));

            return prevSelected; // Não adiciona ainda, o usuário deve clicar de novo após correção
          }

          let precoComDesconto = precoVenda;

          if (currentDiscountType === 'PERC') {
            precoComDesconto = precoVenda * (1 - valorDescontoAplicado / 100);
          } else {
            // VALO
            precoComDesconto = precoVenda - valorDescontoAplicado;
            if (precoComDesconto < 0) {
              precoComDesconto = 0;
            }
          }
          const precoComDescontoFormatado = precoComDesconto.toFixed(2);

          const totalItem = (precoComDesconto * quantidadeSelecionada).toFixed(
            2,
          );

          const newProductTemp = createProdutoTemp(
            produtoData.codprod,
            produtoData.descr || '',
            produtoData.codmarca || '',
            String(produtoData.qtest || 0),
            precoVenda.toFixed(2),
            produtoData.ref || '',
            String(quantidadeSelecionada),
            produtoData.descr || '',
            totalItem,
            precoComDescontoFormatado,
            tipoPrecoCliente,
            valorDescontoAplicado,
            produtoData.dolar || '',
            0,
            0,
            currentDiscountType,
            quantidadeMinima, // Passa a Qtd. Mínima
            quantidadeMaxima, // Passa a Qtd. Máxima
          );

          toast({
            title: 'Produto Adicionado',
            description: `${
              produtoData.descr
            } adicionado à lista com ${quantidadeSelecionada} unidades, Qtd. Mínima: ${quantidadeMinima}, Qtd. Máxima: ${quantidadeMaxima} e ${valorDescontoAplicado}${
              currentDiscountType === 'PERC' ? '%' : ' R$'
            } de desconto.`,
            variant: 'default',
          });
          return [...prevSelected, newProductTemp];
        }
      });
    },
    [
      tipoPrecoCliente,
      toast,
      quantities,
      discounts,
      discountTypes,
      minQuantities,
      maxQuantities,
    ],
  );

  const handleConfirmSelection = () => {
    if (!promocao) {
      toast({
        title: 'Promoção inválida',
        description:
          'Não foi possível identificar a promoção para salvar os itens.',
        variant: 'destructive',
      });
      return;
    }

    const itensConvertidos = produtosSelecionadosTemporariamente.map(
      (produto) => transformarParaItemPromocao(produto, promocao.id_promocao),
    );

    onConfirm(itensConvertidos);
    onClose();
  };

  const handlePageChange = (newPage: number) => {
    setMeta((prev) => ({ ...prev, currentPage: newPage }));
  };

  const handlePerPageChange = (newPerPage: number) => {
    setMeta((prev) => ({ ...prev, perPage: newPerPage, currentPage: 1 }));
  };

  const handleColunaSubstituida = useCallback(
    (colA: string, colB: string, tipo: 'swap' | 'replace' = 'replace') => {
      setHeaders((prev) => {
        const novaOrdem = [...prev];
        const indexA = novaOrdem.indexOf(colA);
        const indexB = novaOrdem.indexOf(colB);

        // Impedir a movimentação de 'ações', 'quantidade', 'desconto', 'Qtd. Mínima', 'Qtd. Máxima'
        const fixedColumns = [
          'ações',
          'desconto',
          'quantidade',
          'Qtd. Mínima',
          'Qtd. Máxima',
        ];
        if (fixedColumns.includes(colA) || fixedColumns.includes(colB)) {
          toast({
            title: 'Movimentação Restrita',
            description:
              'As colunas "ações", "quantidade", "desconto", "Qtd. Mínima" e "Qtd. Máxima" não podem ser movidas.',
            variant: 'destructive',
          });
          return prev;
        }

        if (tipo === 'swap' && indexA !== -1 && indexB !== -1) {
          [novaOrdem[indexA], novaOrdem[indexB]] = [
            novaOrdem[indexB],
            novaOrdem[indexA],
          ];
        } else if (tipo === 'replace' && indexA !== -1) {
          novaOrdem[indexA] = colB;
        }

        return novaOrdem;
      });
    },
    [toast],
  );

  const handleLimiteColunasChange = useCallback((novoLimite: number) => {
    setLimiteColunas(novoLimite);
    localStorage.setItem('limiteColunasProdutosModal', novoLimite.toString());
  }, []);
  const rows = listaProd.map((produto) => {
    const row: Record<string, any> = {};
    const currentStock = produto.qtest || 0;
    const isSelected = produtosSelecionadosTemporariamente.some(
      (item) => item.codigo === produto.codprod,
    );
    const precoVendaProduto =
      Number(produto.precoFinalCalculado || produto.prvenda) || 0;
    const rawType = discountTypes[produto.codprod];
    const currentDiscountType: 'PERC' | 'VALO' =
      rawType === 'VALO' ? 'VALO' : 'PERC';

    // Obtém os valores de quantidade mínima e máxima para o produto
    const currentMinQty = Number(minQuantities[produto.codprod]) || 1;
    const currentMaxQty =
      Number(maxQuantities[produto.codprod]) || currentStock; // Usa estoque como padrão

    headers.forEach((header) => {
      if (header === 'ações') {
        row.ações = (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleToggleProductSelection(produto)}
            title={
              isSelected
                ? 'Remover produto da lista'
                : 'Adicionar produto à lista'
            }
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-green-500" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        );
      } else if (header.toUpperCase() === 'QUANTIDADE') {
        row.quantidade = (
          <div className="relative flex items-center justify-center w-full">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDecreaseQuantity(produto.codprod)}
              title="Diminuir quantidade"
              disabled={Number(quantities[produto.codprod]) <= 1}
              className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-blue-50 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min="1"
              value={quantities[produto.codprod] ?? ''}
              onChange={(e) =>
                handleQuantityInputChange(
                  produto.codprod,
                  e.target.value,
                  currentStock,
                )
              }
              onBlur={() => handleQuantityInputBlur(produto.codprod)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuantityInputBlur(produto.codprod);
              }}
              className="w-full text-center h-8 pr-8 pl-8
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none appearance-none"
              style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                handleIncreaseQuantity(produto.codprod, currentStock)
              }
              title="Aumentar quantidade"
              disabled={
                (Number(quantities[produto.codprod]) || 0) >= currentStock
              }
              className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-blue-50 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        );
      } else if (header.toUpperCase() === 'QTD. MÍNIMA') {
        row['Qtd. Mínima'] = (
          <div className="relative flex items-center justify-center w-full min-w-[120px]">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDecreaseMinQuantity(produto.codprod)}
              title="Diminuir quantidade mínima"
              disabled={currentMinQty <= 1}
              className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-green-50 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-900"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min="1"
              value={minQuantities[produto.codprod] ?? ''}
              onChange={(e) =>
                handleMinQuantityInputChange(produto.codprod, e.target.value)
              }
              onBlur={() => handleMinQuantityInputBlur(produto.codprod)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  handleMinQuantityInputBlur(produto.codprod);
              }}
              className="w-full text-center h-8 pr-8 pl-8
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none appearance-none"
              style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleIncreaseMinQuantity(produto.codprod)}
              title="Aumentar quantidade mínima"
              disabled={
                currentMinQty >= currentMaxQty || currentMinQty >= currentStock
              }
              className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-green-50 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-900"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        );
      } else if (header.toUpperCase() === 'QTD. MÁXIMA') {
        row['Qtd. Máxima'] = (
          <div className="relative flex items-center justify-center w-full min-w-[130px]">
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                handleDecreaseMaxQuantity(produto.codprod, currentMinQty)
              }
              title="Diminuir quantidade máxima"
              disabled={currentMaxQty <= currentMinQty || currentMaxQty <= 1}
              className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-red-50 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-900"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min={currentMinQty.toString()}
              max={String(quantities[produto.codprod] || currentStock)}
              value={maxQuantities[produto.codprod] ?? ''}
              onChange={(e) =>
                handleMaxQuantityInputChange(produto.codprod, e.target.value)
              }
              onBlur={() => handleMaxQuantityInputBlur(produto.codprod)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  handleMaxQuantityInputBlur(produto.codprod);
              }}
              className="w-full text-center h-8 pr-8 pl-8
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none appearance-none"
              style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleIncreaseMaxQuantity(produto.codprod)}
              title="Aumentar quantidade máxima"
              disabled={currentMaxQty >= currentStock}
              className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-red-50 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-900"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        );
      } else if (header.toUpperCase() === 'DESCONTO') {
        row.desconto = (
          <div className="flex items-center justify-center w-full gap-1">
            <div className="relative flex items-center w-32 min-w-[7.5rem]">
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  handleDecreaseDiscount(produto.codprod, currentDiscountType)
                }
                title="Diminuir desconto"
                disabled={Number(discounts[produto.codprod]) <= 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-purple-50 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900"
              >
                <Minus className="h-3 w-3" />
              </Button>

              <Input
                type="number"
                min="0"
                ref={(el) => {
                  discountInputRefs.current[produto.codprod] = el;
                }}
                max={
                  currentDiscountType === 'PERC'
                    ? '100'
                    : precoVendaProduto.toString()
                }
                step="1"
                value={discounts[produto.codprod] ?? ''}
                onChange={(e) =>
                  handleDiscountInputChange(
                    produto.codprod,
                    e.target.value,
                    currentDiscountType,
                    precoVendaProduto,
                  )
                }
                onInput={(e) => {
                  const input = e.currentTarget;
                  if (input.value.length > 8) {
                    input.value = input.value.slice(0, 5);
                  }
                }}
                onBlur={() => handleDiscountInputBlur(produto.codprod)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    handleDiscountInputBlur(produto.codprod);
                }}
                className="text-center h-8 pl-8 pr-8 w-full min-w-[7rem]
      [&::-webkit-outer-spin-button]:appearance-none
      [&::-webkit-inner-spin-button]:appearance-none appearance-none"
              />

              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  handleIncreaseDiscount(
                    produto.codprod,
                    currentDiscountType,
                    precoVendaProduto,
                  )
                }
                title="Aumentar desconto"
                disabled={
                  (currentDiscountType === 'PERC' &&
                    Number(discounts[produto.codprod]) >= 100) ||
                  (currentDiscountType === 'VALO' &&
                    Number(discounts[produto.codprod]) >= precoVendaProduto)
                }
                className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-purple-50 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggleDiscountType(produto.codprod)}
              title={`Mudar para desconto em ${
                currentDiscountType === 'PERC'
                  ? 'Reais (R$)'
                  : 'Porcentagem (%)'
              }`}
              className="h-8 w-10 text-xs flex items-center justify-center border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {currentDiscountType === 'PERC' ? '%' : 'R$'}
            </Button>
          </div>
        );
      } else if (header.toUpperCase() === 'CODPROD') {
        row.CODPROD = produto.codprod || '';
      } else if (header.toUpperCase() === 'DESCR') {
        row.DESCR = produto.descr || '';
      } else if (header.toUpperCase() === 'QTDDISPONIVEL') {
        row.QTDDISPONIVEL = String(produto.qtest || 0);
      } else if (header.toUpperCase() === 'CODMARCA') {
        row.CODMARCA = produto.codmarca || '';
      } else if (header.toUpperCase() === 'DOLAR') {
        row.DOLAR = produto.dolar || '';
      } else if (header.toUpperCase() === 'PRVENDA') {
        row.PRVENDA = `R$ ${(
          Number(produto.precoFinalCalculado || produto.prvenda) || 0
        ).toFixed(2)}`;
      } else {
        row[header] =
          produto[header as keyof typeof produto] ||
          produto[header.toLowerCase() as keyof typeof produto] ||
          '';
      }
    });
    return row;
  });
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-[100vw] h-[96vh] bg-gray-50 dark:bg-black rounded-lg shadow-xl flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Adicionar Produtos</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="bg-[#347AB6] hover:bg-blue-600 dark:hover:bg-blue-800"
              onClick={handleConfirmSelection}
              disabled={produtosSelecionadosTemporariamente.length === 0}
            >
              Adicionar à Promoção ({produtosSelecionadosTemporariamente.length}{' '}
              itens)
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-2"
            >
              <MdClose className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Resultados da Busca e Produtos de Referência (agora sempre visível) */}
        <div className="flex-grow overflow-hidden p-4 flex flex-col">
          <div className="flex-1 min-h-0">
            <div className="h-[calc(100%)] overflow-auto">
              <DataTable
                carregando={loadingProd}
                headers={headers}
                rows={rows || []}
                meta={meta}
                onPageChange={handlePageChange}
                onPerPageChange={handlePerPageChange}
                onSearch={(e) => setSearchInput(e.target.value)}
                onSearchKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (searchInput.trim().length >= 3) {
                      setCurrentSearchTerm(searchInput);
                      setMeta((prev) => ({ ...prev, currentPage: 1 }));
                    }
                  }
                }}
                searchInputPlaceholder="Pesquisar por código, descrição ou referência..."
                searchValue={searchInput}
                colunasFiltro={colunasDbProd}
                onFiltroChange={(novosFiltros) => {
                  debouncedFetchProdutosFiltros(novosFiltros);
                }}
                limiteColunas={limiteColunas}
                onLimiteColunasChange={handleLimiteColunasChange}
                onColunaSubstituida={handleColunaSubstituida}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
