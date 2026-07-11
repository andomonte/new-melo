import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react';
import { Produtos, getProdutos } from '@/data/produtos/produtos';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarProduto from './modalCadastrar';
import EditarProduto from './modalEditar';
import { ProdutoZoomModal } from './ProdutoZoomModal';
import { CopiarProdutoModal } from './CopiarProdutoModal';
import { AlteracaoMassaModal } from './AlteracaoMassaModal';
import { DemandaModal } from './DemandaModal';
import { ExtratoItemModal } from './ExtratoItemModal';
import { ProdutosEquivalentesModal } from './ProdutosEquivalentesModal';
import { ProdutosRelacionadosModal } from './ProdutosRelacionadosModal';
import { TransferenciaArmazemModal } from './TransferenciaArmazemModal';
import { TransferenciaArmazemMassaModal } from './TransferenciaArmazemMassaModal';
import { GoPencil } from 'react-icons/go';
import { BsBoxes } from 'react-icons/bs';
import {
  PlusIcon,
  CircleChevronDown,
  Eye,
  Copy,
  Trash2,
  Edit3,
  TrendingUp,
  FileText,
  Link2,
  Package,
  ArrowRightLeft,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ========================================
// TIPOS
// ========================================

export type Permissao = {
  cadastrar?: boolean;
  editar?: boolean;
  remover?: boolean;
  consultar?: boolean;
  grupoId: string;
  id: number;
  tb_telas: {
    CODIGO_TELA: number;
    PATH_TELA: string;
    NOME_TELA: string;
  };
};

type User = {
  usuario: string;
  perfil: string;
  obs: string;
  codusr: string;
  filial: string;
  permissoes?: Permissao[];
  funcoes?: string[];
};

interface AuthContextProps {
  user: User | null;
}

type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

type UserPermissions = {
  cadastrar: boolean;
  editar: boolean;
  remover: boolean;
  consultar: boolean;
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

const ProdutosPage = () => {
  // Estados principais
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [produtos, setProdutos] = useState<Produtos>({ data: [], meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 } } as any);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [colunasDbProd, setColunasDbProd] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasProutos');
    return salvo ? parseInt(salvo, 10) : 10;
  });

  // Colunas prioritárias na ordem do Delphi
  const colunasPrioritarias = ['codprod', 'ref', 'descr', 'codmarca', 'qtest', 'prvenda', 'prcompra', 'unimed', 'codbar', 'obs'];

  // Estados de modais
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [idProduto, setIdProduto] = useState<string>('');

  // Novos modais
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [produtoToZoom, setProdutoToZoom] = useState<any>(null);
  const [isCopiarOpen, setIsCopiarOpen] = useState(false);
  const [produtoToCopiar, setProdutoToCopiar] = useState<any>(null);
  const [isAlteracaoMassaOpen, setIsAlteracaoMassaOpen] = useState(false);
  const [isDemandaOpen, setIsDemandaOpen] = useState(false);
  const [produtoToDemanda, setProdutoToDemanda] = useState<any>(null);
  const [isExtratoOpen, setIsExtratoOpen] = useState(false);
  const [produtoToExtrato, setProdutoToExtrato] = useState<any>(null);
  const [isEquivalentesOpen, setIsEquivalentesOpen] = useState(false);
  const [produtoToEquivalentes, setProdutoToEquivalentes] = useState<any>(null);
  const [isRelacionadosOpen, setIsRelacionadosOpen] = useState(false);
  const [produtoToRelacionados, setProdutoToRelacionados] = useState<any>(null);
  const [isTransferenciaOpen, setIsTransferenciaOpen] = useState(false);
  const [produtoToTransferencia, setProdutoToTransferencia] = useState<any>(null);
  const [isTransferenciaMassaOpen, setIsTransferenciaMassaOpen] = useState(false);

  // Seleção de produtos para ações coletivas
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [selectAll, setSelectAll] = useState(false);

  // Estados de dropdown
  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: string]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: string]: boolean;
  }>({});

  // Refs
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>(
    {},
  );
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Contexts
  const { dismiss, toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;

  // Permissões
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    cadastrar: false,
    editar: false,
    remover: false,
    consultar: true,
  });

  // Refs para controle de chamadas
  const ultimaChamada = useRef({
    page: 0,
    perPage: 0,
    search: '',
    limiteColunas: 0,
    filtros: [] as Filtro[],
  });

  const ultimaChamadaUnico = useRef({
    page: 0,
    perPage: 0,
    search: '',
  });

  // ========================================
  // FUNÇÕES DE BUSCA
  // ========================================

  const fetchProdutos = useCallback(
    async ({
      page,
      perPage,
      search,
      filtros: novosFiltros,
    }: {
      page: number;
      perPage: number;
      search: string;
      filtros: Filtro[];
    }) => {
      // Igual à tela de Clientes: a listagem vem vazia e só busca quando há
      // pesquisa com 3+ caracteres OU filtros avançados ativos. Sem isso, o
      // grid não carrega todos os produtos por padrão.
      const temBusca = !!search && search.trim().length >= 3;
      const temFiltros = !!novosFiltros && novosFiltros.length > 0;
      if (!temBusca && !temFiltros) {
        setProdutos({
          data: [],
          meta: { total: 0, lastPage: 1, currentPage: 1, perPage },
        } as any);
        setHeaders(['selecionar', 'ações']);
        setLoading(false);
        // zera o cache da última chamada para permitir buscar de novo depois
        ultimaChamada.current = {
          page: 0,
          perPage: 0,
          search: '',
          limiteColunas,
          filtros: [],
        };
        return;
      }

      const ultima = ultimaChamada.current;

      // Evita chamadas duplicadas
      if (
        ultima.page === page &&
        ultima.perPage === perPage &&
        ultima.search === search &&
        ultima.limiteColunas === limiteColunas &&
        JSON.stringify(ultima.filtros) === JSON.stringify(novosFiltros)
      ) {
        console.log('🔄 Chamada duplicada evitada');
        return;
      }

      // Evita chamadas simultâneas
      if (isLoadingRef.current) {
        console.log('⏳ Busca já em andamento');
        return;
      }

      console.log('🚀 Buscando produtos:', {
        page,
        perPage,
        search,
        filtros: novosFiltros.length,
      });

      ultimaChamada.current = {
        page,
        perPage,
        search,
        limiteColunas,
        filtros: novosFiltros,
      };

      isLoadingRef.current = true;
      setLoading(true);

      try {
        let data;

        // Se há filtros avançados, usa o endpoint com filtros
        if (novosFiltros && novosFiltros.length > 0) {
          const response = await fetch('/api/produtos/buscaComFiltro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page,
              perPage,
              productSearch: search,
              filtros: novosFiltros,
            }),
          });

          if (!response.ok) {
            throw new Error('Erro na busca com filtros');
          }

          data = await response.json();
        } else {
          // Usa o endpoint padrão
          data = await getProdutos({
            page,
            perPage,
            search,
            filtros: novosFiltros,
          });
        }

        if (!isMountedRef.current) return;

        console.log(`✅ ${data.data?.length || 0} produtos recebidos`);

        setProdutos(data);

        // Configura colunas dinâmicas
        if (data.data?.length > 0) {
          const colunasDinamicas = Object.keys(data.data[0]).filter(
            (coluna) => !['selecionar', 'ações'].includes(coluna.toLowerCase()),
          );
          // Ordena colunas: prioritárias primeiro, depois as restantes
          const ordenadas = [
            ...colunasPrioritarias.filter(c => colunasDinamicas.includes(c)),
            ...colunasDinamicas.filter(c => !colunasPrioritarias.includes(c)),
          ];

          setColunasDbProd(colunasDinamicas);

          // Passa TODAS as colunas — visibilidade gerenciada pelo DataTable
          const novosHeaders = ['selecionar', 'ações', ...ordenadas];
          setHeaders(novosHeaders);
          console.log(
            `📊 ${colunasDinamicas.length} colunas disponíveis, ${ordenadas.length} visíveis`,
          );
        } else {
          setHeaders(['selecionar', 'ações']);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        if (!isMountedRef.current) return;

        toast({
          title: 'Erro ao carregar produtos',
          description:
            'Não foi possível obter os dados. Verifique sua conexão.',
          variant: 'destructive',
        });

        setProdutos({ data: [], meta: {} } as any);
      } finally {
        isLoadingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          console.log('🏁 Busca finalizada');
        }
      }
    },
    [limiteColunas, toast],
  );

  const fetchProdutosUnico = useCallback(
    async ({
      page,
      perPage,
      search,
    }: {
      page: number;
      perPage: number;
      search: string;
    }) => {
      const ultima = ultimaChamadaUnico.current;

      if (
        ultima.page === page &&
        ultima.perPage === perPage &&
        ultima.search === search
      ) {
        console.log('🔄 Busca única duplicada evitada');
        return;
      }

      if (isLoadingRef.current) {
        console.log('⏳ Busca já em andamento');
        return;
      }

      console.log('🔍 Busca rápida:', search);

      ultimaChamadaUnico.current = { page, perPage, search };
      isLoadingRef.current = true;
      setLoading(true);

      try {
        const data = await getProdutos({ page, perPage, search });

        if (!isMountedRef.current) return;

        console.log(`✅ ${data.data?.length || 0} produtos encontrados`);
        setProdutos(data);

        // Atualiza colunas se necessário
        if (data.data?.length > 0) {
          const colunasDinamicas = Object.keys(data.data[0]).filter(
            (coluna) => !['selecionar', 'ações'].includes(coluna.toLowerCase()),
          );
          // Ordena colunas: prioritárias primeiro, depois as restantes
          const ordenadas = [
            ...colunasPrioritarias.filter(c => colunasDinamicas.includes(c)),
            ...colunasDinamicas.filter(c => !colunasPrioritarias.includes(c)),
          ];

          setColunasDbProd(colunasDinamicas);

          // Passa TODAS as colunas — visibilidade gerenciada pelo DataTable
          const novosHeaders = ['selecionar', 'ações', ...ordenadas];
          setHeaders(novosHeaders);
        }
      } catch (error) {
        console.error('❌ Erro na busca única:', error);
        if (!isMountedRef.current) return;

        toast({
          title: 'Erro na pesquisa',
          description: 'Falha ao buscar dados.',
          variant: 'destructive',
        });
      } finally {
        isLoadingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          console.log('🏁 Busca rápida finalizada');
        }
      }
    },
    [limiteColunas, toast],
  );

  const debouncedSearchUnico = useDebouncedCallback((value: string) => {
    if (value.length < 3) {
      setProdutos({ data: [], meta: { total: 0, lastPage: 1, currentPage: 1, perPage } } as any);
      return;
    }
    setPage(1);
    setFiltros([]);
    fetchProdutosUnico({ page: 1, perPage, search: value });
  }, 500);

  // ========================================
  // FUNÇÕES DE DROPDOWN
  // ========================================

  const toggleDropdown = (id: string, buttonElement: HTMLButtonElement) => {
    const wasOpen = dropdownStates[id];
    closeAllDropdowns();

    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 180;
      const estimatedDropdownHeight = 350; // Altura estimada do dropdown

      // Calcula posição horizontal
      let leftPosition = rect.right + window.scrollX + 5;
      if (window.innerWidth - rect.right < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }

      // Calcula posição vertical - abre para cima se não houver espaço abaixo
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      let topPosition;

      if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
        // Abre para cima - posiciona para que o bottom do dropdown fique próximo ao topo do botão
        topPosition = rect.bottom + window.scrollY - estimatedDropdownHeight + 10;
      } else {
        // Abre para baixo (padrão)
        topPosition = rect.top + window.scrollY;
      }

      setDropdownStates({ [id]: true });
      setIconRotations({ [id]: true });
      setDropdownPositions({ [id]: { top: topPosition, left: leftPosition } });
    }
  };

  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  // ========================================
  // HANDLERS
  // ========================================

  const handleColunaSubstituida = useCallback(
    (colA: string, colB: string, tipo: 'swap' | 'replace' = 'replace') => {
      setHeaders((prev) => {
        const novaOrdem = [...prev];
        const indexA = novaOrdem.indexOf(colA);
        const indexB = novaOrdem.indexOf(colB);

        if (tipo === 'swap' && indexA !== -1 && indexB !== -1) {
          [novaOrdem[indexA], novaOrdem[indexB]] = [
            novaOrdem[indexB],
            novaOrdem[indexA],
          ];
        } else if (tipo === 'replace' && indexA !== -1) {
          const filteredHeaders = novaOrdem.filter((h) => h !== colB);
          const actualIndexA = filteredHeaders.indexOf(colA);
          if (actualIndexA !== -1) {
            filteredHeaders[actualIndexA] = colB;
          }
          return filteredHeaders;
        }

        return novaOrdem;
      });
    },
    [],
  );

  const recarregarLista = useCallback(() => {
    fetchProdutos({ page, perPage, search, filtros });
  }, [page, perPage, search, filtros, fetchProdutos]);

  // Exportar lista de produtos para Excel
  const handleExportarExcel = useCallback(async () => {
    if (!produtos.data || produtos.data.length === 0) {
      toast({ description: 'Nenhum produto para exportar', variant: 'destructive' });
      return;
    }
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Produtos');

      // Headers baseados nas colunas visíveis (exceto selecionar e ações)
      const colunasExport = headers.filter(h => !['selecionar', 'ações'].includes(h.toLowerCase()));
      ws.columns = colunasExport.map(col => ({ header: col, key: col, width: 20 }));

      // Estilo do header
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      // Dados
      produtos.data.forEach((prod: any) => {
        const row: Record<string, any> = {};
        colunasExport.forEach(col => { row[col] = prod[col] ?? ''; });
        ws.addRow(row);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'produtos.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ description: 'Produtos exportados com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ description: 'Erro ao exportar produtos', variant: 'destructive' });
    }
  }, [produtos.data, headers, toast]);

  /**
   * ZOOM - Inspeção detalhada do produto
   */
  const handleZoom = (produto: any) => {
    console.log('🔍 ZOOM - Produto recebido:', produto);
    console.log('🔍 ZOOM - Campos do produto:', Object.keys(produto));
    console.log('🔍 ZOOM - Marca:', produto.codmarca);
    console.log('🔍 ZOOM - Referência:', produto.ref);
    setProdutoToZoom(produto);
    setIsZoomOpen(true);
    closeAllDropdowns();
  };

  /**
   * Copiar produto
   */
  const handleCopiar = (produto: any) => {
    setProdutoToCopiar(produto);
    setIsCopiarOpen(true);
    closeAllDropdowns();
  };

  /**
   * Consulta de Demanda
   */
  const handleDemanda = (produto: any) => {
    setProdutoToDemanda(produto);
    setIsDemandaOpen(true);
    closeAllDropdowns();
  };

  /**
   * Extrato de Item
   */
  const handleExtrato = (produto: any) => {
    setProdutoToExtrato(produto);
    setIsExtratoOpen(true);
    closeAllDropdowns();
  };

  /**
   * Produtos Equivalentes
   */
  const handleEquivalentes = (produto: any) => {
    setProdutoToEquivalentes(produto);
    setIsEquivalentesOpen(true);
    closeAllDropdowns();
  };

  /**
   * Produtos Relacionados
   */
  const handleRelacionados = (produto: any) => {
    setProdutoToRelacionados(produto);
    setIsRelacionadosOpen(true);
    closeAllDropdowns();
  };

  /**
   * Transferência de Armazém (individual)
   */
  const handleTransferencia = (produto: any) => {
    setProdutoToTransferencia(produto);
    setIsTransferenciaOpen(true);
    closeAllDropdowns();
  };

  /**
   * Transferência de Armazém em Massa
   */
  const handleTransferenciaMassa = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: 'Nenhum produto selecionado',
        description: 'Selecione pelo menos um produto.',
        variant: 'destructive',
      });
      return;
    }
    setIsTransferenciaMassaOpen(true);
  };

  /**
   * Sucesso em transferência
   */
  const handleTransferenciaSuccess = () => {
    recarregarLista();
  };

  /**
   * Excluir produto (soft delete)
   */
  const handleExcluir = async (produto: any) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o produto:\n${produto.codprod} - ${produto.descr}?\n\nEsta ação pode ser desfeita.`,
      )
    ) {
      return;
    }

    closeAllDropdowns();

    try {
      const response = await fetch('/api/produtos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprod: produto.codprod }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || 'Erro ao excluir produto');
      }

      toast({
        title: 'Produto excluído',
        description: resultado.message,
      });

      recarregarLista();
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      toast({
        title: 'Erro ao excluir produto',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Sucesso ao copiar produto
   */
  const handleCopiarSuccess = (produtoCopiado: any) => {
    toast({
      title: 'Produto copiado com sucesso!',
      description: `Código: ${produtoCopiado.codprod}`,
    });
    recarregarLista();
  };

  /**
   * Alteração em massa
   */
  const handleAlteracaoMassa = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: 'Nenhum produto selecionado',
        description: 'Selecione pelo menos um produto.',
        variant: 'destructive',
      });
      return;
    }
    setIsAlteracaoMassaOpen(true);
  };

  /**
   * Sucesso em alteração em massa
   */
  const handleAlteracaoMassaSuccess = () => {
    setSelectedProducts(new Set());
    setSelectAll(false);
    recarregarLista();
  };

  /**
   * Alterna seleção de um produto
   */
  const toggleSelectProduct = (codprod: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(codprod)) {
      newSelected.delete(codprod);
    } else {
      newSelected.add(codprod);
    }
    setSelectedProducts(newSelected);
    setSelectAll(false);
  };

  /**
   * Seleciona/Desmarca todos da página atual
   */
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(produtos.data?.map((p) => p.codprod) || []);
      setSelectedProducts(allIds);
      setSelectAll(true);
    }
  };

  // ========================================
  // EFFECTS
  // ========================================

  // Carregamento inicial - EXECUTA UMA ÚNICA VEZ
  // Montagem do componente — NÃO carrega dados automaticamente (igual clientes)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Recarrega quando limiteColunas mudar (EXCETO na primeira montagem)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    console.log(`🔄 Limite de colunas alterado: ${limiteColunas}`);
    fetchProdutos({ page, perPage, search, filtros });
  }, [limiteColunas, page, perPage, search, filtros, fetchProdutos]);

  // Salva headers no localStorage
  useEffect(() => {
    if (headers.length > 0) {
      localStorage.setItem(
        'headersSelecionadosProdutos',
        JSON.stringify(headers),
      );
    }
  }, [headers]);

  // Lógica de permissões
  useEffect(() => {
    if (!user?.permissoes || !Array.isArray(user.permissoes)) {
      setUserPermissions({
        cadastrar: false,
        editar: false,
        remover: false,
        consultar: true,
      });
      toast({
        variant: 'destructive',
        title: 'Erro de Permissão',
        description: 'Você não tem permissão para acessar esta página.',
      });
      return;
    }

    const telaHref = sessionStorage.getItem('telaAtualMelo');
    let parsedTelaHref: string | undefined;

    if (telaHref) {
      try {
        parsedTelaHref = JSON.parse(telaHref);
      } catch (e) {
        console.warn('telaHref não é JSON válido', e);
        parsedTelaHref = telaHref;
      }
    }

    const telaPerfil = user.permissoes.find(
      (permissao) => permissao.tb_telas?.PATH_TELA === parsedTelaHref,
    );

    if (telaPerfil) {
      setUserPermissions({
        cadastrar: telaPerfil.cadastrar || false,
        editar: telaPerfil.editar || false,
        remover: telaPerfil.remover || false,
        consultar: telaPerfil.consultar || true,
      });
    } else {
      setUserPermissions({
        cadastrar: false,
        editar: false,
        remover: false,
        consultar: true,
      });
      toast({
        variant: 'destructive',
        title: 'Erro de Permissão',
        description: 'Você não tem permissão para acessar esta página.',
      });
    }
  }, [user, toast]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;

      for (const id in dropdownStates) {
        if (dropdownStates[id]) {
          const dropdownNode = dropdownRefs.current[id];
          const actionButtonNode = actionButtonRefs.current[id];

          if (
            dropdownNode &&
            !dropdownNode.contains(event.target as Node) &&
            actionButtonNode &&
            !actionButtonNode.contains(event.target as Node)
          ) {
            shouldClose = true;
            break;
          }
        }
      }

      if (shouldClose) closeAllDropdowns();
    };

    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [dropdownStates, closeAllDropdowns]);

  // ========================================
  // RENDER
  // ========================================

  const rows = produtos.data?.map((produto) => {
    const linha: Record<string, any> = {};
    const id = produto.codprod;

    headers?.forEach((coluna) => {
      const colunaLower = coluna.toLowerCase();

      // Coluna de seleção (checkbox)
      if (colunaLower === 'selecionar') {
        linha[coluna] = (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selectedProducts.has(id)}
              onCheckedChange={() => toggleSelectProduct(id)}
              aria-label={`Selecionar produto ${produto.descr || id}`}
            />
          </div>
        );
      }
      // Coluna de ações (dropdown customizado)
      else if (colunaLower === 'ações') {
        linha[coluna] = (
          <div className="relative flex items-center justify-center">
            <button
              ref={(el) => {
                if (el) actionButtonRefs.current[produto.codprod] = el;
              }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 ${
                iconRotations[produto.codprod] ? 'rotate-180' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown(produto.codprod, e.currentTarget);
              }}
              aria-label="Ações do produto"
            >
              <CircleChevronDown size={18} />
            </button>

            {dropdownStates[produto.codprod] &&
              dropdownPositions[produto.codprod] &&
              createPortal(
                <div
                  ref={(el) => {
                    if (el) dropdownRefs.current[produto.codprod] = el;
                  }}
                  className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  style={{
                    position: 'absolute',
                    top: dropdownPositions[produto.codprod]?.top,
                    left: dropdownPositions[produto.codprod]?.left,
                    minWidth: '180px',
                    zIndex: 999,
                  }}
                >
                  <div className="py-1" role="menu">
                    {/* ZOOM (Inspeção) */}
                    <button
                      onClick={() => handleZoom(produto)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Inspeção detalhada do produto"
                    >
                      <Eye
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      ZOOM (Inspeção)
                    </button>

                    {/* Editar */}
                    {userPermissions.editar && (
                      <button
                        onClick={() => {
                          if (!produto.codprod) {
                            console.error('Produto sem código válido:', produto);
                            toast({
                              description: 'Erro: Produto sem código válido.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          setSelectedRow(produto);
                          setIdProduto(produto.codprod);
                          setEditarOpen(true);
                          closeAllDropdowns();
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      >
                        <GoPencil
                          className="mr-2 text-gray-400 dark:text-gray-500"
                          size={16}
                        />
                        Editar
                      </button>
                    )}

                    {/* Demanda */}
                    <button
                      onClick={() => handleDemanda(produto)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Consultar demanda do produto"
                    >
                      <TrendingUp
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Demanda
                    </button>

                    {/* Extrato de Item */}
                    <button
                      onClick={() => handleExtrato(produto)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Consultar extrato de movimentações"
                    >
                      <FileText
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Extrato de Item
                    </button>

                    {/* Produtos Equivalentes */}
                    <button
                      onClick={() => handleEquivalentes(produto)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Ver produtos equivalentes/substitutos"
                    >
                      <Link2
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Produtos Equivalentes
                    </button>

                    {/* Produtos Relacionados */}
                    <button
                      onClick={() => handleRelacionados(produto)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Ver produtos relacionados/complementares"
                    >
                      <Package
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Produtos Relacionados
                    </button>

                    {/* Transferência de Armazém */}
                    {userPermissions.editar && (
                      <button
                        onClick={() => handleTransferencia(produto)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                        title="Transferir entre armazéns"
                      >
                        <ArrowRightLeft
                          className="mr-2 text-gray-400 dark:text-gray-500"
                          size={16}
                        />
                        Transferir Armazém
                      </button>
                    )}

                    {/* Copiar Produto */}
                    {userPermissions.cadastrar && (
                      <button
                        onClick={() => handleCopiar(produto)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                        title="Criar cópia deste produto"
                      >
                        <Copy
                          className="mr-2 text-gray-400 dark:text-gray-500"
                          size={16}
                        />
                        Copiar Produto
                      </button>
                    )}

                    {/* Excluir */}
                    {userPermissions.remover && (
                      <button
                        onClick={() => handleExcluir(produto)}
                        className="flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 w-full text-left"
                        title="Excluir produto (soft delete)"
                      >
                        <Trash2
                          className="mr-2 text-red-500 dark:text-red-400"
                          size={16}
                        />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>,
                document.body,
              )}
          </div>
        );
      }
      // Demais colunas (dados do produto)
      else {
        linha[coluna] = produto[coluna as keyof typeof produto] ?? '';
      }
    });

    return linha;
  });

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-black dark:text-white">
              Produtos
            </h1>
            {selectedProducts.size > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {selectedProducts.size} selecionado{selectedProducts.size > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {userPermissions.cadastrar && (
              <DefaultButton
                variant="primary"
                size="default"
                onClick={() => {
                  setSelectedRow('');
                  setCadastrarOpen(true);
                }}
                text="Novo"
                icon={<PlusIcon size={16} />}
              />
            )}
          </div>
        </div>

        {/* DataTable */}
        <div className="flex-1 min-h-20 flex flex-col">
        <DataTable
          screenKey="cadastro-produtos"
          userName={user?.usuario}
          carregando={loading}
          headers={headers}
          rows={rows || []}
          semColunaDeAcaoPadrao={true}
          nonsortableColumns={['Ações', 'selecionar']}
          onColunaSubstituida={handleColunaSubstituida}
          meta={produtos.meta}
          onPageChange={(newPage) => {
            if (newPage !== page) {
              setPage(newPage);
              fetchProdutos({ page: newPage, perPage, search, filtros });
            }
          }}
          onPerPageChange={(newPerPage) => {
            if (newPerPage !== perPage) {
              setPerPage(newPerPage);
              fetchProdutos({ page, perPage: newPerPage, search, filtros });
            }
          }}
          onSearch={(e) => setSearch(e.target.value)}
          onSearchBlur={() => debouncedSearchUnico(search)}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') debouncedSearchUnico(search);
          }}
          searchInputPlaceholder="Digite pelo menos 3 caracteres para buscar..."
          noDataMessage={!search || search.length < 3 ? (
            <div className="flex flex-col items-center">
              <BsBoxes className="dark:text-blue-200 text-[#347AB6]" size={60} />
              <div className="text-center font-bold dark:text-blue-200 text-[#347AB6] mt-3">PESQUISAR UM PRODUTO</div>
              <div className="text-[#347AB6] dark:text-blue-200 text-xs mt-1">Digite pelo menos 3 caracteres e pressione enter...</div>
            </div>
          ) : 'Nenhum produto encontrado'}
          colunasFiltro={colunasDbProd}
          onExportarExcel={handleExportarExcel}
          onFiltroChange={(novosFiltros) => {
            setFiltros(novosFiltros);
            fetchProdutos({ page: 1, perPage, search, filtros: novosFiltros });
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem('limiteColunasProutos', novoLimite.toString());
          }}
          // Ações customizadas no header
          customHeaderActions={
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Ações Coletivas
              </DropdownMenuLabel>

              {userPermissions.editar && (
                <DropdownMenuItem onClick={handleAlteracaoMassa}>
                  <Edit3 className="mr-2 size-4 text-blue-500 dark:text-blue-300" />
                  Alteração em Massa
                </DropdownMenuItem>
              )}

              {userPermissions.editar && (
                <DropdownMenuItem onClick={handleTransferenciaMassa}>
                  <ArrowRightLeft className="mr-2 size-4 text-green-500 dark:text-green-300" />
                  Transferência de Armazém
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Seleção
              </DropdownMenuLabel>

              <DropdownMenuItem onClick={toggleSelectAll}>
                <Checkbox
                  checked={selectAll}
                  className="mr-2 size-4 pointer-events-none"
                />
                {selectAll ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </DropdownMenuItem>
            </>
          }
        />
        </div>
      </main>

      <CadastrarProduto
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={recarregarLista}
        title="Cadastrar Produto"
      >
        <div className="space-y-2">
          {selectedRow &&
            Object.entries(selectedRow).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {value?.toString()}
              </div>
            ))}
        </div>
      </CadastrarProduto>

      <EditarProduto
        isOpen={editarOpen}
        onClose={() => {
          setEditarOpen(false);
          setIdProduto('');
          setSelectedRow(null);
        }}
        onSuccess={recarregarLista}
        title="Editar Produto"
        produtoId={idProduto}
      >
        <div className="space-y-2">
          {selectedRow &&
            Object.entries(selectedRow).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {value?.toString()}
              </div>
            ))}
        </div>
      </EditarProduto>

      {/* Modal ZOOM (Inspeção) */}
      <ProdutoZoomModal
        isOpen={isZoomOpen}
        onClose={() => {
          setIsZoomOpen(false);
          setProdutoToZoom(null);
        }}
        produto={produtoToZoom}
      />

      {/* Modal Copiar Produto */}
      <CopiarProdutoModal
        isOpen={isCopiarOpen}
        onClose={() => {
          setIsCopiarOpen(false);
          setProdutoToCopiar(null);
        }}
        produtoOriginal={produtoToCopiar}
        onSuccess={handleCopiarSuccess}
      />

      {/* Modal Alteração em Massa */}
      <AlteracaoMassaModal
        isOpen={isAlteracaoMassaOpen}
        onClose={() => setIsAlteracaoMassaOpen(false)}
        selectedProducts={selectedProducts}
        onSuccess={handleAlteracaoMassaSuccess}
      />

      {/* Modal Demanda */}
      <DemandaModal
        isOpen={isDemandaOpen}
        onClose={() => {
          setIsDemandaOpen(false);
          setProdutoToDemanda(null);
        }}
        produto={produtoToDemanda}
      />

      {/* Modal Extrato de Item */}
      <ExtratoItemModal
        isOpen={isExtratoOpen}
        onClose={() => {
          setIsExtratoOpen(false);
          setProdutoToExtrato(null);
        }}
        produto={produtoToExtrato}
      />

      {/* Modal Produtos Equivalentes */}
      <ProdutosEquivalentesModal
        isOpen={isEquivalentesOpen}
        onClose={() => {
          setIsEquivalentesOpen(false);
          setProdutoToEquivalentes(null);
        }}
        produto={produtoToEquivalentes}
        onZoom={(produto) => {
          setProdutoToZoom(produto);
          setIsZoomOpen(true);
        }}
      />

      {/* Modal Produtos Relacionados */}
      <ProdutosRelacionadosModal
        isOpen={isRelacionadosOpen}
        onClose={() => {
          setIsRelacionadosOpen(false);
          setProdutoToRelacionados(null);
        }}
        produto={produtoToRelacionados}
        onZoom={(produto) => {
          setProdutoToZoom(produto);
          setIsZoomOpen(true);
        }}
      />

      {/* Modal Transferência de Armazém (Individual) */}
      <TransferenciaArmazemModal
        isOpen={isTransferenciaOpen}
        onClose={() => {
          setIsTransferenciaOpen(false);
          setProdutoToTransferencia(null);
        }}
        produto={produtoToTransferencia}
        onSuccess={handleTransferenciaSuccess}
      />

      {/* Modal Transferência de Armazém em Massa */}
      <TransferenciaArmazemMassaModal
        isOpen={isTransferenciaMassaOpen}
        onClose={() => setIsTransferenciaMassaOpen(false)}
        selectedProducts={selectedProducts}
        onSuccess={handleTransferenciaSuccess}
      />
    </div>
  );
};

export default ProdutosPage;
