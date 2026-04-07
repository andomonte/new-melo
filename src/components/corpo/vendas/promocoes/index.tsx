import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  Promocoes,
  getPromocoes,
  deletarPromocao,
  Promocao,
} from '@/data/promocoes/promocoes';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2, Eye } from 'lucide-react'; // ✨ Adicionado Eye
import DataTable from '@/components/common/DataTablePromocao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarPromocaoModal from './modalCadastrarPromocao';
import EditarPromocaoModal from './modalEditarPromocao';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';
import ModalVerItensPromocao from './ModalVerItensPromocao'; // ✨ Importado o novo modal
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

  // ✨ Novos estados para o modal de visualização de itens
  const [verItensOpen, setVerItensOpen] = useState(false);
  const [promocaoComItensParaVer, setPromocaoComItensParaVer] =
    useState<Promocao | null>(null);

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    handlePromocoes();
  }, 300);

  const handlePromocoes = async () => {
    try {
      const data = await getPromocoes({ page, perPage, search });

      setPromocoes(data);
    } catch (error) {
      console.error('Erro ao buscar promoções:', error);
      toast({
        title: 'Erro ao carregar promoções',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    handlePromocoes();
    dismiss(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search]);

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

  // AQUI É A MUDANÇA: 'ID' foi removido dos headers visíveis
  const headers = [
    'Nome',
    'Início',
    'Fim',
    'Ativa',
    'qtd Itens',
    'Desconto',
    'Ações',
  ];

  const toggleDropdown = (
    promocaoId: number,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [promocaoId]: !prevStates[promocaoId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [promocaoId]: !prevRotations[promocaoId],
    }));

    if (!dropdownStates[promocaoId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [promocaoId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [promocaoId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

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
          qtddisponivel: item.qtddisponivel ?? 0,
          preco: item.prvenda ?? 0,
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

  // ✨ Nova função para lidar com o clique em "Ver Itens"
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

  // ✨ Função para fechar o modal de visualização de itens
  const handleCloseVerItensModal = () => {
    setVerItensOpen(false);
    setPromocaoComItensParaVer(null); // Limpa a promoção selecionada
  };

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
  }, [dropdownStates]);

  const rows = promocoes.data?.map((promocaoItem) => ({
    // Note que 'id' ainda é mapeado aqui porque é a chave interna que o DataTable pode usar,
    // mas a ordem das colunas no 'headers' define o que é exibido.
    // ✨ Mantido o id para o DataTable (key), e o restante em um objeto separado para as células

    nome_promocao: promocaoItem.nome_promocao,
    data_inicio: new Date(promocaoItem.data_inicio).toLocaleDateString('pt-BR'),
    data_fim: new Date(promocaoItem.data_fim).toLocaleDateString('pt-BR'),
    ativa: promocaoItem.ativa ? 'Sim' : 'Não',
    qtdItens: promocaoItem.itens_promocao?.length || 0,
    valor_desconto:
      promocaoItem.valor_desconto +
      (promocaoItem.tipo_desconto === 'PERC' ? '%' : ''),
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[promocaoItem.id_promocao] = el;
            }
          }}
          onClick={(e) =>
            toggleDropdown(promocaoItem.id_promocao, e.currentTarget)
          }
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[promocaoItem.id_promocao]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[promocaoItem.id_promocao] &&
          dropdownPositions[promocaoItem.id_promocao] &&
          createPortal(
            <div
              key={`portal-dropdown-${promocaoItem.id_promocao}`} // Mantido o key aqui
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[promocaoItem.id_promocao] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[promocaoItem.id_promocao]?.top,
                left: dropdownPositions[promocaoItem.id_promocao]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow:
                  '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000,
              }}
            >
              <div
                className="py-1"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="options-menu-button"
              >
                {/* ✨ Novo botão "Ver Itens" */}
                <button
                  key={`view-items-${promocaoItem.id_promocao}`}
                  onClick={() => handleVerItensClick(promocaoItem)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Eye
                    className="mr-2 text-blue-500 dark:text-blue-400"
                    size={16}
                  />
                  Ver Itens
                </button>
                {userPermissions.editar && (
                  <button
                    key={`edit-${promocaoItem.id_promocao}`} // Mantido o key aqui
                    onClick={() => handleEditarClick(promocaoItem)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Pencil
                      className="mr-2 text-gray-400 dark:text-gray-500"
                      size={16}
                    />
                    Editar
                  </button>
                )}
                {userPermissions.remover && (
                  <button
                    key={`delete-${promocaoItem.id_promocao}`} // Mantido o key aqui
                    onClick={() => handleDeletarClick(promocaoItem.id_promocao)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                    role="menuitem"
                  >
                    <Trash2
                      className="mr-2 text-red-400 dark:text-gray-500"
                      size={16}
                    />
                    Deletar
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    ),
  }));

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Promoções
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => setCadastrarOpen(true)}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Nova"
                icon={<PlusIcon size={18} />}
              />
            )}
          </div>
        </header>
        <DataTable
          headers={headers}
          rows={rows}
          meta={promocoes.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome da promoção..."
        />
      </main>
      <CadastrarPromocaoModal
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={handlePromocoes}
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

      {/* ✨ Renderização do novo modal de visualização de itens */}
      <ModalVerItensPromocao
        isOpen={verItensOpen}
        onClose={handleCloseVerItensModal}
        promocao={promocaoComItensParaVer as PromocaoComItensFixos}
      />
    </div>
  );
};

export default PromocoesPage;
