import React, { useEffect, useState, useRef, useContext } from 'react';
import { Vendas, getVendas, Venda } from '@/data/vendas/vendas';
import { useDebounce } from 'use-debounce';
import {
  CircleChevronDown,
  PlusIcon,
  Pencil,
  Eye,
  Lock,
  Trash2,
  Copy,
  FileText,
} from 'lucide-react';

import DataTable from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import SelectInput from '@/components/common/SelectPadrao'; // NOSSO COMPONENTE PADRÃO
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import ModalVerItensVenda from '../centralVendas/ModalVerItensVenda';
import CompartilharOrcamentoModal from '../centralVendas/CompartilharOrcamentoModal';
import NovaVendaV2 from '../novaVendaV2';
import ModalAnaliseLiberacao from '../bloqueadas/ModalAnaliseLiberacao';
import ModalEditarVendaFinalizada from './ModalEditarVendaFinalizada';
import { useRouter } from 'next/router';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Tipos e Interfaces
type SortDir = 'asc' | 'desc';
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

type VendaStatus =
  | 'faturada'
  | 'finalizada'
  | 'salva'
  | 'salva2'
  | 'todas'
  | 'combinadas'
  | 'bloqueada'
  | undefined;

// --- Constantes ---
const statusOptions = [
  { value: 'combinadas', label: 'Não Faturadas + Orçadas' },
  { value: 'todas', label: 'Todas' },
  { value: 'salva', label: 'Orçadas' },
  { value: 'salva2', label: 'Orçadas Vencidas' },
  { value: 'faturada', label: 'Faturadas' },
  { value: 'finalizada', label: 'Não Faturadas' },
  { value: 'bloqueada', label: 'Bloqueadas' },
  { value: 'cancelada', label: 'Canceladas' }, // <— NOVO
];

// --- Componente Principal ---
const VendasPage = () => {
  // coluna atualmente escolhida para a busca
  const [searchField, setSearchField] = useState<string>('todos');

  const [codVenda, setCodVenda] = useState<string>('');
  const [debouncedCodvendFilter] = useDebounce(codVenda, 500);
  const prevSearchRef = useRef<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<VendaStatus>(() => {
    if (typeof window !== 'undefined') {
      const filtroInicial = sessionStorage.getItem('centralV2_filtroInicial');
      if (filtroInicial) {
        sessionStorage.removeItem('centralV2_filtroInicial');
        if (['combinadas', 'todas', 'salva', 'salva2', 'faturada', 'finalizada', 'bloqueada', 'cancelada'].includes(filtroInicial)) {
          return filtroInicial as VendaStatus;
        }
      }
    }
    return 'combinadas';
  });
  const { dismiss, toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [delStep, setDelStep] = React.useState<
    'idle' | 'enviando' | 'ok' | 'erro'
  >('idle');
  const [delMsg, setDelMsg] = React.useState('');
  const [draftIdAlvo, setDraftIdAlvo] = React.useState<string | null>(null);

  // NOVO: Estado para armazenar o código do vendedor associado ao usuário
  const [vendedorUsuario, setVendedorUsuario] = useState<string | null>(null);
  const [isLoadingVendedor, setIsLoadingVendedor] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string | null>('data');
  const [sortDir, setSortDir] = useState<SortDir>('desc'); // Padrão: 'desc' (mais recente/maior)
  const [modalDesbloqueio, setModalDesbloqueio] = useState(false);
  const [codvendaDesbloqueio, setCodvendaDesbloqueio] = useState('');
  const [modalEditarFinalizada, setModalEditarFinalizada] = useState(false);
  const [codvendaEditarFinalizada, setCodvendaEditarFinalizada] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [listaVendedores, setListaVendedores] = useState<{codvend: string; nome: string}[]>([]);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [codvendaCancelar, setCodvendaCancelar] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [modalNovaVenda, setModalNovaVenda] = useState(() => {
    try { return sessionStorage.getItem('centralV2_modalAberto') === 'novaVenda'; } catch { return false; }
  });
  const [confirmarLimparVenda, setConfirmarLimparVenda] = useState(false);
  const [novaVendaKey, setNovaVendaKey] = useState(0);
  const [vendas, setVendas] = useState<Vendas>({
    data: [],
    meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 },
  });

  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState({
    cadastrar: false,
    editar: false,
    remover: false,
    consultar: true,
  });

  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: string]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: string]: boolean;
  }>({});
  // texto que o usuário está digitando no input

  // termo “confirmado” que vai para o backend (só muda no Enter)
  const [searchTerm, setSearchTerm] = useState<string | null>(null);

  // Seleção por teclado
  const [linhaSelecionada, setLinhaSelecionada] = useState(-1);
  const linhaSelecionadaRef = useRef(-1);
  linhaSelecionadaRef.current = linhaSelecionada;

  const [verItensOpen, setVerItensOpen] = useState(false);
  const [vendaComItensParaVer, setVendaComItensParaVer] =
    useState<Venda | null>(null);

  // Estados para o modal de compartilhamento de PDF
  const [compartilharPdfOpen, setCompartilharPdfOpen] = useState(false);
  const [pdfCompartilharData, setPdfCompartilharData] = useState<{
    pdfId: string;
    pdfUrl: string;
    dados: {
      codvenda: string;
      cliente_nome: string;
      total: number;
      total_com_impostos: number;
      data: string;
    };
  } | null>(null);

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);
  // 💡 NOVA FUNÇÃO: Handler de ordenação
  const handleSortChange = (newSortBy: string, newSortDir: SortDir) => {
    setSortBy(newSortBy);
    setSortDir(newSortDir);

    // Se a página atual for diferente de 1, resete para 1 ao ordenar
    if (page !== 1) {
      setPage(1);
    }
    // O useEffect fará a chamada da API
  };
  // NOVA FUNÇÃO: Busca o vendedor associado ao usuário logado
  const buscarVendedorUsuario = async () => {
    if (!user?.usuario) return;

    try {
      setIsLoadingVendedor(true);
      const response = await fetch(`/api/usuarios/vendedor/${user.usuario}`);
      const data = await response.json();

      if (response.ok && data.codvend) {
        setVendedorUsuario(data.codvend);
      } else {
        console.warn('Usuário não possui vendedor associado:', data.error);
        setVendedorUsuario(null);
      }
    } catch (error) {
      console.error('Erro ao buscar vendedor do usuário:', error);
      setVendedorUsuario(null);
      toast({
        title: 'Erro',
        description: 'Não foi possível determinar o vendedor associado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingVendedor(false);
    }
  };

  const isAdmin = user?.perfil === 'ADMINISTRAÇÃO';

  // Carregar lista de vendedores para o filtro do admin
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/vendedores/get?perPage=9999')
      .then(r => r.json())
      .then(data => {
        if (data?.data) {
          setListaVendedores(data.data.map((v: any) => ({ codvend: String(v.codvend).trim(), nome: v.nome || v.NOMERAZAO || '' })));
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  // Para admin: determina o codusr a filtrar (todos ou vendedor específico)
  const codusrFiltro = isAdmin
    ? (filtroVendedor === 'todos' ? undefined : filtroVendedor)
    : user?.codusr;

  async function refreshVendas() {
    setLoading(true);
    try {
      const data = await getVendas({
        page,
        perPage,
        codvend: codusrFiltro,
        status: statusFilter,
        codvendUsuario: codusrFiltro,
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
        search: searchTerm || undefined,
        searchField: searchField || 'todos',
      });

      setVendas(data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error('refreshVendas', e);
    }
  }

  function abrirExcluir(draftId: string) {
    setDraftIdAlvo(draftId);
    setDelStep('idle');
    setDelMsg('Deseja excluir esta venda salva?');
    setDelOpen(true);
  }
  async function confirmarExclusao() {
    if (!draftIdAlvo) return;

    try {
      setDelStep('enviando');
      setDelMsg('Excluindo...');

      const resp = await fetch('/api/vendas/salvar-draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftIdAlvo,
          tipo: 'E',
          header: { tipo: 'E' },
        }),
      });

      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        throw new Error(data?.error || 'Falha ao excluir.');
      }

      setDelStep('ok');
      setDelMsg('Excluída com sucesso.');
      await refreshVendas();
    } catch (e: any) {
      setDelStep('erro');
      setDelMsg(e?.message || 'Erro ao excluir.');
    }
  }

  const handleVendas = async () => {
    setLoading(true);
    try {
      const statusToSend = statusFilter;

      const data = await getVendas({
        page,
        perPage,
        codvend: codusrFiltro,
        status: statusToSend,
        codvendUsuario: codusrFiltro,
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
        search: searchTerm || undefined,
        searchField: searchField || 'todos',
      });
      setLoading(false);

      setVendas(data);
    } catch {
      setLoading(false);
      // ... (seu toast)
    }
  };

  // 2) no SEU useEffect existente (não crie outro):
  useEffect(() => {
    // se o termo de busca efetivo mudou desde a última vez...
    if (prevSearchRef.current !== debouncedCodvendFilter) {
      prevSearchRef.current = debouncedCodvendFilter;

      // ... e não estamos na página 1, volte para 1 e NÃO busque agora
      if (page !== 1) {
        setPage(1);
        return; // evita 2º fetch desnecessário
      }
      // se já estamos na página 1, segue e busca normalmente
    }

    handleVendas();
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    perPage,
    searchTerm,
    statusFilter,
    vendedorUsuario,
    filtroVendedor,
    sortBy,
    sortDir,
  ]);

  // NOVO: useEffect para buscar o vendedor do usuário quando o user for carregado
  useEffect(() => {
    if (user?.usuario) {
      buscarVendedorUsuario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.usuario]);

  // Escutar evento do ícone de desbloqueio no cabeçalho
  useEffect(() => {
    const handler = (e: Event) => {
      const filtro = (e as CustomEvent).detail;
      if (filtro) {
        setStatusFilter(filtro as VendaStatus);
        limparBusca();
        setPage(1);
      }
    };
    window.addEventListener('centralV2:filtro', handler);
    return () => window.removeEventListener('centralV2:filtro', handler);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (verItensOpen || compartilharPdfOpen || delOpen || modalNovaVenda || modalDesbloqueio || modalEditarFinalizada) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'ArrowDown' && !emInput) {
        e.preventDefault();
        const data = vendas.data;
        if (data?.length > 0) setLinhaSelecionada((prev) => Math.min(prev + 1, data.length - 1));
        return;
      }
      if (e.key === 'ArrowUp' && !emInput) {
        e.preventDefault();
        setLinhaSelecionada((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (emInput) return;

      const sel = linhaSelecionadaRef.current;
      const data = vendas.data;

      // Enter ou V: ver itens
      if ((e.key === 'Enter' || e.key === 'v') && sel >= 0 && data?.[sel]) {
        e.preventDefault();
        handleVerItensClick(data[sel]);
        return;
      }
      // E: editar
      if (e.key === 'e' && sel >= 0 && data?.[sel]) {
        e.preventDefault();
        const venda = data[sel] as any;
        if (venda.tipoOrigem === 'SALVA' && userPermissions.editar) {
          handleEditarClick(data[sel]);
        } else if (venda.tipoOrigem === 'VENDA' && venda.status === 'N' && user?.funcoes?.some(function(f: any) { return (typeof f === 'string' ? f : f?.sigla) === 'EVF'; })) {
          setCodvendaEditarFinalizada(venda.codvenda);
          setModalEditarFinalizada(true);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [vendas.data, verItensOpen, compartilharPdfOpen, delOpen, modalNovaVenda, userPermissions]);

  const limparBusca = () => {
    setCodVenda('');
    setSearchTerm(null);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus as VendaStatus);
    limparBusca();
    if (page !== 1) {
      setPage(1);
    }
  };

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        let telaHref = sessionStorage.getItem('telaAtualMelo');
        let telaPerfil: Permissao | undefined;

        if (telaHref) {
          try {
            telaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('telaHref não era um JSON válido', e);
          }
          telaPerfil = user.permissoes.find(
            (permissao) => permissao.tb_telas?.PATH_TELA === telaHref,
          );
        }

        if (telaPerfil) {
          setUserPermissions({
            cadastrar: telaPerfil.cadastrar || false,
            editar: telaPerfil.editar || false,
            remover: telaPerfil.remover || false,
            consultar: telaPerfil.consultar || true,
          });
        }
      }
    };
    checkPermissions();
  }, [user, toast]);

  useEffect(() => {
    if (searchTerm && searchTerm?.length > 2) {
      handleVendas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchField]);

  // depois
  const headers = ['id', 'codcliente', 'data_venda', 'valor_total', 'status', 'action'];

  // dê um pouco mais de folga para Ações (evita cortar)
  const sizes: (number | 'X')[] = [10, 30, 12, 19, 19, 10];

  // FAÇA columnKeys baterem com o que você monta em `rows`
  const columnKeys = [
    'id',
    'codcliente',
    'data_venda',
    'valor_total',
    'status',
    'action',
  ];

  // os sortKeys podem continuar apontando para as CHAVES que seu endpoint entende
  // (muitas vezes diferentes das do row); se o backend espera 'cliente' e 'data', mantenha assim:
  const sortKeys = ['codvenda', 'codcli', 'data', 'total', 'status', null];
  const searchFieldOptions = [
    { value: 'todos', label: 'Todos' },

    ...(sortKeys
      .map((k, i) =>
        k ? { value: String(k), label: headers[i] ?? String(k) } : null,
      )
      .filter(Boolean) as { value: string; label: string }[]),
  ];

  function mapDraftToCarrinho(draft: any) {
    const itens: any[] = draft?.payload?.itens ?? [];
    return itens.map((i) => ({
      // campos que o NovaVenda espera no carrinho
      codigo: String(i.codigo ?? ''),
      descrição: String(i['descrição'] ?? i.descrição ?? ''),
      marca: String(i.marca ?? ''),
      estoque: String(i.estoque ?? '0'),
      preço: String(i['preço'] ?? i.preço ?? i.preco ?? '0'), // <- preço unit.
      ref: String(i.ref ?? ''),
      quantidade: String(i.quantidade ?? '0'),
      descriçãoEditada: String(
        i['descriçãoEditada'] ?? i.descriçãoEditada ?? '',
      ),
      totalItem: String(
        i.totalItem ??
          (
            Number(i.quantidade ?? 0) *
            Number(i.precoItemEditado ?? i['preço'] ?? i.preço ?? 0)
          ).toFixed(2),
      ),
      precoItemEditado: String(
        i.precoItemEditado ?? i['preço'] ?? i.preço ?? '0',
      ),
      tipoPreço: String(i['tipoPreço'] ?? i.tipoPreço ?? ''),
      desconto: Number(i.desconto ?? 0),
      origem: String(i.origem ?? ''),
    }));
  }
  // 👇 Coloque FORA de setStoragesFromDraft (no topo do arquivo, perto de outras helpers)
  function splitLocalEntrega(s?: string | null) {
    if (!s || typeof s !== 'string') return null;
    const [codigo, ...rest] = s.split('-');
    const cod = (codigo ?? '').trim();
    const nome = rest.join('-').trim();
    if (!cod && !nome) return null;
    return { codigo: cod, nome };
  }

  // ✅ Substitua sua função por esta (NÃO mexe em outros trechos)
  function setStoragesFromDraft(draft: any) {
    // --- FUNÇÕES DE APOIO (Inclusas para garantir a funcionalidade de Prazos) ---
    const parsePrazoString = (prazoStr: any) => {
      const s = String(prazoStr ?? '').trim();
      if (!s) return [];

      return s
        .split(' ')
        .map((d) => {
          const num = Number(d.trim());
          // Garante que o número é um finito > 0
          return Number.isFinite(num) && num > 0 ? { dias: num } : null;
        })
        .filter((p) => p !== null);
    };
    // ----------------------------------------------------------------

    // ---------- 1) Carrinho ----------

    const carrinho = mapDraftToCarrinho(draft);

    sessionStorage.setItem('carrinhoMelo', JSON.stringify(carrinho));

    // ---------- 2) Header ----------
    const h = draft?.payload?.header ?? {};

    // === arm_id: do header (preferência) ou consolidado dos itens ===
    let armId = h?.arm_id ?? null;
    if (armId == null) {
      try {
        const itens = Array.isArray(draft?.payload?.itens)
          ? draft.payload.itens
          : [];
        const ids = new Set(
          itens.map((i: any) => i?.arm_id).filter((x: any) => x != null),
        );
        armId = ids.size === 1 ? Array.from(ids)[0] : null;
      } catch {}
    }

    // Snapshot de header completo para Nova Venda ler primeiro
    try {
      const headerSnap = {
        ...h,
        arm_id: armId,
        draft_id: draft?.draft_id ?? draft?.codvenda ?? null,
      };
      sessionStorage.setItem('vendaHeaderMelo', JSON.stringify(headerSnap));
    } catch {}

    // --- Draft id: garante que a Nova Venda saiba que é UPDATE
    try {
      const id = String(draft?.draft_id || draft?.codvenda || '');

      if (id) {
        sessionStorage.setItem('vendaDraftIdMelo', id);
        // também põe no META para a Nova Venda hidratar junto
        const rawMeta = sessionStorage.getItem('metaVendaMelo');
        const meta = rawMeta ? JSON.parse(rawMeta) : {};
        meta.draftId = id;
        sessionStorage.setItem('metaVendaMelo', JSON.stringify(meta));
      }
    } catch {}

    // Cliente (como você já fazia)
    const clienteSelect = {
      codigo: String(h.codcli ?? ''),
      nome: String(h.nomecf ?? ''),
      documento: '',
      nomeFantasia: String(h.nomecf ?? ''),
      saldo: 0,
      status: '',
      desconto: 0,
      IPI: '',
      ICMS: '',
      zona: '',
      CLASPGTO: '',
      UF: '',
      TIPO: '',
      limiteAtraso: 0,
      diasAtrasado: 0,
      tipoPreco: '',
      CODVEND: String(h.vendedor ?? ''),
      FONE: '',
      ENDER: '',
      BAIRRO: '',
      CIDADE: '',
      CEP: '',
      KICKBACK: false,
    };
    sessionStorage.setItem('clienteSelectMelo', JSON.stringify(clienteSelect));

    const dadosClienteSel = {
      codigo: String(h.codcli ?? ''),
      nome: String(h.nomecf ?? ''),
      documento: '',
      nomeFantasia: String(h.nomecf ?? ''),
    };
    sessionStorage.setItem(
      'dadosClienteSelMelo',
      JSON.stringify(dadosClienteSel),
    );

    // ----------------------------------------------------------------
    // 3) Prazos (CORRIGIDO)
    // ----------------------------------------------------------------

    // 1. Tenta obter do array de payload, mapeando para o formato { dias: N } e validando
    let prazos =
      (Array.isArray(draft?.payload?.prazos) && draft.payload.prazos) || [];
    prazos = prazos
      .filter((p: any) => Number(p?.dias ?? p?.dia) > 0)
      .map((p: any) => ({ dias: Number(p.dias ?? p.dia) }));

    // 2. Se o array validado estiver vazio (o que causava o problema de "vista: true"), tenta gerar a partir da string 'h.prazo'
    if (prazos.length === 0 && h.prazo) {
      prazos = parsePrazoString(h.prazo);
    }

    sessionStorage.setItem('prazoVendaMelo', JSON.stringify(prazos));

    // ----------------------------------------------------------------
    // 4) Campos financeiros / pagamento (AGORA SÃO SALVOS DE FORMA MAIS COMPLETA)
    // ----------------------------------------------------------------
    if (h.formaPagamento !== undefined) {
      sessionStorage.setItem(
        'formaPagamentoMelo',
        JSON.stringify(String(h.formaPagamento)), // Garantindo que é String
      );
    }
    if (h.condicaoPagamento !== undefined) {
      sessionStorage.setItem(
        'condicaoPagamentoMelo',
        JSON.stringify(String(h.condicaoPagamento)), // Garantindo que é String
      );
    }
    if (h.prazo !== undefined) {
      sessionStorage.setItem(
        'prazoMelo',
        JSON.stringify(String(h.prazo ?? '')),
      );
    }
    if (h.avista !== undefined) {
      // Adicionado avista, se for relevante
      sessionStorage.setItem('avistaMelo', JSON.stringify(h.avista));
    }

    // --- NOVO: Entrada/Sinal (Busca em múltiplos campos) ---
    const entradaValor = Number(
      h?.sinal ??
        h?.entrada ??
        h?.valorEntrada ??
        h?.vlr_sinal ??
        h?.VLR_ENTRADA ??
        draft?.sinal ??
        draft?.entrada ??
        draft?.valorEntrada ??
        0,
    );
    // Se o valor for maior que zero OU o campo original existe
    if (
      entradaValor > 0 ||
      String(h?.sinal ?? h?.entrada ?? h?.valorEntrada ?? '') !== ''
    ) {
      sessionStorage.setItem('entradaVendaMelo', JSON.stringify(entradaValor));
    }

    // ----------------------------------------------------------------
    // 5) Transporte / frete
    // ----------------------------------------------------------------
    if (h.transp !== undefined) {
      sessionStorage.setItem('transpVendaMelo', JSON.stringify(h.transp));
    }
    if (h.codtptransp !== undefined) {
      sessionStorage.setItem('codtptranspMelo', JSON.stringify(h.codtptransp));
    }
    if (h.vlrfrete !== undefined) {
      sessionStorage.setItem(
        'vlrFreteMelo',
        JSON.stringify(Number(h.vlrfrete) || 0),
      );
    }

    // ----------------------------------------------------------------
    // 6) Desconto / flags / Outros Headers
    // ----------------------------------------------------------------
    if (h.tipo_desc !== undefined) {
      sessionStorage.setItem(
        'tipoDescontoMelo',
        JSON.stringify(String(h.tipo_desc)),
      );
    }
    if (h.obs !== undefined) {
      sessionStorage.setItem('obsVendaMelo', JSON.stringify(String(h.obs)));
    }
    if (h.obsfat !== undefined) {
      sessionStorage.setItem(
        'obsFaturamentoMelo',
        JSON.stringify(String(h.obsfat)),
      );
    }
    if (h.pedido !== undefined) {
      sessionStorage.setItem('nPedidoMelo', JSON.stringify(String(h.pedido)));
    }

    // --- NOVO: Requisição (para campo individual) ---
    if (h.requisicao !== undefined) {
      // draft.payload.header.requisicao (sem acento)
      sessionStorage.setItem(
        'requisicaoMelo',
        JSON.stringify(String(h.requisicao)),
      );
    }
    // ------------------------------------------------

    // ----------------------------------------------------------------
    // 7) Snapshot completo do header (para o Nova Venda usar como fallback)
    // ----------------------------------------------------------------
    const headerSnapshot = {
      codcli: h.codcli ?? null,
      nomecf: h.nomecf ?? null,
      codusr: h.codusr ?? null,
      tipo: h.tipo ?? null,
      transp: h.transp ?? null,
      codtptransp: h.codtptransp ?? null,
      vlrfrete: h.vlrfrete ?? null,
      prazo: h.prazo ?? null,
      prazos, // O array de prazos LIMPO (agora corrigido)
      tipo_desc: h.tipo_desc ?? null,
      obs: h.obs ?? null,
      obsfat: h.obsfat ?? null,
      localentregacliente: h.localentregacliente ?? null,
      vendedor: h.vendedor ?? null,
      operador: h.operador ?? null,
      operacao: h.operacao ?? null,
      pedido: h.pedido ?? null,
      formaPagamento: h.formaPagamento ?? null,
      condicaoPagamento: h.condicaoPagamento ?? null,
      total: draft?.total ?? null,
      // ✅ NOVO: Incluindo avista e requisicao no snapshot
      avista: h.avista ?? null,
      requisicao: h.requisicao ?? null,
      // Campos de bloqueio - preservar status da venda ao reabrir
      statusVenda: h.statusVenda ?? null,
      blocFin: h.blocFin ?? false,
      blocDesc: h.blocDesc ?? false,
      // Flags de liberação pelo gerente
      descLiberado: h.descLiberado ?? false,
      finLiberado: h.finLiberado ?? false,
      // inclua quaisquer outros campos que a tela Nova Venda possa precisar
      // ...
    };
    sessionStorage.setItem('vendaHeaderMelo', JSON.stringify(headerSnapshot));

    // ----------------------------------------------------------------
    // 8) META ÚNICO (chave principal de hidratação de objetos complexos)
    // ----------------------------------------------------------------
    (() => {
      // preserva qualquer meta já salvo (p/ manter draftId, etc.)
      let prev: any = {};
      try {
        const rawPrev = sessionStorage.getItem('metaVendaMelo');
        prev = rawPrev ? JSON.parse(rawPrev) : {};
      } catch {}

      const prazosArray = prazos; // O array de prazos já limpo e corrigido

      const prazoStr = prazosArray.map((p: any) => p.dias).join(' ');

      // Assumindo que você tem uma função 'splitLocalEntrega' disponível
      const localFromHeader =
        typeof h?.localentregacliente === 'string'
          ? splitLocalEntrega(h.localentregacliente) // { codigo, nome } | null
          : null;

      // prioridade: header → meta anterior → cliente
      const localSelFinal = localFromHeader ??
        prev.localSel ?? {
          codigo: String(h?.codcli ?? ''),
          nome: String(h?.nomecf ?? ''),
        };

      // Novo: Valor de entrada do draft, se houver
      const entradaVlr = entradaValor;

      const meta = {
        ...prev, // preserva campos anteriores (ex.: draftId)
        obs: String(h?.obs ?? ''),
        obsFat: String(h?.obsfat ?? ''),
        pedido: String(h?.pedido ?? ''),
        fPagamento: String(h?.formaPagamento ?? ''),

        // ✅ CORREÇÃO 1: Lógica 'vista' - Prioriza o valor explícito, senão se baseia no array de prazos (que agora está correto)
        vista:
          h.avista !== undefined
            ? !!h.avista // Usa o valor explícito do header (true/false)
            : prazosArray.length === 0, // Caso contrário, assume true se não há parcelas.

        prazosArray,
        prazoStr,

        // ✅ CORREÇÃO 2: Requisição (lê 'requisicao' do draft, salva em 'requisição' para o NovaVenda)
        requisição: String(h?.requisicao ?? ''),

        // ✅ NOVO: Entrada
        entrada: entradaVlr,

        // vendedorSel (agora também pega o nome do header)
        vendedorSel:
          h?.vendedor || h?.vendedorNome || draft?.vendedorSel
            ? {
                codigo: String(
                  h?.vendedor ??
                    draft?.vendedorSel?.codigo ??
                    prev?.vendedorSel?.codigo ??
                    '',
                ),
                nome: String(
                  h?.vendedorNome ??
                    draft?.vendedorSel?.nome ??
                    prev?.vendedorSel?.nome ??
                    '',
                ),
              }
            : prev.vendedorSel ?? { codigo: '', nome: '' },

        // operadorSel (mantém sua lógica e aceita draft/prev como fallback)
        operadorSel:
          h?.operador || h?.operadorNome || draft?.operadorSel
            ? {
                codigo: String(
                  h?.operador ??
                    draft?.operadorSel?.codigo ??
                    prev?.operadorSel?.codigo ??
                    '',
                ),
                nome: String(
                  h?.operadorNome ??
                    h?.uName ??
                    draft?.operadorSel?.nome ??
                    prev?.operadorSel?.nome ??
                    '',
                ),
              }
            : prev.operadorSel ?? { codigo: '', nome: '' },

        // checks coerentes com as seleções (adicione logo abaixo dos dois acima)
        checkVendedor:
          typeof (
            h?.checkVendedor ??
            draft?.checkVendedor ??
            prev?.checkVendedor
          ) === 'boolean'
            ? !!(
                h?.checkVendedor ??
                draft?.checkVendedor ??
                prev?.checkVendedor
              )
            : !!(
                (h?.vendedor ??
                  draft?.vendedorSel?.codigo ??
                  prev?.vendedorSel?.codigo) ||
                (h?.vendedorNome ??
                  draft?.vendedorSel?.nome ??
                  prev?.vendedorSel?.nome)
              ),

        checkOperador:
          typeof (
            h?.checkOperador ??
            draft?.checkOperador ??
            prev?.checkOperador
          ) === 'boolean'
            ? !!(
                h?.checkOperador ??
                draft?.checkOperador ??
                prev?.checkOperador
              )
            : !!(
                (h?.operador ??
                  draft?.operadorSel?.codigo ??
                  prev?.operadorSel?.codigo) ||
                (h?.operadorNome ??
                  h?.uName ??
                  draft?.operadorSel?.nome ??
                  prev?.operadorSel?.nome)
              ),

        // ... (o restante dos campos do meta)
        transporteSel: {
          CODTPTRANSP:
            h?.codtptransp != null
              ? String(h.codtptransp)
              : prev?.transporteSel?.CODTPTRANSP ?? '',
          DESCR: String(h?.transp ?? prev?.transporteSel?.DESCR ?? ''),
        },
        localSel: localSelFinal,

        // Campos de bloqueio - preservar status da venda ao reabrir
        statusVenda: h?.statusVenda ?? prev?.statusVenda ?? 'VENDA LIBERADA',
        blocFin: !!(h?.blocFin ?? prev?.blocFin ?? false),
        blocDesc: !!(h?.blocDesc ?? prev?.blocDesc ?? false),
        // Flags de liberação pelo gerente
        descLiberado: !!(h?.descLiberado ?? prev?.descLiberado ?? false),
        finLiberado: !!(h?.finLiberado ?? prev?.finLiberado ?? false),
      };

      try {
        sessionStorage.setItem('metaVendaMelo', JSON.stringify(meta));
      } catch {}
    })();
  }

  const toggleDropdown = (
    vendaId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...Object.keys(prevStates).reduce(
        (acc, key) => ({ ...acc, [key]: false }),
        {},
      ),
      [vendaId]: !prevStates[vendaId],
    }));
    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [vendaId]: !prevRotations[vendaId],
    }));
    if (!dropdownStates[vendaId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions({
        [vendaId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      });
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };
  // 1) Coloque isso perto dos seus hooks/estados, acima do return:
  const getSearchPlaceholder = (field?: string) => {
    const f = String(field ?? 'todas').toLowerCase();
    switch (f) {
      case 'codvenda':
      case 'id':
        return 'Pesquisar por ID da Venda...';
      case 'codcli':
      case 'cliente':
        return 'Pesquisar por Cliente (código, nome ou fantasia)...';
      case 'data':
        return 'Pesquisar por Data (DD/MM/AAAA ou DD/MM)...';
      case 'total':
        return 'Pesquisar por Valor (ex.: 1.234,56)...';
      case 'status':
        return 'Pesquisar por Status (F, N, B, C)...';
      case 'todas':
      case 'todos':
      default:
        return 'Pesquisar em todas as colunas...';
    }
  };

  // se quiser evitar recalcular a cada render:
  const searchPlaceholder = React.useMemo(
    () => getSearchPlaceholder(searchField),
    [searchField],
  );

  // pages/corpo/vendas/CentralVendas/index.tsx  (onde está VendasPage)
  const NOVA_VENDA_PATH = '/vendas/novaVenda';
  // LIMPA o que a tela /vendas/novaVenda pode ler para um carrinho antigo
  function limparStoragesNovaVenda() {
    try {
      const KEYS = [
        // carrinho / cliente / prazos
        'carrinhoMelo',
        'clienteSelectMelo',
        'dadosClienteSelMelo',
        'prazoVendaMelo',
        'prazoMelo',

        // identificadores / rascunho
        'nPedidoMelo',
        'vendaDraftIdMelo',

        // header/snapshot e totais
        'vendaHeaderMelo',
        'totalVendaMelo',

        // pagamento / condições
        'formaPagamentoMelo',
        'condicaoPagamentoMelo',

        // transporte / frete
        'transpVendaMelo',
        'codtptranspMelo',
        'vlrFreteMelo',
        'localEntregaClienteMelo',

        // observações
        'obsVendaMelo',
        'obsFaturamentoMelo',

        // vendedor / operador / operação / tipo
        'vendedorMelo',
        'operadorMelo',
        'operacaoMelo',
        'tipoVendaMelo',

        // flags e descontos
        'tipoDescontoMelo',
        'vendaTeleMelo',
        'bloqueadaMelo',
        'estoqueVirtualMelo',

        // preço do cliente
        'precoClienteMelo',

        // META(s)
        'metaVendaMelo',
        'novaVendaMetaMelo', // legado, se existir
      ];

      KEYS.forEach((k) => {
        try {
          sessionStorage.removeItem(k);
        } catch {}
      });
    } catch {}
  }

  function handleNovaVendaClick() {
    setModalNovaVenda(true);
    sessionStorage.setItem('centralV2_modalAberto', 'novaVenda');
  }

  function fecharModalNovaVenda() {
    setModalNovaVenda(false);
    sessionStorage.removeItem('centralV2_modalAberto');
  }

  // Constrói um "draft-like" a partir de uma VENDA finalizada (dbvenda)
  function buildDraftFromVendaForCopy(vendaItem: any) {
    const itens = Array.isArray(vendaItem?.dbitvenda)
      ? vendaItem.dbitvenda
      : [];

    const itensDraft = itens.map((i: any) => {
      const codprod = i?.codprod ?? i?.dbprod?.codprod ?? '';
      const descr = i?.dbprod?.descr ?? i?.descr ?? '';
      const qtd = Number(i?.qtd ?? 0) || 0;

      // preço unitário: prunit (ou prvenda)
      const unit = Number(i?.prunit ?? i?.prvenda ?? 0) || 0;

      const desconto = Number(i?.desconto ?? 0) || 0;
      const marca = i?.dbprod?.dbmarcas?.descr ?? '';
      const estoque = Number(i?.dbprod?.qtest ?? 0) || 0;
      const origem = i?.dbprod?.origem ?? '';
      const ref = i?.ref ?? '';

      return {
        // campos que seu setStoragesFromDraft -> mapDraftToCarrinho consome
        codigo: String(codprod),
        descrição: String(descr),
        marca: String(marca),
        estoque: String(estoque),
        preço: String(unit),
        ref: String(ref),
        quantidade: String(qtd),
        descriçãoEditada: String(descr),

        // estes aqui garantem o mesmo cálculo do seu editor de drafts
        precoItemEditado: String(unit),
        desconto,
        origem,
        // os "totais" por item o editor recalcula; manter não atrapalha
        totalItem: String(unit * (1 - desconto / 100) * qtd),
      };
    });

    const header = {
      codcli: vendaItem?.codcli ?? null,
      nomecf:
        (vendaItem?.dbclien?.nomefant || vendaItem?.dbclien?.nome) ?? null,
      // demais campos podem ficar null/undefined; a tela novaVenda recalcula/solicita
      // arm_id consolidado a partir dos itens finalizados
      arm_id: (() => {
        const itens = Array.isArray(vendaItem?.dbitvenda)
          ? vendaItem.dbitvenda
          : [];
        const ids = new Set(
          itens.map((it: any) => it?.arm_id).filter((x: any) => x != null),
        );
        return ids.size === 1 ? Array.from(ids)[0] : null;
      })(),
    };

    return {
      draft_id: 'atualizar', // força a nova venda a recalcular preços
      payload: {
        header,
        itens: itensDraft,
      },
      total: vendaItem?.total ?? null,
      codvenda: vendaItem?.codvenda ?? null,
    };
  }

  const handleCopiarClick = (vendaItem: any) => {
    try {
      const userKey = `novaVendaV2_draft_${user?.usuario || 'anon'}`;

      // Montar dados para o modal NovaVendaV2 (mesmo padrão do Editar)
      let itens: any[] = [];
      let header: any = {};

      if (vendaItem?.tipoOrigem === 'SALVA2') {
        // Orçada Excluída: usar dados do draft se disponível
        const draftOriginal = (vendaItem as any)?.draft;
        if (draftOriginal) {
          const payload = typeof draftOriginal.payload === 'string' ? JSON.parse(draftOriginal.payload) : draftOriginal.payload;
          header = payload?.header || {};
          itens = payload?.itens || [];
        } else {
          header = { codcli: vendaItem?.codcli, nomecf: vendaItem?.dbclien?.nomefant || vendaItem?.dbclien?.nome || '' };
          itens = Array.isArray(vendaItem?.dbitvenda) ? vendaItem.dbitvenda : [];
        }
      } else if (vendaItem?.tipoOrigem === 'VENDA') {
        // Vendas F/N/B/C: usar itens da venda
        header = { codcli: vendaItem?.codcli, nomecf: vendaItem?.dbclien?.nomefant || vendaItem?.dbclien?.nome || '' };
        itens = Array.isArray(vendaItem?.dbitvenda) ? vendaItem.dbitvenda : [];
      } else {
        toast({
          title: 'Ação não disponível',
          description: 'Copiar só aparece para vendas finalizadas ou orçadas vencidas.',
          variant: 'destructive',
        });
        return;
      }

      // Montar draft no formato V2 (SEM draft_id — é cópia, não edição)
      const draftData = {
        draftId: null, // cópia = nova venda, sem vínculo ao original
        clienteSelecionado: {
          codcli: header.codcli || vendaItem?.codcli || null,
          nome: header.nomecf || '',
          nomefant: header.nomecf || '',
          cpfcgc: '', tipo: '', tipoPreco: '',
          limite: 0, debito: 0, saldo: 0,
          codvend: header.vendedor || vendaItem?.codvend || '',
          diasAtrasado: 0, limiteAtraso: 0, kickback: false,
        },
        buscaCliente: `${header.codcli || vendaItem?.codcli || ''} - ${header.nomecf || ''}`,
        vendedorSel: { codigo: header.vendedor || vendaItem?.codvend || '', nome: header.vendedorNome || '' },
        buscaVendedor: header.vendedor ? `${header.vendedor} - ${header.vendedorNome || ''}` : '',
        operadorSel: { codigo: header.operador || '', nome: header.operadorNome || '' },
        buscaOperador: header.operador ? `${header.operador} - ${header.operadorNome || ''}` : '',
        itensGrid: itens.map((it: any) => ({
          codprod: it.codprod || it.codigo, ref: it.ref || '', descr: it.descr || it.descricao || it['descrição'] || '',
          qtd: Number(it.qtd || it.quantidade || 0), prunit: Number(it.prunit || it.precoItemEditado || it['preço'] || 0),
          prvenda_original: Number(it.prvenda_original || it.prunit || 0),
          desconto_percentual: Number(it.desconto || it.desconto_percentual || 0), total_item: Number(it.total_item || 0),
          prcompra: Number(it.prcompra || 0), codmarca: it.codmarca || '', marca_nome: it.marca_nome || it.marca || '',
          origem: it.origem || 'N', estoque: Number(it.estoque || 0),
        })),
        documento: { COD_OPERACAO: '1', DESCR: '' },
        prazo: '', prazosArray: [],
        fPagamento: '',
        transporteSel: { CODTPTRANSP: '002', DESCR: 'CARRO (MELO)' },
        valTransp: 'R$ 0,00', valTranspDec: 0,
        obsFat: '', pedido: '', obs: '', requisicao: '',
      };

      sessionStorage.setItem(userKey, JSON.stringify(draftData));
      sessionStorage.setItem('centralV2_modalAberto', 'novaVenda');
      setModalNovaVenda(true);
    } catch (err) {
      console.error('Erro ao copiar venda:', err);
      toast({
        title: 'Falha ao copiar',
        description: 'Não foi possível copiar esta venda.',
        variant: 'destructive',
      });
    } finally {
      closeAllDropdowns();
    }
  };

  const handleEditarClick = (venda: Venda) => {
    try {
      if ((venda as any)?.tipoOrigem === 'SALVA' && (venda as any)?.draft) {
        const draft = (venda as any).draft;
        const payload = typeof draft.payload === 'string' ? JSON.parse(draft.payload) : draft.payload;
        const header = payload?.header || {};
        const itens = payload?.itens || [];
        const prazos = payload?.prazos || [];

        // Salvar dados do draft no sessionStorage para a Nova Venda V2 carregar
        const userKey = `novaVendaV2_draft_${user?.usuario || 'anon'}`;
        const draftData = {
          draftId: draft.draft_id || null,
          clienteSelecionado: {
            codcli: header.codcli || draft.codcli,
            nome: header.nomecf || draft.cliente_nome || '',
            nomefant: header.nomecf || draft.cliente_nome || '',
            cpfcgc: '', tipo: '', tipoPreco: '',
            limite: 0, debito: 0, saldo: 0,
            codvend: header.vendedor || '',
            diasAtrasado: 0, limiteAtraso: 0, kickback: false,
          },
          buscaCliente: `${header.codcli || draft.codcli} - ${header.nomecf || draft.cliente_nome || ''}`,
          vendedorSel: { codigo: header.vendedor || '', nome: header.vendedorNome || '' },
          buscaVendedor: header.vendedor ? `${header.vendedor} - ${header.vendedorNome || ''}` : '',
          operadorSel: { codigo: header.operador || '', nome: header.operadorNome || '' },
          buscaOperador: header.operador ? `${header.operador} - ${header.operadorNome || ''}` : '',
          itensGrid: itens.map((it: any) => ({
            codprod: it.codprod || it.codigo, ref: it.ref || '', descr: it.descr || it.descricao || '',
            qtd: Number(it.qtd || it.quantidade || 0), prunit: Number(it.prunit || it.precoItemEditado || 0),
            prvenda_original: Number(it.prvenda_original || it.prunit || 0),
            desconto_percentual: Number(it.desconto || 0), total_item: Number(it.total_item || 0),
            prcompra: Number(it.prcompra || 0), codmarca: it.codmarca || '', marca_nome: it.marca_nome || '',
            origem: it.origem || 'N', estoque: Number(it.estoque || 0),
          })),
          documento: { COD_OPERACAO: String(header.operacao || '1'), DESCR: '' },
          prazo: header.prazo || '',
          prazosArray: prazos.map((p: any, i: number) => ({ id: i + 1, dataVencimento: p.data, dias: Number(p.dia || p.dias || 0) })),
          fPagamento: header.formaPagamento || '',
          transporteSel: { CODTPTRANSP: header.codtptransp ? String(header.codtptransp) : '002', DESCR: header.transp || 'CARRO (MELO)' },
          valTransp: Number(header.vlrfrete || 0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' }),
          valTranspDec: Number(header.vlrfrete || 0),
          obsFat: header.obsfat || '', pedido: header.pedido || '',
          obs: header.obs || '', requisicao: header.requisicao || '',
        };

        sessionStorage.setItem(userKey, JSON.stringify(draftData));
        sessionStorage.setItem('centralV2_modalAberto', 'novaVenda');
        setModalNovaVenda(true);
        return;
      }

      toast({
        title: 'Não é possível editar',
        description: 'Esta venda não possui rascunho para reabrir.',
        variant: 'destructive',
      });
    } finally {
      closeAllDropdowns();
    }
  };

  const handleVerItensClick = (venda: Venda) => {
    setVendaComItensParaVer(venda);
    setVerItensOpen(true);
    closeAllDropdowns();
  };

  const handleCloseVerItensModal = () => {
    setVerItensOpen(false);
    setVendaComItensParaVer(null);
  };

  // Gerar PDF de orçamento e abrir modal de compartilhamento
  const handleGerarPdf = async (venda: Venda) => {
    try {
      closeAllDropdowns();

      toast({
        title: 'Gerando PDF...',
        description: 'Aguarde enquanto o orçamento é gerado.',
      });

      // Buscar os dados do draft para gerar o PDF
      const draftData = (venda as any)?.draft;
      if (!draftData) {
        toast({
          title: 'Erro',
          description: 'Dados do orçamento não encontrados.',
          variant: 'destructive',
        });
        return;
      }

      // Chamar a nova API para gerar o PDF e obter o ID
      const response = await fetch('/api/vendas/orcamento-pdf/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftData.draft_id,
          codvenda: venda.codvenda,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar PDF');
      }

      const result = await response.json();

      // Abrir modal de compartilhamento com os dados do PDF
      setPdfCompartilharData({
        pdfId: result.pdf_id,
        pdfUrl: result.pdf_url,
        nomeArquivo: result.nome_arquivo,
        draftId: draftData.draft_id,
        codvenda: venda.codvenda,
        dados: result.dados,
      });
      setCompartilharPdfOpen(true);

      toast({
        title: 'PDF gerado com sucesso!',
        description: 'Escolha como deseja compartilhar o orçamento.',
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  // Fechar modal de compartilhamento
  const handleCloseCompartilharModal = () => {
    setCompartilharPdfOpen(false);
    setPdfCompartilharData(null);
  };

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      let shouldClose = false;
      for (const vendaId in dropdownStates) {
        if (dropdownStates[vendaId]) {
          const dropdownNode = dropdownRefs.current[vendaId];
          const actionButtonNode = actionButtonRefs.current[vendaId];
          if (
            dropdownNode &&
            !dropdownNode.contains(_event.target as Node) &&
            actionButtonNode &&
            !actionButtonNode.contains(_event.target as Node)
          ) {
            shouldClose = true;
            break;
          }
        }
      }
      if (shouldClose) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [dropdownStates]);

  const rows = vendas.data?.map((vendaItem) => {
    const valorNumerico = vendaItem.total
      ? parseFloat(vendaItem.total as any)
      : 0;
    const isEditable = vendaItem.tipoOrigem === 'SALVA';
    const isBloqueada = (vendaItem as any).status === 'B';

    // ID exibido:
    // - drafts (SALVA/SALVA2): usa draft.draft_id (fallback para codvenda já que no SELECT codvenda recebe o draft_id)
    // - vendas (VENDA): usa codvenda
    const id =
      vendaItem.tipoOrigem === 'VENDA'
        ? String(vendaItem.codvenda ?? '')
        : String(
            (vendaItem as any)?.draft?.draft_id ?? vendaItem.codvenda ?? '',
          );

    return {
      // 👇 garantir que a coluna ID apareça primeiro
      id,

      codcliente: vendaItem.dbclien?.nomefant || vendaItem.dbclien?.nome,
      data_venda: vendaItem.data
        ? (() => {
            // Extrair yyyy-mm-dd da string ISO para evitar bug de timezone
            const d = String(vendaItem.data).substring(0, 10).split('-');
            return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : new Date(vendaItem.data).toLocaleDateString('pt-BR');
          })()
        : 'N/A',
      valor_total: valorNumerico.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      status: (() => {
        if (vendaItem.tipoOrigem === 'SALVA') {
          return (
            <span className="px-2.5 py-1 text-sm font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-900/50 rounded-full">
              Orçada
            </span>
          );
        }
        if (vendaItem.tipoOrigem === 'SALVA2') {
          return (
            <span className="px-2.5 py-1 text-sm font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-900/50 rounded-full">
              Orçada Vencida
            </span>
          );
        }
        switch (vendaItem.status) {
          case 'F':
            return (
              <span className="px-2.5 py-1 text-sm font-semibold text-blue-800 bg-blue-100 dark:text-blue-100 dark:bg-blue-900/50 rounded-full">
                Faturada
              </span>
            );
          case 'B':
            return (
              <span className="px-2.5 py-1 text-sm font-semibold text-blue-800 bg-blue-100 dark:text-blue-100 dark:bg-blue-900/50 rounded-full">
                Bloqueada
              </span>
            );
          case 'C':
            return (
              <span className="px-2.5 py-1 text-sm font-semibold text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-900/50 rounded-full">
                Cancelada
              </span>
            );
          case 'N':
          default:
            return (
              <span className="px-2.5 py-1 text-sm font-semibold text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-900/50 rounded-full">
                Não Faturada
              </span>
            );
        }
      })(),
      action: (
        <div className="relative">
          <button
            ref={(el) => {
              if (el) actionButtonRefs.current[vendaItem.codvenda] = el;
            }}
            onClick={(e) => toggleDropdown(vendaItem.codvenda, e.currentTarget)}
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[vendaItem.codvenda]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
          {dropdownStates[vendaItem.codvenda] &&
            dropdownPositions[vendaItem.codvenda] &&
            createPortal(
              <div
                key={`portal-dropdown-${vendaItem.codvenda}`}
                ref={(el) => {
                  if (el) dropdownRefs.current[vendaItem.codvenda] = el;
                }}
                className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
                style={{
                  position: 'absolute',
                  top: dropdownPositions[vendaItem.codvenda]?.top,
                  left: dropdownPositions[vendaItem.codvenda]?.left,
                  minWidth: '144px',
                  borderRadius: '0.375rem',
                  boxShadow:
                    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                  zIndex: 1000,
                }}
              >
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    key={`view-items-${vendaItem.codvenda}`}
                    onClick={() => handleVerItensClick(vendaItem)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                    role="menuitem"
                  >
                    <Eye
                      className="mr-2 text-blue-500 dark:text-blue-400"
                      size={16}
                    />
                    Ver Itens
                  </button>

                  {/* Botão de gerar PDF - apenas para orçamentos (SALVA ou SALVA2) */}
                  {(vendaItem.tipoOrigem === 'SALVA' ||
                    vendaItem.tipoOrigem === 'SALVA2') && (
                    <button
                      key={`pdf-${vendaItem.codvenda}`}
                      onClick={() => handleGerarPdf(vendaItem)}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                      title="Gerar PDF do Orçamento"
                    >
                      <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#DC2626" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#EF4444" />
                        <text x="12" y="17" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">PDF</text>
                      </svg>
                      Gerar PDF
                    </button>
                  )}
                  {(vendaItem.tipoOrigem === 'SALVA' ||
                    vendaItem.tipoOrigem === 'SALVA2') && (
                    <button
                      key={`excel-${vendaItem.codvenda}`}
                      onClick={async () => {
                        closeAllDropdowns();
                        const draftData = (vendaItem as any)?.draft;
                        if (!draftData?.draft_id) { toast({ title: 'Erro', description: 'Draft não disponível.', variant: 'destructive' }); return; }
                        try {
                          toast({ title: 'Gerando Excel...' });
                          const resp = await fetch('/api/vendas/orcamento-pdf/gerar-excel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ draft_id: draftData.draft_id, codvenda: vendaItem.codvenda }),
                          });
                          if (!resp.ok) throw new Error('Erro ao gerar Excel');
                          const blob = await resp.blob();
                          const codcli = String(vendaItem.codcli || 'sem_cliente').replace(/[^a-zA-Z0-9_-]/g, '');
                          const ts = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
                          const xlsName = 'venda_' + codcli + '_' + ts + '.xlsx';
                          if ('showSaveFilePicker' in window) {
                            try {
                              const handle = await (window as any).showSaveFilePicker({ suggestedName: xlsName, types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
                              const writable = await handle.createWritable();
                              await writable.write(blob);
                              await writable.close();
                              toast({ title: 'Excel salvo!' });
                              return;
                            } catch (err: any) { if (err?.name === 'AbortError') return; }
                          }
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = xlsName; a.click();
                          URL.revokeObjectURL(url);
                        } catch (err: any) {
                          toast({ title: 'Erro ao gerar Excel', description: err.message, variant: 'destructive' });
                        }
                      }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                      title="Gerar Excel do Orçamento"
                    >
                      <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill="#16A34A" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" fill="#22C55E" />
                        <text x="12" y="17" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="Arial">XLS</text>
                      </svg>
                      Gerar Excel
                    </button>
                  )}

                  {userPermissions.editar &&
                    (vendaItem.tipoOrigem === 'SALVA' ? (
                      <button
                        key={`edit-${vendaItem.codvenda}`}
                        onClick={() => handleEditarClick(vendaItem)}
                        disabled={!isEditable}
                        className={`flex items-center px-4 py-2 text-sm w-full ${
                          isEditable
                            ? 'hover:bg-gray-100 dark:hover:bg-slate-700'
                            : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                        role="menuitem"
                        title={
                          !isEditable
                            ? 'Vendas finalizadas não podem ser editadas'
                            : 'Editar Venda'
                        }
                      >
                        {isEditable ? (
                          <Pencil
                            className="mr-2 text-gray-400 dark:text-gray-500"
                            size={16}
                          />
                        ) : (
                          <Lock className="mr-2" size={16} />
                        )}
                        Editar
                      </button>
                    ) : (
                      // === SALVA2 / VENDA -> mostra COPIAR no lugar de Editar ===
                      <button
                        key={`copy-${vendaItem.codvenda}`}
                        onClick={() => handleCopiarClick(vendaItem)}
                        className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                        role="menuitem"
                        title="Copiar venda para nova"
                      >
                        <Copy
                          className="mr-2 text-gray-400 dark:text-gray-500"
                          size={16}
                        />
                        Copiar
                      </button>
                    ))}

                  {userPermissions.remover && isEditable && (
                    <button
                      key={`del-${vendaItem.codvenda}`}
                      onClick={() => abrirExcluir(vendaItem.codvenda)}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                      title="Excluir venda salva"
                    >
                      <Trash2
                        className="mr-2 text-red-600 dark:text-red-400"
                        size={16}
                      />
                      Excluir
                    </button>
                  )}

                  {isBloqueada && user?.funcoes?.some(function(f: any) { return (typeof f === 'string' ? f : f?.sigla) === 'DBV'; }) && (
                    <button
                      key={`desbloq-${vendaItem.codvenda}`}
                      onClick={() => {
                        setCodvendaDesbloqueio(vendaItem.codvenda);
                        setModalDesbloqueio(true);
                        closeAllDropdowns();
                      }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                      title="Analisar e desbloquear venda"
                    >
                      <Lock className="mr-2 text-amber-500" size={16} />
                      Desbloquear Venda
                    </button>
                  )}

                  {/* Editar Venda Finalizada — só aparece para vendas não faturadas (VENDA + status N) e se o user tem função EVF */}
                  {vendaItem.tipoOrigem === 'VENDA' && vendaItem.status === 'N' && user?.funcoes?.some(function(f: any) { return (typeof f === 'string' ? f : f?.sigla) === 'EVF'; }) && (
                    <button
                      key={`editar-finalizada-${vendaItem.codvenda}`}
                      onClick={() => {
                        setCodvendaEditarFinalizada(vendaItem.codvenda);
                        setModalEditarFinalizada(true);
                        closeAllDropdowns();
                      }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                      title="Editar venda finalizada (não faturada)"
                    >
                      <Pencil className="mr-2 text-blue-500" size={16} />
                      Editar Venda
                    </button>
                  )}

                  {/* Cancelar Venda — só vendas não faturadas (VENDA + status N) */}
                  {vendaItem.tipoOrigem === 'VENDA' && vendaItem.status === 'N' && (
                    <button
                      key={`cancelar-${vendaItem.codvenda}`}
                      onClick={() => {
                        setCodvendaCancelar(vendaItem.codvenda);
                        setConfirmCancelar(true);
                        closeAllDropdowns();
                      }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-red-600"
                      role="menuitem"
                      title="Cancelar venda e liberar estoque"
                    >
                      <Trash2 className="mr-2" size={16} />
                      Cancelar Venda
                    </button>
                  )}

                </div>
              </div>,
              document.body,
            )}
        </div>
      ),
    };
  });

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        <header className="mb-4 mx-6">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
                Central de Vendas
              </h1>
              {isLoadingVendedor && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Carregando informações do vendedor...
                </div>
              )}

              {!isLoadingVendedor && !vendedorUsuario && (
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Nenhum vendedor associado - exibindo todas as vendas
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              {isAdmin && (
                <div className="w-52">
                  <SelectInput
                    name="filtroVendedor"
                    options={[
                      { value: 'todos', label: 'Todos os Vendedores' },
                      ...listaVendedores.map(v => ({ value: v.codvend, label: `${v.codvend} — ${v.nome}` })),
                    ]}
                    defaultValue={filtroVendedor}
                    onValueChange={(val: string) => { setFiltroVendedor(val); setPage(1); }}
                  />
                </div>
              )}
              <div className="w-40">
                <SelectInput
                  name="statusFilter"
                  options={statusOptions}
                  value={statusFilter}
                  onValueChange={handleStatusChange}
                />
              </div>

              {userPermissions.cadastrar && (
                <DefaultButton
                  onClick={handleNovaVendaClick}
                  className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800 whitespace-nowrap min-w-fit"
                  text="Nova Venda"
                  icon={<PlusIcon size={18} />}
                />
              )}
            </div>
          </div>
        </header>

        <style>{`
          .central-v2-grid table tbody tr td { padding-top: 8px !important; padding-bottom: 8px !important; }
        `}</style>
        <div className="flex-1 min-h-20 flex flex-col central-v2-grid">
        <DataTable
          screenKey="central-vendas-v2"
          userName={user?.usuario}
          headers={headers}
          rows={rows || []}
          meta={vendas.meta}
          columnLabels={{
            id: 'ID',
            codcliente: 'Cliente',
            data_venda: 'Data',
            valor_total: 'Valor Total',
            status: 'Status',
            action: 'Ações',
          }}
          carregando={loading}
          semColunaDeAcaoPadrao={true}
          nonsortableColumns={['action']}
          filtrarSomenteAoConfirmar={true}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          searchValue={codVenda}
          onSearch={(e) => {
            const v = e.target.value;
            setCodVenda(v);
            if (v.trim().length === 0) {
              setSearchTerm(null);
              if (page !== 1) setPage(1);
            }
          }}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = codVenda.trim();
              if (v.length === 0) {
                setSearchTerm(null);
                if (page !== 1) setPage(1);
                return;
              }
              if (v.length >= 3) {
                setSearchTerm(v);
                if (page !== 1) setPage(1);
              }
            }
          }}
          searchInputPlaceholder={searchPlaceholder}
          noDataMessage="Nenhuma venda encontrada."
          onSort={(column, direction) => {
            const keyMap: Record<string, string> = { id: 'codvenda', codcliente: 'codcli', data_venda: 'data', valor_total: 'total', status: 'status' };
            handleSortChange(keyMap[column] || column, direction);
          }}
          rowClassName={(_row: any, idx: any) => idx === linhaSelecionada ? 'bg-blue-50 dark:bg-blue-950' : ''}
          onRowClick={(row: any) => {
            const data = vendas.data;
            if (data) {
              const idx = data.findIndex((v: any) => v.id === row.id);
              if (idx >= 0) setLinhaSelecionada(idx);
            }
          }}
        />
        </div>
      </main>

      <ModalVerItensVenda
        isOpen={verItensOpen}
        onClose={handleCloseVerItensModal}
        venda={vendaComItensParaVer}
      />

      {/* Modal de compartilhamento de PDF */}
      {pdfCompartilharData && (
        <CompartilharOrcamentoModal
          open={compartilharPdfOpen}
          onClose={handleCloseCompartilharModal}
          pdfId={pdfCompartilharData.pdfId}
          pdfUrl={pdfCompartilharData.pdfUrl}
          nomeArquivo={pdfCompartilharData.nomeArquivo}
          draftId={pdfCompartilharData.draftId}
          codvenda={pdfCompartilharData.codvenda}
          dados={pdfCompartilharData.dados}
        />
      )}
      {delOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h2 className="mb-2 text-lg font-bold">
              {delStep === 'idle' && 'Excluir venda salva'}
              {delStep === 'enviando' && 'Processando...'}
              {delStep === 'ok' && 'Concluído'}
              {delStep === 'erro' && 'Erro'}
            </h2>

            <p className="text-sm text-gray-700">{delMsg}</p>

            <div className="mt-4 flex justify-end gap-2">
              {delStep === 'idle' && (
                <>
                  <button
                    className="rounded bg-gray-200 px-3 py-1 text-sm"
                    onClick={() => setDelOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                    onClick={confirmarExclusao}
                  >
                    Excluir
                  </button>
                </>
              )}

              {delStep === 'enviando' && (
                <button
                  className="rounded bg-gray-300 px-3 py-1 text-sm"
                  disabled
                >
                  Aguarde...
                </button>
              )}

              {(delStep === 'ok' || delStep === 'erro') && (
                <button
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                  onClick={() => setDelOpen(false)}
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Desbloqueio de Venda */}
      {modalDesbloqueio && codvendaDesbloqueio ? (
        <ModalAnaliseLiberacao
          isOpen={modalDesbloqueio}
          onClose={() => { setModalDesbloqueio(false); setCodvendaDesbloqueio(''); }}
          codvenda={codvendaDesbloqueio}
          onLiberar={() => { setModalDesbloqueio(false); setCodvendaDesbloqueio(''); limparBusca(); refreshVendas(); }}
        />
      ) : null}

      {/* Modal Editar Venda Finalizada */}
      {modalEditarFinalizada && codvendaEditarFinalizada ? (
        <ModalEditarVendaFinalizada
          isOpen={modalEditarFinalizada}
          onClose={() => { setModalEditarFinalizada(false); setCodvendaEditarFinalizada(''); }}
          codvenda={codvendaEditarFinalizada}
          onSalvar={() => { setModalEditarFinalizada(false); setCodvendaEditarFinalizada(''); limparBusca(); refreshVendas(); }}
        />
      ) : null}

      {/* Confirmação Cancelar Venda */}
      {confirmCancelar ? (
        <AlertDialog open={true} onOpenChange={() => { if (!cancelando) setConfirmCancelar(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar venda {codvendaCancelar}?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>A venda será <strong>cancelada permanentemente</strong> e o estoque reservado será <strong>liberado</strong>.</p>
                  <p className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                disabled={cancelando}
                className="bg-red-600 hover:bg-red-700"
                onClick={async (e) => {
                  e.preventDefault();
                  setCancelando(true);
                  try {
                    const resp = await fetch('/api/vendas/cancelar-venda', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ codvenda: codvendaCancelar, usuario: user?.usuario || 'SISTEMA' }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || 'Erro ao cancelar');
                    toast({ title: 'Venda cancelada', description: data.message });
                    setConfirmCancelar(false);
                    setCodvendaCancelar('');
                    refreshVendas();
                  } catch (err: any) {
                    toast({ title: 'Erro ao cancelar', description: err.message, variant: 'destructive' });
                  } finally {
                    setCancelando(false);
                  }
                }}
              >
                {cancelando ? 'Cancelando...' : 'Confirmar — Cancelar Venda'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* Modal Nova Venda V2 */}
      {modalNovaVenda ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between px-5 py-2.5 border-b-2 border-[#347AB6]/20 dark:border-zinc-700 bg-gradient-to-r from-[#347AB6]/5 to-transparent dark:from-zinc-800 dark:to-zinc-900">
            <h2 className="text-xl font-bold text-[#347AB6] dark:text-gray-100 tracking-tight">Nova Venda</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmarLimparVenda(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-300 dark:border-red-700 rounded-lg transition-colors"
                title="Limpar venda e começar nova"
              >
                <Trash2 size={14} />
                Limpar Venda
              </button>
              <button
                onClick={fecharModalNovaVenda}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-500 hover:text-gray-700 transition-colors"
                title="Fechar (Esc)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <NovaVendaV2 key={novaVendaKey} onSaved={() => { fecharModalNovaVenda(); refreshVendas(); }} />
          </div>

          {/* Confirmação Limpar Venda */}
          {confirmarLimparVenda ? (
            <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setConfirmarLimparVenda(false)}>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Limpar venda?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Todos os dados da venda atual serão apagados (itens, cliente, prazo, etc). Deseja realmente começar uma nova venda do zero?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmarLimparVenda(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      // Limpar draft do sessionStorage
                      const userKey = `novaVendaV2_draft_${user?.usuario || 'anon'}`;
                      try { sessionStorage.removeItem(userKey); } catch {}
                      // Forçar remontagem da NovaVendaV2 com nova key
                      setNovaVendaKey((k) => k + 1);
                      setConfirmarLimparVenda(false);
                      toast({ title: 'Venda limpa', description: 'Todos os dados foram removidos. Comece uma nova venda.' });
                    }}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Sim, limpar tudo
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default VendasPage;
