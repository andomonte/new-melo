// src/contexts/AuthContext.tsx

import React, { createContext, useEffect, useState } from 'react';
import { setCookie, deleteCookie } from 'cookies-next';
import { useRouter } from 'next/router';

// ---
// Tipos
// ---

export type Permissao = {
  editar: boolean;
  grupoId: string;
  id: number;
  tb_telas: {
    CODIGO_TELA: number;
    PATH_TELA: string;
    NOME_TELA: string;
  };
  cadastrar: boolean;
  remover: boolean;
  exportar: boolean;
};

export type ArmazemInfo = {
  id_armazem: number;
  nome: string;
  // Adicione outros campos do dbarmazem aqui se precisar.
  // Ex: ativo?: boolean;
};

type User = {
  usuario: string;
  perfil: string;
  obs: string;
  codusr: string; // Este campo receberá o codvend
  filial: string;
  permissoes?: Permissao[];
  funcoes?: string[];
  armazens?: ArmazemInfo[];
};

type Filial = { filial: string };
type Pagina = { pagina: string };

type AuthContextType = {
  user: User;
  signIn: (data: User) => Promise<void>;
  filialSet: (data: Filial) => Promise<void>;
  paginaAtual: (data: Pagina) => Promise<void>;
  ultimaPagina: string;
  isLoading: boolean;
};

// ---
// Contexto de Autenticação
// ---

export const AuthContext = createContext({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>({
    usuario: '',
    perfil: '',
    obs: '',
    codusr: '',
    filial: '',
    permissoes: [],
    funcoes: [],
    armazens: [],
  });

  const [ultimaPagina, setUltimaPagina] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // ---
  // Funções de Busca de Dados
  // ---

  async function fetchFuncoes(
    login_user_login: string,
    grupoId?: string,
  ): Promise<any[]> {
    try {
      const url = `/api/grupoFuncoes/get?login_user_login=${login_user_login}${
        grupoId ? `&grupoId=${grupoId}` : ''
      }`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          'Erro na resposta da API de funções:',
          response.statusText,
        );
        return [];
      }
      const data = await response.json();
      // Retorna objetos com {sigla, descricao} para verificação no frontend
      return data.funcoes || [];
    } catch (error) {
      console.error('Erro ao buscar funções:', error);
      return [];
    }
  }

  async function fetchPermissoes(grupoId: string): Promise<Permissao[]> {
    try {
      const response = await fetch(
        `/api/grupoPermissoes/get?grupoId=${grupoId}`,
      );
      if (!response.ok) {
        console.error(
          'Erro na resposta da API de permissões:',
          response.statusText,
        );
        return [];
      }
      const data = await response.json();
      return (
        data.permissoes.map((p: any) => ({
          id: p.id,
          grupoId: p.grupoId,
          editar: p.editar,
          cadastrar: p.cadastrar,
          remover: p.remover,
          exportar: p.exportar,
          tb_telas: {
            CODIGO_TELA: p.tb_telas.CODIGO_TELA,
            PATH_TELA: p.tb_telas.PATH_TELA,
            NOME_TELA: p.tb_telas.NOME_TELA,
          },
        })) || []
      );
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      return [];
    }
  }

  async function fetchArmazens(
    login_user_login: string,
    grupoId?: string,
    filial?: string,
  ): Promise<ArmazemInfo[]> {
    try {
      // ✅ Se não tiver filial, não chama a API e retorna lista vazia
      if (!filial) return [];

      const url = `/api/armazensUsuario/get?login_user_login=${login_user_login}${
        grupoId ? `&grupoId=${grupoId}` : ''
      }${filial ? `&filial=${filial}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          'Erro na resposta da API de armazéns:',
          response.statusText,
        );
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erro ao buscar armazéns:', error);
      return [];
    }
  }

  // ---
  // Efeitos e Funções Principais
  // ---

  /** Consolida a lógica de inicialização e paginação */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session = sessionStorage.getItem('perfilUserMelo');
    const pagina = sessionStorage.getItem('paginaAtualMelo');

    let userData: User = {
      usuario: '',
      perfil: '',
      obs: '',
      codusr: '',
      filial: '',
      permissoes: [],
      funcoes: [],
      armazens: [],
    };

    if (session) {
      const parsedUser = JSON.parse(session);
      // Mesclar dados existentes com valores padrão para evitar undefined
      userData = {
        ...userData, // Garante que campos como permissoes, funcoes, armazens sejam [] por padrão
        ...parsedUser,
      };
    }

    if (pagina) {
      const parsedPagina = JSON.parse(pagina);
      const paginaStr =
        typeof parsedPagina === 'string' ? parsedPagina : parsedPagina.pagina;
      setUltimaPagina(paginaStr);
    }

    // Apenas busca dados se o usuário estiver presente na sessão
    // e se algum dos arrays de permissões, funções ou armazéns não estiver populado.
    if (
      userData.usuario &&
      (!userData.permissoes?.length ||
        !userData.funcoes?.length ||
        !userData.armazens?.length)
    ) {
      setIsLoading(true); // Manter isLoading true enquanto busca
      Promise.all([
        fetchFuncoes(userData.usuario, userData.perfil),
        fetchPermissoes(userData.perfil),
        userData.filial
          ? fetchArmazens(userData.usuario, userData.perfil, userData.filial) // ✅ só chama se tiver filial
          : Promise.resolve<ArmazemInfo[]>([]),
      ])
        .then(([funcoes, permissoes, armazens]) => {
          const updatedUser = {
            ...userData,
            funcoes,
            permissoes,
            armazens,
          };
          setUser(updatedUser);
          sessionStorage.setItem('perfilUserMelo', JSON.stringify(updatedUser));
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Erro na inicialização do AuthContext:', error);
          setIsLoading(false);
        });
    } else {
      // Se não há usuário ou se todos os dados já estão na sessão, apenas seta o estado
      setUser(userData);
      setIsLoading(false);
    }
  }, []); // Dependências para executar apenas na montagem

  /** Redirecionamento para login */
  useEffect(() => {
    // Rotas que não precisam de autenticação (login próprio do módulo)
    const rotasPublicas = ['/separacao', '/conferencia', '/tv', '/entrada/recebimento', '/alocacao'];
    const isRotaPublica = rotasPublicas.includes(router.pathname);

    if (
      !isLoading &&
      !user.usuario &&
      !isRotaPublica &&
      router.pathname !== '/login'
    ) {
      deleteCookie('token_melo');
      router.push('/login');
    }
  }, [isLoading, user.usuario, router]);

  /** Atualização de filial e perfil */
  async function filialSet({ filial }: Filial) {
    const currentUser = user.usuario
      ? user
      : JSON.parse(sessionStorage.getItem('perfilUserMelo') || '{}');

    if (!currentUser.usuario) {
      console.error('Não há usuário logado para definir a filial.');
      return;
    }

    try {
      // Primeiro, busca o perfil associado à filial para o usuário
      const response = await fetch(
        `/api/perfilFilial/get?user_login_id=${currentUser.usuario}&nome_filial=${filial}`,
      );

      if (!response.ok) {
        console.error('Erro ao buscar perfil da filial:', response.statusText);
        throw new Error('Falha ao buscar perfil da filial.');
      }
      const { perfil_name, codvend } = await response.json();

      // Em seguida, busca permissões, funções e armazéns para o novo perfil
      const [permissoes, funcoes, armazens] = await Promise.all([
        fetchPermissoes(perfil_name),
        fetchFuncoes(currentUser.usuario, perfil_name),
        fetchArmazens(currentUser.usuario, perfil_name, filial),
      ]);

      const updatedUser: User = {
        ...currentUser,
        filial,
        perfil: perfil_name,
        codusr: codvend || '', // ATRIBUIÇÃO DO codvend AQUI!
        permissoes,
        funcoes,
        armazens,
      };

      setUser(updatedUser);
      sessionStorage.setItem('perfilUserMelo', JSON.stringify(updatedUser));
      setCookie('filial_melo', filial, { path: '/' });
    } catch (error) {
      console.error('Erro ao definir filial e perfil:', error);
      // Lidar com o erro, talvez mostrar uma mensagem para o usuário
    }
  }

  /** Atualiza a última página acessada */
  async function paginaAtual({ pagina }: Pagina) {
    if (pagina) {
      setUltimaPagina(pagina);
      sessionStorage.setItem('paginaAtualMelo', JSON.stringify(pagina));
    }
  }

  /** Autenticação do usuário */
  async function signIn({ usuario, perfil, obs, codusr, filial }: User) {
    setCookie('token_melo', `${usuario}-cookiesmelo`);
    setIsLoading(true); // Ativa o loading durante o signIn

    try {
      // Busca todas as informações necessárias em paralelo
      const [funcoes, permissoes, armazens] = await Promise.all([
        fetchFuncoes(usuario, perfil),
        fetchPermissoes(perfil),
        filial
          ? fetchArmazens(usuario, perfil, filial) // ✅ só chama se tiver filial (parâmetro do signIn)
          : Promise.resolve<ArmazemInfo[]>([]),
      ]);

      const newUser = {
        usuario,
        perfil,
        obs,
        codusr, // codusr já deve vir preenchido do processo de login inicial, se aplicável
        filial,
        permissoes,
        funcoes,
        armazens,
      };

      setUser(newUser);
      sessionStorage.setItem('perfilUserMelo', JSON.stringify(newUser));
      router.push(ultimaPagina || '/'); // Redireciona para a última página ou home
    } catch (error) {
      console.error('Erro no signIn:', error);
      deleteCookie('token_melo');
    } finally {
      setIsLoading(false); // Desativa o loading
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, signIn, filialSet, paginaAtual, ultimaPagina, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}
