// pages/UsuariosPage.tsx
import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  Usuario,
  getUsuarios,
  deletarUsuario,
  UsuarioEdit,
  resetarSenha,
} from '@/data/usuarios/usuarios'; // Ajuste o caminho se Funcao e PerfilUsuario não estiverem aqui

import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, RefreshCcw } from 'lucide-react';
import DataTableUsuarios from '@/components/common/DataTablePerfil';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarUsuario from './modalCadastrarUsuario'; // Seu componente de cadastro
import EditarUsuario from './modalEditarUsuario'; // Seu componente de edição
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Carregamento from '@/utils/carregamento';
import { AuthContext } from '@/contexts/authContexts';
import { Permissao } from '../perfis';

// IMPORTAÇÕES CORRIGIDAS
import { getVendedores, Vendedor } from '@/data/vendedores/vendedores'; // Caminho correto para vendedores

// ************************************************
// TIPAGEM ATUALIZADA (SE NECESSÁRIO)
// ************************************************
// Se você não tem um tipo `PerfilUsuario` ou `Funcao` que reflita
// as novas propriedades `funcoesPadraoPerfil` e `funcoesDoUsuario`,
// adicione-as aqui ou no seu arquivo de tipos de 'usuarios'.

// Exemplo de como poderia ser se não estiver já definido:
// type Funcao = {
//   id_functions: number;
//   descricao: string;
//   sigla: string;
//   usadoEm: string;
//   codigo_filial: number;
// };

// interface PerfilUsuarioComFuncoesSeparadas {
//   perfil_name: string;
//   filial: Array<{ codigo_filial: number; nome_filial: string }>;
//   funcoesPadraoPerfil: Funcao[]; // NOVA PROPRIEDADE
//   funcoesDoUsuario: Funcao[];   // NOVA PROPRIEDADE
//   codvend: number | null;
// }

// Atualize UsuarioEdit e Usuario para usar esta nova estrutura se necessário.
// Exemplo:
// declare module '@/data/usuarios/usuarios' {
//   export interface Usuario {
//     login_user_login: string;
//     login_user_name: string;
//     perfis?: PerfilUsuarioComFuncoesSeparadas[]; // Atualizado
//   }

//   export interface UsuarioEdit {
//     login_user_login: string;
//     login_user_name: string;
//     perfis?: PerfilUsuarioComFuncoesSeparadas[]; // Atualizado
//   }
// }

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onAfterConfirm?: () => void;
  usuarioId?: string;
  titulo: string;
  mensagem: string;
  botaoTexto: string;
}

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
  // Outras propriedades e métodos do contexto
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  usuarioId,
  onAfterConfirm,
  titulo,
  mensagem,
  botaoTexto,
}) => {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setStatus('loading');
    try {
      await onConfirm(usuarioId!);
      setStatus('success');

      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
        onClose();
        if (onAfterConfirm) onAfterConfirm();
      }, 1500);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(
        error.message || 'Ocorreu um erro ao executar a ação. Tente novamente.',
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[80%] h-[60%] flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {status === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                {titulo}
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {mensagem.replace('{usuarioId}', usuarioId || '')}
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto={`${botaoTexto}...`} />
            </div>
          )}

          {status === 'success' && (
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
                />
              </svg>
              <p className="text-lg font-semibold text-green-600">
                Ação concluída com sucesso!
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">
                Erro ao Executar Ação
              </h2>
              <p className="text-red-500 dark:text-red-400 mb-4">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {(status === 'idle' || status === 'error') && (
          <div className="flex justify-end gap-2">
            {status === 'error' && (
              <DefaultButton
                onClick={() => {
                  setStatus('idle');
                  setErrorMessage(null); // Limpa a mensagem de erro
                }}
                variant="secondary"
                text="Fechar"
              />
            )}
            {status === 'idle' && (
              <>
                <DefaultButton
                  onClick={onClose}
                  variant="cancel"
                  text="Cancelar"
                />
                <DefaultButton
                  onClick={handleConfirm}
                  variant="confirm"
                  text={botaoTexto}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const UsuariosPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [usuarios, setUsuarios] = useState({} as Usuario);
  const [usuarioEditar, setUsuarioEditar] = useState({} as UsuarioEdit);
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
  const { user } = useContext(AuthContext) as AuthContextProps;
  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<'delete' | 'reset' | 'custom'>(
    'delete',
  );
  const [modalTitulo, setModalTitulo] = useState('');
  const [modalMensagem, setModalMensagem] = useState('');
  const [modalBotaoTexto, setModalBotaoTexto] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<
    string | undefined
  >(undefined);

  // ESTADOS PARA VENDEDORES
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [isLoadingVendedores, setIsLoadingVendedores] = useState(true);
  const [errorVendedores, setErrorVendedores] = useState<string | null>(null);

  const openModal = (
    tipo: 'delete' | 'reset' | 'custom',
    usuarioId: string,
    titulo: string,
    mensagem: string,
    botaoTexto: string,
  ) => {
    setModalTipo(tipo);
    setUsuarioSelecionado(usuarioId);
    setModalTitulo(titulo);
    setModalMensagem(mensagem);
    setModalBotaoTexto(botaoTexto);
    setModalOpen(true);
  };

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    handleUsuarios();
  }, 300);

  const handleUsuarios = async () => {
    try {
      const data = await getUsuarios({ page, perPage, search });

      setUsuarios(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  // useEffect para buscar os vendedores
  useEffect(() => {
    const fetchVendedores = async () => {
      try {
        setIsLoadingVendedores(true);
        setErrorVendedores(null);
        // Usamos a função getVendedores que você já tem
        const data = await getVendedores({
          page: 1,
          perPage: 9999,
          search: '',
        }); // Buscando todos os vendedores

        setVendedores(data.data); // 'data.data' porque getVendedores retorna Vendedores { data: Vendedor[], meta: Meta }
      } catch (error) {
        console.error('Falha ao buscar vendedores:', error);
        setErrorVendedores('Falha ao carregar os dados dos vendedores.');
      } finally {
        setIsLoadingVendedores(false);
      }
    };

    fetchVendedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Rodar apenas uma vez na montagem do componente

  useEffect(() => {
    handleUsuarios();
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // Verifica as permissões do usuário
  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        let telaHref = sessionStorage.getItem('telaAtualMelo');
        let telaUsuario: Permissao | undefined;

        if (telaHref) {
          try {
            telaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('telaHref não era um JSON válido', e);
          }

          telaUsuario = user.permissoes.find(
            (permissao) => permissao.tb_telas?.PATH_TELA === telaHref,
          );
        }

        if (telaUsuario) {
          setUserPermissions({
            cadastrar: telaUsuario.cadastrar || false,
            editar: telaUsuario.editar || false,
            remover: telaUsuario.remover || false,
            consultar: true,
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

  const headers = [
    'Usuário',
    'Perfil',
    'Funções', // Esta coluna ainda será única, mas o cálculo mudará
    'Filiais',
    'Vendedor',
    'Ações',
  ];

  const toggleDropdown = (
    usuarioCodusr: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [usuarioCodusr]: !prevStates[usuarioCodusr],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [usuarioCodusr]: !prevRotations[usuarioCodusr],
    }));

    if (!dropdownStates[usuarioCodusr]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [usuarioCodusr]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (180 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [usuarioCodusr]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleDeletarClick = (usuarioId: string) => {
    closeAllDropdowns();
    openModal(
      'delete',
      usuarioId,
      'Confirmar Exclusão',
      `Tem certeza que deseja remover permanentemente o usuário "${usuarioId}"?`,
      'Excluir',
    );
  };

  const handleResetarClick = (usuarioId: string) => {
    closeAllDropdowns();
    openModal(
      'reset',
      usuarioId,
      'Confirmar Reset de Senha',
      `Tem certeza que deseja resetar a senha do usuário "${usuarioId}"?`,
      'Resetar',
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const usuarioCodusr in dropdownStates) {
        if (dropdownStates[usuarioCodusr]) {
          const dropdownNode = dropdownRefs.current[usuarioCodusr];
          const actionButtonNode = actionButtonRefs.current[usuarioCodusr];
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

  const rows = usuarios?.data?.map((usuario) => {
    const perfisUnicos = new Set<string>();
    const funcoesUnicasTotal = new Set<string>(); // MUDANÇA AQUI: Set para todas as funções
    const filiaisUnicas = new Set<string>();

    usuario.perfis?.forEach((perfil) => {
      if (perfil.perfil_name) {
        perfisUnicos.add(perfil.perfil_name);
      }

      // >>> MODIFICAÇÃO PRINCIPAL: CONTAGEM DE FUNÇÕES <<<
      // Adiciona funções do perfil padrão
      perfil.funcoesPadraoPerfil?.forEach((funcao) => {
        if (funcao.descricao) {
          funcoesUnicasTotal.add(funcao.descricao);
        }
      });

      // Adiciona funções do usuário
      perfil.funcoesDoUsuario?.forEach((funcao) => {
        if (funcao.descricao) {
          funcoesUnicasTotal.add(funcao.descricao);
        }
      });
      // >>> FIM DA MODIFICAÇÃO PRINCIPAL <<<

      perfil.filial?.forEach((filial) => {
        if (filial.nome_filial) {
          filiaisUnicas.add(filial.nome_filial);
        }
      });
    });

    return {
      usuario: usuario.login_user_login,
      perfil: perfisUnicos.size,
      funcoes: funcoesUnicasTotal.size, // MUDANÇA AQUI: Usa o novo Set de total de funções
      filiais: filiaisUnicas.size,

      vendedor:
        usuario.perfis?.reduce((count, perfil) => {
          const codvend = (perfil as any).codvend;
          return count + (codvend ? 1 : 0);
        }, 0) || 0,

      action: (
        <div className="relative">
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[usuario.login_user_login] = el;
              }
            }}
            onClick={(e) =>
              toggleDropdown(usuario.login_user_login, e.currentTarget)
            }
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[usuario.login_user_login]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>

          {dropdownStates[usuario.login_user_login] &&
            dropdownPositions[usuario.login_user_login] &&
            createPortal(
              <div
                ref={(el) => {
                  if (el) {
                    dropdownRefs.current[usuario.login_user_login] = el;
                  }
                }}
                className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
                style={{
                  position: 'absolute',
                  top: dropdownPositions[usuario.login_user_login]?.top,
                  left: dropdownPositions[usuario.login_user_login]?.left,
                  minWidth: '144px',
                  borderRadius: '0.375rem',
                  boxShadow:
                    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                  zIndex: 10,
                }}
              >
                <div
                  className="py-1"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="options-menu-button"
                >
                  {userPermissions.editar && (
                    <button
                      onClick={() => {
                        // >>> MODIFICAÇÃO: PASSAR funcoesPadraoPerfil E funcoesDoUsuario SEPARADAMENTE <<<
                        const usuarioParaEditar: UsuarioEdit = {
                          login_user_login: usuario.login_user_login,
                          login_user_name: usuario.login_user_name,
                          perfis: (usuario.perfis || []).map((perfil) => ({
                            perfil_name: perfil?.perfil_name || '',

                            // Passando as novas propriedades para EditarUsuario
                            funcoesPadraoPerfil:
                              perfil?.funcoesPadraoPerfil || [],
                            filial: (perfil?.filial || []).map((f) => ({
                              codigo_filial: f.codigo_filial,
                              nome_filial: f.nome_filial,
                              armazens: f.armazens || [], // ✅ ADICIONE ESTA LINHA
                              codvend: f.codvend ?? null, // ✅ CORRETO: se codvend for por filial
                              funcoesDoUsuario: perfil?.funcoesDoUsuario || [],
                            })),
                          })),
                        };
                        // >>> FIM DA MODIFICAÇÃO <<<

                        setUsuarioEditar(usuarioParaEditar);
                        setEditarOpen(true);
                        closeAllDropdowns();
                      }}
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
                      onClick={() =>
                        handleDeletarClick(usuario.login_user_login)
                      }
                      className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                      role="menuitem"
                    >
                      <Trash2
                        className="mr-2 text-red-400 dark:text-gray-500"
                        size={16}
                      />
                      Excluir
                    </button>
                  )}

                  {userPermissions.remover && (
                    <button
                      onClick={() =>
                        handleResetarClick(usuario.login_user_login)
                      }
                      className="flex items-center px-4 py-2 text-sm hover:bg-blue-100 dark:hover:bg-blue-700 focus:outline-none focus:bg-blue-100 dark:focus:bg-blue-700 focus:text-blue-900 dark:focus:text-blue-100 w-full"
                      role="menuitem"
                    >
                      <RefreshCcw
                        className="mr-2 text-blue-400 dark:text-gray-500"
                        size={16}
                      />
                      Resetar Senha
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

  const handleConfirmAction = async (usuarioId: string) => {
    if (modalTipo === 'delete') {
      return deletarUsuario(usuarioId);
    }
    if (modalTipo === 'reset') {
      return resetarSenha(usuarioId);
    }
  };

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Usuários
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => {
                  setCadastrarOpen(true);
                }}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Novo"
                icon={<Plus size={18} />}
              />
            )}
          </div>
        </header>

        <DataTableUsuarios
          headers={headers}
          rows={rows}
          meta={usuarios.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome do usuário..."
        />
      </main>

      {/* Passa vendedores para CadastrarUsuario */}
      <CadastrarUsuario
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={() => {
          setCadastrarOpen(false);
          handleUsuarios();
        }}
        vendedores={vendedores} // PASSA A LISTA DE VENDEDORES
        isLoadingVendedores={isLoadingVendedores} // PASSA O ESTADO DE CARREGAMENTO
        errorVendedores={errorVendedores} // PASSA O ESTADO DE ERRO
      />

      {usuarioEditar.login_user_login && (
        <EditarUsuario
          isOpen={editarOpen}
          onClose={() => setEditarOpen(false)}
          usuario={usuarioEditar} // usuarioEditar AGORA TEM AS FUNÇÕES SEPARADAS
          onSuccess={() => {
            setEditarOpen(false);
            handleUsuarios();
          }}
          vendedores={vendedores} // PASSA A LISTA DE VENDEDORES
          isLoadingVendedores={isLoadingVendedores} // PASSA O ESTADO DE CARREGAMENTO
          errorVendedores={errorVendedores} // PASSA O ESTADO DE ERRO
        />
      )}

      <ConfirmActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => handleConfirmAction(usuarioSelecionado!)}
        onAfterConfirm={handleUsuarios}
        usuarioId={usuarioSelecionado}
        titulo={modalTitulo}
        mensagem={modalMensagem}
        botaoTexto={modalBotaoTexto}
      />
    </div>
  );
};

export default UsuariosPage;
