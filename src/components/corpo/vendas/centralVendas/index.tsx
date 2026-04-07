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

import DataTable from '@/components/common/DataTableNova'; //para 5 colunas
import { DefaultButton } from '@/components/common/Buttons';
import SelectInput from '@/components/common/SelectInput'; // NOSSO COMPONENTE PADRÃO
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import ModalVerItensVenda from './ModalVerItensVenda';
import CompartilharOrcamentoModal from './CompartilharOrcamentoModal';
import { useRouter } from 'next/router';

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
  const [statusFilter, setStatusFilter] = useState<VendaStatus>('combinadas');
  const { dismiss, toast } = useToast();
  const router = useRouter();
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

  async function refreshVendas() {
    setLoading(true);
    try {
      const data = await getVendas({
        page,
        perPage,
        codvend: user?.codusr,

        codvendUsuario: user?.codusr || undefined,
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

      refreshVendas();
      setDelStep('ok');
      setDelMsg('Excluída com sucesso.');

      // recarrega a lista com seus próprios filtros atuais
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
        codvend: user?.codusr,
        status: statusToSend,
        codvendUsuario: user?.codusr || undefined,
        // 💡 NOVOS PARÂMETROS PARA A API
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

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus as VendaStatus);
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
  const headers = ['ID', 'Cliente', 'Data', 'Valor Total', 'Status', 'Ações'];

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
    // zera estado anterior
    limparStoragesNovaVenda();

    // diz ao roteador raiz qual tela abrir
    sessionStorage.setItem('telaAtualMelo', JSON.stringify(NOVA_VENDA_PATH));

    // navega via index (igual ao Editar)
    router.replace('/');
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
      // 1) limpa storages da nova venda (mesmo que o Editar faz)
      limparStoragesNovaVenda();

      if (vendaItem?.tipoOrigem === 'SALVA2') {
        // Orçada Excluída: usa o mesmo draft do Editar, mas com draft_id = 'atualizar'
        const draftOriginal = (vendaItem as any)?.draft;
        if (draftOriginal) {
          const draftAtualizar = {
            ...draftOriginal,
            draft_id: 'atualizar',
          };
          setStoragesFromDraft(draftAtualizar);
        } else {
          // fallback: se não vier o draft acoplado, tente aproveitar os dados da linha
          const draftLike = buildDraftFromVendaForCopy(vendaItem);
          setStoragesFromDraft(draftLike as any);
        }
      } else if (vendaItem?.tipoOrigem === 'VENDA') {
        // Vendas F/N/B/C: usa os itens que já vêm na lista (dbitvenda) e monta um draft-like
        const draftLike = buildDraftFromVendaForCopy(vendaItem);
        setStoragesFromDraft(draftLike as any);
      } else {
        // Para SALVA mantemos o Editar; este botão Copiar nem aparece para SALVA
        toast({
          title: 'Ação não disponível',
          description:
            'Copiar só aparece para vendas finalizadas ou orçadas vencidas.',
          variant: 'destructive',
        });
        return;
      }

      // 3) mesma navegação do Editar
      sessionStorage.setItem('telaAtualMelo', JSON.stringify(NOVA_VENDA_PATH));
      router.replace('/');
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
        // 1) limpa tudo que a Nova Venda usa (evita resíduo/stale)
        limparStoragesNovaVenda();

        // 2) grava todos os storages que a novavenda precisa a partir do draft
        setStoragesFromDraft((venda as any).draft);

        // 3) indica ao roteador raiz qual tela abrir
        sessionStorage.setItem(
          'telaAtualMelo',
          JSON.stringify(NOVA_VENDA_PATH),
        );

        // 4) navega via index (como o menu faz)
        router.replace('/'); // não use push('/vendas/novaVenda')
        return;
      }

      // Se não veio draft, bloqueia edição
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
        ? new Date(vendaItem.data).toLocaleDateString('pt-BR')
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
                      <FileText
                        className="mr-2 text-green-600 dark:text-green-400"
                        size={16}
                      />
                      Gerar PDF
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
                </div>
              </div>,
              document.body,
            )}
        </div>
      ),
    };
  });

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
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
              <div className="w-40">
                <SelectInput
                  name="statusFilter"
                  options={statusOptions}
                  defaultValue={statusFilter}
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

        <DataTable
          headers={headers}
          sizes={sizes}
          columnKeys={columnKeys}
          sortKeys={sortKeys}
          searchInputPlaceholder={searchPlaceholder}
          rows={rows}
          meta={vendas.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          // antes (linha onde está): onSearch={(e) => setCodVenda(e.target.value)}  :contentReference[oaicite:0]{index=0}
          onSearch={(e) => {
            const v = e.target.value;
            setCodVenda(v);
            if (v.trim().length === 0) {
              setSearchTerm(null); // limpa a busca
              if (page !== 1) setPage(1); // não mexe no select
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
          // Enter é o gatilho, então no blur não faz nada
          onSearchBlur={undefined}
          sortBy={sortBy}
          sortDir={sortDir}
          loading={loading}
          onChangeSort={handleSortChange}
          searchField={searchField}
          searchFieldOptions={searchFieldOptions}
          onSearchFieldChange={(v) => {
            setSearchField(v); // o usuário pode trocar a qualquer momento

            const confirmado = (searchTerm ?? '').trim();
            if (confirmado.length >= 3) {
              // só refaz a busca se já houver termo confirmado, e só via mudança de página
              if (page !== 1) setPage(1);
              // se já está na página 1, não faça nada aqui; não queremos forçar fetch
            }
          }}
        />
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
    </div>
  );
};

export default VendasPage;
