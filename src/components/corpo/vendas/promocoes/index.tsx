import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import {
  Promocoes,
  getPromocoes,
  deletarPromocao,
  Promocao,
} from '@/data/promocoes/promocoes';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2, Eye, Keyboard } from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import DataTable from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarPromocaoModal from './modalCadastrarPromocao';
import EditarPromocaoModal from './modalEditarPromocao';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';
import ModalVerItensPromocao from './ModalVerItensPromocao';
import { PromocaoComItensFixos } from '@/data/promocoes/promocoes';
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

interface ConfirmDeletePromocaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  promocaoId?: number | null;
  onConfirm: (id: number) => Promise<void>;
}

const ConfirmDeletePromocaoModal: React.FC<ConfirmDeletePromocaoModalProps> = ({
  isOpen,
  onClose,
  promocaoId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (promocaoId !== null && promocaoId !== undefined) {
      try {
        await onConfirm(promocaoId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar a Promoção. Tente mais tarde ou comunique a equipe técnica.',
        );
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[80%] h-[60%] flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {deleteStatus === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que deseja remover permanentemente a promoção com ID
                &quot;{promocaoId}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando a Promoção..." />
            </div>
          )}
          {deleteStatus === 'success' && (
            <div className="flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <p className="text-lg font-semibold text-green-600">
                Deletado com sucesso!
              </p>
            </div>
          )}
          {deleteStatus === 'error' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">
                Erro ao Excluir
              </h2>
              <p className="text-red-500 dark:text-red-400 mb-4">
                {errorMessage}
              </p>
            </div>
          )}
        </div>
        {(deleteStatus === 'idle' || deleteStatus === 'error') && (
          <div className="flex justify-end gap-2">
            {deleteStatus === 'error' && (
              <DefaultButton
                onClick={() => setDeleteStatus('idle')}
                variant="secondary"
                text="Fechar"
              />
            )}
            {deleteStatus === 'idle' && (
              <>
                <DefaultButton
                  onClick={onClose}
                  variant="cancel"
                  text="Cancelar"
                />
                <DefaultButton
                  onClick={handleConfirm}
                  variant="confirm"
                  text="Sim, Excluir"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PromocoesPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [idPromocaoDeletar, setIdPromocaoDeletar] = useState<number | null>(
    null,
  );
  const [promocaoParaEditar, setPromocaoParaEditar] = useState<Promocao | null>(
    null,
  );
  const [promocoes, setPromocoes] = useState({} as Promocoes);
  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  const [dropdownStates, setDropdownStates] = useState<{
    [key: number]: boolean;
  }>({});
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: number]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: number]: boolean;
  }>({});

  const [verItensOpen, setVerItensOpen] = useState(false);
  const [promocaoComItensParaVer, setPromocaoComItensParaVer] =
    useState<Promocao | null>(null);
  const [linhaSelecionada, setLinhaSelecionada] = useState<number>(-1);

  // Atalhos de teclado na tela principal
  const linhaSelecionadaRef = useRef(linhaSelecionada);
  linhaSelecionadaRef.current = linhaSelecionada;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (cadastrarOpen || editarOpen || deletarOpen || verItensOpen) return;

      const data = promocoes.data;
      if (!data || data.length === 0) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const sel = linhaSelecionadaRef.current;

      // Setas funcionam mesmo com foco no input
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLinhaSelecionada((prev) => Math.min(prev + 1, data.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLinhaSelecionada((prev) => Math.max(prev - 1, 0));
        return;
      }

      // Os demais só funcionam fora de inputs
      if (emInput) return;

      if (e.key === 'Enter' && sel >= 0 && userPermissions.editar) {
        e.preventDefault();
        handleEditarClick(data[sel]);
      } else if (e.key === 'Delete' && sel >= 0 && userPermissions.remover) {
        e.preventDefault();
        handleDeletarClick(data[sel].id_promocao);
      } else if (e.ctrlKey && e.key === 'n' && userPermissions.cadastrar) {
        e.preventDefault();
        setCadastrarOpen(true);
      } else if (e.key === 'v' && sel >= 0) {
        e.preventDefault();
        handleVerItensClick(data[sel]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [promocoes.data, cadastrarOpen, editarOpen, deletarOpen, verItensOpen, userPermissions]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    handlePromocoes(1, perPage, value);
  }, 400);

  const handlePromocoes = useCallback(async (p?: number, pp?: number, s?: string) => {
    setLoading(true);
    try {
      const data = await getPromocoes({
        page: p ?? page,
        perPage: pp ?? perPage,
        search: s ?? search,
      });
      setPromocoes(data);
    } catch (error) {
      console.error('Erro ao buscar promoções:', error);
      toast({
        title: 'Erro ao carregar promoções',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, toast]);

  useEffect(() => {
    handlePromocoes();
    dismiss(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

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
    };
    checkPermissions();
  }, [user, toast]);

  // Headers no padrão do DataTablePadrao
  const headers = [
    'ações',
    'nome_promocao',
    'status',
    'valor_desconto',
    'data_inicio',
    'data_fim',
    'qtd_itens',
    'total_vendido_promo',
    'total_vendido_fora',
    'total_faturado_promo',
    'total_faturado_fora',
    'margem_custo_compra',
    'margem_custo_medio',
    'qtde_minima_ativacao',
    'qtde_maxima_total',
    'qtde_maxima_por_cliente',
    'criado_por',
    'criado_em',
    'descricao_promocao',
    'observacoes',
  ];

  // Rótulos customizados para as colunas
  const columnLabels: Record<string, string> = {
    ações: 'Ações',
    nome_promocao: 'Nome',
    status: 'Status',
    valor_desconto: 'Desconto',
    data_inicio: 'Início',
    data_fim: 'Fim',
    qtd_itens: 'Qtd Itens',
    total_vendido_promo: 'Vend. Promoção',
    total_vendido_fora: 'Vend. Fora Promo',
    total_faturado_promo: 'Fat. Promoção',
    total_faturado_fora: 'Fat. Fora Promo',
    margem_custo_compra: 'Margem Compra %',
    margem_custo_medio: 'Margem Médio %',
    qtde_minima_ativacao: 'Qtd Mín. Ativação',
    qtde_maxima_total: 'Qtd Máx. Total',
    qtde_maxima_por_cliente: 'Qtd Máx. Cliente',
    criado_por: 'Criado Por',
    criado_em: 'Criado Em',
    descricao_promocao: 'Descrição',
    observacoes: 'Observações',
  };

  const toggleDropdown = (
    promocaoId: number,
    buttonElement: HTMLButtonElement,
  ) => {
    const wasOpen = dropdownStates[promocaoId];
    closeAllDropdowns();

    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 180;
      const estimatedDropdownHeight = 150;

      let leftPosition = rect.right + window.scrollX + 5;
      if (window.innerWidth - rect.right < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      let topPosition;

      if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
        topPosition = rect.bottom + window.scrollY - estimatedDropdownHeight + 10;
      } else {
        topPosition = rect.top + window.scrollY;
      }

      setDropdownStates({ [promocaoId]: true });
      setIconRotations({ [promocaoId]: true });
      setDropdownPositions({ [promocaoId]: { top: topPosition, left: leftPosition } });
    }
  };

  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  const handleEditarClick = (promocao: Promocao) => {
    setPromocaoParaEditar({
      ...promocao,
      itens_promocao:
        promocao.itens_promocao?.map((item: any) => ({
          id_promocao_item: item.id_promocao_item,
          id_promocao: item.id_promocao,
          codprod: item.codigo ?? null,
          codgpp: item.codgpp ?? null,
          valor_desconto_item: item.valor_desconto_item ?? null,
          tipo_desconto_item: item.tipo_desconto_item ?? null,
          qtde_minima_item: item.qtde_minima_item ?? null,
          qtde_maxima_item: item.qtde_maxima_item ?? null,
          qtdvendido: item.qtdvendido ?? null,
          qtdfaturado: item.qtdfaturado ?? null,
          qtd_total_item: item.qtd_total_item ?? null,
          codigo: item.codigo || '',
          descricao: item.descricao,
          qtdVendido: item.qtdvendido ?? 0,
          qtdFaturado: item.qtdfaturado ?? 0,
          origem: item.origem ?? '',
          marca: item.marca ?? '',
          ref: item.ref ?? '',
          qtddisponivel: item.qtddisponivel ?? 0,
          preco: item.prvenda ?? 0,
          prcompra: item.prcompra ?? 0,
          prcustoatual: item.prcustoatual ?? 0,
          preco_promocao: item.preco_promocao ?? 0,
          margem_custo_compra: item.margem_custo_compra ?? 0,
          margem_custo_medio: item.margem_custo_medio ?? 0,
          margem_tabela: item.margem_tabela ?? 0,
          qtd_vendida_fora: item.qtd_vendida_fora ?? 0,
          qtd_faturada_fora: item.qtd_faturada_fora ?? 0,
        })) ?? [],
    });

    setEditarOpen(true);
    closeAllDropdowns();
  };

  const handleDeletarClick = (promocaoId: number) => {
    setIdPromocaoDeletar(promocaoId);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleVerItensClick = (promocao: Promocao) => {
    setPromocaoComItensParaVer(promocao);
    setVerItensOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDelete = async (idToDelete: number) => {
    try {
      await deletarPromocao(idToDelete);
      toast({
        title: 'Promoção deletada',
        description: `Promoção com ID ${idToDelete} deletada com sucesso!`,
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar promoção',
        description: error.message || 'Ocorreu um erro ao deletar a promoção.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setDeletarOpen(false);
      setIdPromocaoDeletar(null);
      await handlePromocoes();
    }
  };

  const handleCancelDelete = () => {
    setDeletarOpen(false);
    setIdPromocaoDeletar(null);
  };

  const handleCloseVerItensModal = () => {
    setVerItensOpen(false);
    setPromocaoComItensParaVer(null);
  };

  // Exportar para Excel
  const handleExportarExcel = useCallback(async () => {
    if (!promocoes.data || promocoes.data.length === 0) {
      toast({ description: 'Nenhuma promoção para exportar', variant: 'destructive' });
      return;
    }
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Promoções');

      const colunasExport = headers.filter(h => h !== 'ações');
      ws.columns = colunasExport.map(col => ({
        header: columnLabels[col] || col,
        key: col,
        width: 20,
      }));

      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      promocoes.data.forEach((promo) => {
        const row: Record<string, any> = {};
        const itens = promo.itens_promocao || [];
        colunasExport.forEach(col => {
          if (col === 'data_inicio' || col === 'data_fim') {
            row[col] = promo[col] ? new Date(promo[col]).toLocaleDateString('pt-BR') : '';
          } else if (col === 'criado_em') {
            row[col] = promo.criado_em ? new Date(promo.criado_em).toLocaleDateString('pt-BR') : '';
          } else if (col === 'status') {
            const agora = new Date();
            const inicio = new Date(promo.data_inicio);
            const fim = new Date(promo.data_fim);
            const qtdMax = Number(promo.qtde_maxima_total) || 0;
            const totalVend = itens.reduce((a: number, i: any) => a + (Number(i.qtdVendido) || 0) + (Number(i.qtd_vendida_fora) || 0), 0);
            if (!promo.ativa) row[col] = 'Desativada';
            else if (agora < inicio) row[col] = 'Agendada';
            else if (agora > fim) row[col] = 'Expirada';
            else if (qtdMax > 0 && totalVend >= qtdMax) row[col] = 'Esgotada';
            else row[col] = 'Ativa';
          } else if (col === 'qtd_itens') {
            row[col] = itens.length;
          } else if (col === 'valor_desconto') {
            row[col] = parseFloat(Number(promo.valor_desconto).toFixed(2)) + '%';
          } else if (col === 'total_vendido_promo') {
            row[col] = itens.reduce((acc: number, i: any) => acc + (Number(i.qtdVendido) || 0), 0);
          } else if (col === 'total_vendido_fora') {
            row[col] = itens.reduce((acc: number, i: any) => acc + (Number(i.qtd_vendida_fora) || 0), 0);
          } else if (col === 'total_faturado_promo') {
            row[col] = itens.reduce((acc: number, i: any) => acc + (Number(i.qtdFaturado) || 0), 0);
          } else if (col === 'total_faturado_fora') {
            row[col] = itens.reduce((acc: number, i: any) => acc + (Number(i.qtd_faturada_fora) || 0), 0);
          } else if (col === 'margem_custo_compra' || col === 'margem_custo_medio') {
            let totalPreco = 0, totalCusto = 0;
            itens.forEach((i: any) => {
              const qtd = Number(i.qtdVendido) || 1;
              totalPreco += (Number(i.preco_promocao) || 0) * qtd;
              const custo = col === 'margem_custo_medio'
                ? (Number(i.prcustoatual) > 0 ? Number(i.prcustoatual) : Number(i.prcompra) || 0)
                : (Number(i.prcompra) || 0);
              totalCusto += custo * qtd;
            });
            row[col] = totalCusto > 0 ? ((totalPreco / totalCusto - 1) * 100).toFixed(2) + '%' : '0%';
          } else if (col === 'tipo_desconto') {
            row[col] = tipoDescontoLabel[promo.tipo_desconto] || promo.tipo_desconto;
          } else {
            row[col] = (promo as any)[col] ?? '';
          }
        });
        ws.addRow(row);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'promocoes.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ description: 'Promoções exportadas com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ description: 'Erro ao exportar promoções', variant: 'destructive' });
    }
  }, [promocoes.data, headers, toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const promocaoId in dropdownStates) {
        if (dropdownStates[promocaoId]) {
          const dropdownNode = dropdownRefs.current[parseInt(promocaoId, 10)];
          const actionButtonNode =
            actionButtonRefs.current[parseInt(promocaoId, 10)];
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
      if (shouldClose) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mouseup', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [dropdownStates, closeAllDropdowns]);

  const tipoDescontoLabel: Record<string, string> = {
    PERC: '% Percentual',
    VALO: 'Valor Fixo',
    PREF: 'Preço Final',
  };

  const rows = promocoes.data?.map((promocaoItem) => {
    const linha: Record<string, any> = {};

    headers.forEach((coluna) => {
      if (coluna === 'ações') {
        linha[coluna] = (
          <div className="relative flex items-center justify-center">
            <button
              ref={(el) => {
                if (el) actionButtonRefs.current[promocaoItem.id_promocao] = el;
              }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 ${
                iconRotations[promocaoItem.id_promocao] ? 'rotate-180' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown(promocaoItem.id_promocao, e.currentTarget);
              }}
              aria-label="Ações da promoção"
            >
              <CircleChevronDown size={18} />
            </button>

            {dropdownStates[promocaoItem.id_promocao] &&
              dropdownPositions[promocaoItem.id_promocao] &&
              createPortal(
                <div
                  ref={(el) => {
                    if (el) dropdownRefs.current[promocaoItem.id_promocao] = el;
                  }}
                  className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5"
                  style={{
                    position: 'absolute',
                    top: dropdownPositions[promocaoItem.id_promocao]?.top,
                    left: dropdownPositions[promocaoItem.id_promocao]?.left,
                    minWidth: '160px',
                    zIndex: 999,
                  }}
                >
                  <div className="py-1" role="menu">
                    <button
                      onClick={() => handleVerItensClick(promocaoItem)}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      role="menuitem"
                    >
                      <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                      Ver Itens
                    </button>
                    {userPermissions.editar ? (
                      <button
                        onClick={() => handleEditarClick(promocaoItem)}
                        className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                        role="menuitem"
                      >
                        <Pencil className="mr-2 text-gray-400 dark:text-gray-500" size={16} />
                        Editar
                      </button>
                    ) : null}
                    {userPermissions.remover ? (
                      <button
                        onClick={() => handleDeletarClick(promocaoItem.id_promocao)}
                        className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 w-full text-left"
                        role="menuitem"
                      >
                        <Trash2 className="mr-2 text-red-400 dark:text-gray-500" size={16} />
                        Deletar
                      </button>
                    ) : null}
                  </div>
                </div>,
                document.body,
              )}
          </div>
        );
      } else if (coluna === 'data_inicio' || coluna === 'data_fim') {
        const val = (promocaoItem as any)[coluna];
        linha[coluna] = val ? new Date(val).toLocaleDateString('pt-BR') : '';
      } else if (coluna === 'criado_em') {
        linha[coluna] = promocaoItem.criado_em
          ? new Date(promocaoItem.criado_em).toLocaleDateString('pt-BR')
          : '';
      } else if (coluna === 'status') {
        const agora = new Date();
        const inicio = new Date(promocaoItem.data_inicio);
        const fim = new Date(promocaoItem.data_fim);
        const itens = promocaoItem.itens_promocao || [];
        const qtdMaxTotal = Number(promocaoItem.qtde_maxima_total) || 0;
        const totalVendido = itens.reduce(
          (acc: number, item: any) => acc + (Number(item.qtdVendido) || 0) + (Number(item.qtd_vendida_fora) || 0), 0
        );

        let statusLabel = '';
        let statusClass = '';

        if (!promocaoItem.ativa) {
          statusLabel = 'Desativada';
          statusClass = 'text-red-500 bg-red-50 dark:bg-red-950';
        } else if (agora < inicio) {
          statusLabel = 'Agendada';
          statusClass = 'text-blue-600 bg-blue-50 dark:bg-blue-950';
        } else if (agora > fim) {
          statusLabel = 'Expirada';
          statusClass = 'text-gray-500 bg-gray-100 dark:bg-gray-800';
        } else if (qtdMaxTotal > 0 && totalVendido >= qtdMaxTotal) {
          statusLabel = 'Esgotada';
          statusClass = 'text-orange-600 bg-orange-50 dark:bg-orange-950';
        } else {
          statusLabel = 'Ativa';
          statusClass = 'text-green-600 bg-green-50 dark:bg-green-950';
        }

        linha[coluna] = (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        );
      } else if (coluna === 'qtd_itens') {
        linha[coluna] = promocaoItem.itens_promocao?.length || 0;
      } else if (coluna === 'valor_desconto') {
        linha[coluna] = parseFloat(Number(promocaoItem.valor_desconto).toFixed(2)) + '%';
      } else if (coluna === 'tipo_desconto') {
        linha[coluna] = tipoDescontoLabel[promocaoItem.tipo_desconto] || promocaoItem.tipo_desconto;
      } else if (coluna === 'total_vendido_promo') {
        // Soma qtdVendido de todos os itens
        const total = promocaoItem.itens_promocao?.reduce(
          (acc: number, item: any) => acc + (Number(item.qtdVendido) || 0), 0
        ) || 0;
        linha[coluna] = total;
      } else if (coluna === 'total_vendido_fora') {
        // Soma qtd_vendida_fora de todos os itens
        const total = promocaoItem.itens_promocao?.reduce(
          (acc: number, item: any) => acc + (Number(item.qtd_vendida_fora) || 0), 0
        ) || 0;
        linha[coluna] = total;
      } else if (coluna === 'total_faturado_promo') {
        const total = promocaoItem.itens_promocao?.reduce(
          (acc: number, item: any) => acc + (Number(item.qtdFaturado) || 0), 0
        ) || 0;
        linha[coluna] = total;
      } else if (coluna === 'total_faturado_fora') {
        const total = promocaoItem.itens_promocao?.reduce(
          (acc: number, item: any) => acc + (Number(item.qtd_faturada_fora) || 0), 0
        ) || 0;
        linha[coluna] = total;
      } else if (coluna === 'margem_custo_compra') {
        // Margem média ponderada: ((totalPrecoPromo) / (totalCustoCompra) - 1) * 100
        const itens = promocaoItem.itens_promocao || [];
        let totalPrecoPromo = 0;
        let totalCustoCompra = 0;
        itens.forEach((item: any) => {
          const qtd = Number(item.qtdVendido) || 1;
          totalPrecoPromo += (Number(item.preco_promocao) || 0) * qtd;
          totalCustoCompra += (Number(item.prcompra) || 0) * qtd;
        });
        const margem = totalCustoCompra > 0
          ? ((totalPrecoPromo / totalCustoCompra) - 1) * 100
          : 0;
        linha[coluna] = (
          <span className={margem < 0 ? 'text-red-500 font-semibold' : ''}>
            {margem.toFixed(2)}%
          </span>
        );
      } else if (coluna === 'margem_custo_medio') {
        // Margem média ponderada com prcustoatual (fallback prcompra como Delphi)
        const itens = promocaoItem.itens_promocao || [];
        let totalPrecoPromo = 0;
        let totalCustoMedio = 0;
        itens.forEach((item: any) => {
          const qtd = Number(item.qtdVendido) || 1;
          const custoMedio = Number(item.prcustoatual) > 0
            ? Number(item.prcustoatual)
            : (Number(item.prcompra) || 0);
          totalPrecoPromo += (Number(item.preco_promocao) || 0) * qtd;
          totalCustoMedio += custoMedio * qtd;
        });
        const margem = totalCustoMedio > 0
          ? ((totalPrecoPromo / totalCustoMedio) - 1) * 100
          : 0;
        linha[coluna] = (
          <span className={margem < 0 ? 'text-red-500 font-semibold' : ''}>
            {margem.toFixed(2)}%
          </span>
        );
      } else {
        linha[coluna] = (promocaoItem as any)[coluna] ?? '';
      }
    });

    return linha;
  });

  const promoSelecionada = linhaSelecionada >= 0 && promocoes.data?.[linhaSelecionada]
    ? promocoes.data[linhaSelecionada]
    : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Cabeçalho */}
        <header className="mb-2">
          <div className="flex justify-between items-center mb-2 px-2">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Promoções
            </div>
            {userPermissions.cadastrar ? (
              <DefaultButton
                onClick={() => setCadastrarOpen(true)}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Nova"
                icon={<PlusIcon size={18} />}
              />
            ) : null}
          </div>
        </header>

        {/* DataTable Padrão */}
        <div className="flex-1 min-h-20 flex flex-col">
        <DataTable
          screenKey="vendas-promocoes"
          userName={user?.usuario}
          carregando={loading}
          headers={headers}
          rows={rows || []}
          meta={promocoes.meta}
          columnLabels={columnLabels}
          semColunaDeAcaoPadrao={true}
          nonsortableColumns={['ações']}
          onPageChange={(newPage) => {
            if (newPage !== page) {
              setPage(newPage);
            }
          }}
          onPerPageChange={(newPerPage) => {
            if (newPerPage !== perPage) {
              setPerPage(newPerPage);
            }
          }}
          searchValue={search}
          onSearch={(e) => {
            setSearch(e.target.value);
          }}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') {
              handlePromocoes(1, perPage, search);
              setPage(1);
            }
          }}
          onSearchBlur={() => {
            if (search.trim().length >= 3 && search.trim() !== promocoes.data?.[0]?.nome_promocao) {
              handlePromocoes(1, perPage, search);
              setPage(1);
            }
          }}
          filtrarSomenteAoConfirmar={true}
          searchInputPlaceholder="Pesquisar e pressione Enter..."
          noDataMessage="Nenhuma promoção ativa encontrada."
          onExportarExcel={handleExportarExcel}
          rowClassName={(_row, idx) => idx === linhaSelecionada ? 'bg-blue-50 dark:bg-blue-950' : ''}
          onRowClick={(row: any) => {
            const idx = promocoes.data?.findIndex((p) => p.nome_promocao === row.nome_promocao) ?? -1;
            setLinhaSelecionada(idx);
          }}
        />
      </div>

      {/* Modais */}
      <CadastrarPromocaoModal
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={() => handlePromocoes()}
      />
      <EditarPromocaoModal
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        title="Editar Promoção"
        promocao={promocaoParaEditar}
        onSuccess={() => {
          setEditarOpen(false);
          setPromocaoParaEditar(null);
          handlePromocoes();
        }}
      />
      <ConfirmDeletePromocaoModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        promocaoId={idPromocaoDeletar}
        onConfirm={handleConfirmDelete}
      />
      <ModalVerItensPromocao
        isOpen={verItensOpen}
        onClose={handleCloseVerItensModal}
        promocao={promocaoComItensParaVer as PromocaoComItensFixos}
      />
      </main>
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="text-xs text-gray-500">Ações</ContextMenuLabel>
        {userPermissions.cadastrar ? (
          <ContextMenuItem onClick={() => setCadastrarOpen(true)}>
            <PlusIcon size={14} className="mr-2" /> Nova Promoção
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+N</span>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuLabel className="text-xs text-gray-500">
          {promoSelecionada ? `Selecionada: ${promoSelecionada.nome_promocao}` : 'Nenhuma selecionada (use ↑↓)'}
        </ContextMenuLabel>
        <ContextMenuItem
          disabled={!promoSelecionada}
          onClick={() => { if (promoSelecionada) handleVerItensClick(promoSelecionada); }}
        >
          <Eye size={14} className="mr-2" /> Ver Itens
          <span className="ml-auto text-[10px] text-gray-400">V</span>
        </ContextMenuItem>
        {userPermissions.editar ? (
          <ContextMenuItem
            disabled={!promoSelecionada}
            onClick={() => { if (promoSelecionada) handleEditarClick(promoSelecionada); }}
          >
            <Pencil size={14} className="mr-2" /> Editar
            <span className="ml-auto text-[10px] text-gray-400">Enter</span>
          </ContextMenuItem>
        ) : null}
        {userPermissions.remover ? (
          <ContextMenuItem
            disabled={!promoSelecionada}
            onClick={() => { if (promoSelecionada) handleDeletarClick(promoSelecionada.id_promocao); }}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 size={14} className="mr-2" /> Excluir
            <span className="ml-auto text-[10px] text-gray-400">Delete</span>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuLabel className="text-xs text-gray-400">
          <Keyboard size={12} className="inline mr-1" />
          ↑↓ navegar | Enter editar | V ver itens | Delete excluir
        </ContextMenuLabel>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default PromocoesPage;
