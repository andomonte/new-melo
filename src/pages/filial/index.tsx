import React, { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ExitIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import { AuthContext } from '@/contexts/authContexts';
import { destroyCookie, setCookie } from 'nookies'; // 👈 aqui adicionamos o setCookie
import { useTheme } from 'next-themes';
import Carregamento from '@/utils/carregamento';
import { getPgPool } from '@/lib/pg';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';

type Filial = {
  nome_filial: string;
  codigo_filial: string;
  login_user_login: string;
};

function App({ filiais }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { filialSet, ultimaPagina } = useContext(AuthContext);
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const { perfilName } = router.query;
  const [urlLogo, setUrlLogo] = useState('');
  const [newPerfil, setNewPerfil] = useState(perfilName);
  const [perfil, setPerfil] = useState<{ filial: string }>({ filial: '' });
  const [filialList, setFilialList] = useState<Filial[]>([]);
  const [prosseguir, setProsseguir] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const url =
      resolvedTheme === 'dark'
        ? '/images/logo1Branco.webp'
        : '/images/logo1.webp';
    setUrlLogo(url);
  }, [resolvedTheme]);

  useEffect(() => {
    if (perfilName) {
      setNewPerfil(perfilName);
      sessionStorage.setItem('newPerfilMelo', JSON.stringify(perfilName));
    } else {
      const storedPerfil = sessionStorage.getItem('newPerfilMelo');

      if (storedPerfil) {
        setNewPerfil(JSON.parse(storedPerfil));
      } else {
        destroyCookie(null, 'filial_melo', { path: '/' });
        router.replace('/login');
      }
    }
  }, [perfilName, router]);

  useEffect(() => {
    if (filiais && newPerfil) {
      const filtradas = filiais.filter(
        (f: Filial) => f.login_user_login === newPerfil,
      );
      setFilialList(filtradas);
      if (filtradas.length === 1) {
        const filialUnica = filtradas[0].nome_filial;
        setPerfil({ filial: filialUnica });
        setCookie(null, 'filial_melo', filialUnica, {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        // ✅ Chama filialSet imediatamente para única filial
        setCarregando(true);
        filialSet({ filial: filialUnica })
          .then(() => {
            setProsseguir(true);
          })
          .catch((error) => {
            console.error('Erro ao configurar filial única:', error);
            setCarregando(false);
          });
      }
    }
  }, [filiais, newPerfil, filialSet]);

  useEffect(() => {
    if (perfil.filial) {
      setProsseguir(true);
    }
  }, [perfil]);

  useEffect(() => {
    if (!prosseguir || !perfil.filial) return;

    // ✅ Define um destino padrão caso ultimaPagina esteja vazio ou seja /filial
    const destino =
      ultimaPagina && ultimaPagina !== '' && ultimaPagina !== '/filial'
        ? ultimaPagina
        : '/'; // ✅ Vai para a home que redireciona para primeira permissão

    if (router.asPath !== destino) {
      router.replace(destino);
      setProsseguir(false);
    }
  }, [prosseguir, perfil, router, ultimaPagina]);

  return (
    <main className="bg-[#F6F7F9] h-screen flex flex-col justify-center">
      <div className="h-1/2 bg-[#347ab6] dark:bg-[#1f517c]" />
      <div className="h-1/2 flex justify-center bg-[#F6F7F9] dark:bg-slate-400">
        <div className="mt-[-225px] bg-white dark:bg-slate-900 rounded-2xl flex w-4/5 lg:w-3/5 h-[140%] px-6 py-6 justify-center">
          {/* Logo + sair */}
          <div className="hidden md:flex w-1/2 flex-col justify-between">
            <div className="text-lg font-bold">Bem Vindo {newPerfil}</div>
            <img className="w-[60%]" src={urlLogo} alt="Logo" />
            <div
              className="flex items-center cursor-pointer"
              onClick={() => router.push('/logout')}
            >
              <IconButton
                variant="ghost"
                className="text-blue-900 dark:text-white"
              >
                <ExitIcon className="w-6 h-6" />
              </IconButton>
              <span className="ml-2 font-bold">Sair</span>
            </div>
          </div>

          {/* Lista de filiais */}
          <div className="text-blue-900 dark:text-white flex flex-col items-center justify-center w-full md:w-1/2 bg-[#fafaf0] dark:bg-slate-700 border-2 rounded-3xl">
            <img
              className="md:hidden w-[40%] mb-10"
              src={urlLogo}
              alt="Logo Mobile"
            />
            {filialList.length > 1 && !carregando ? (
              <h2 className="text-lg font-bold">ESCOLHA UMA FILIAL</h2>
            ) : null}

            {filialList.length > 1 && !carregando ? (
              <div
                className={`mt-5 w-[100%]  h-[80%] ${
                  filialList.length > 3 ? 'overflow-y-scroll' : ''
                }`}
              >
                {filialList.map((val, idx) => (
                  <div key={idx} className="flex justify-center my-2">
                    <div
                      className="w-[90%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-zinc-400 rounded-lg shadow-sm p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => {
                        setCarregando(true);
                        setCookie(null, 'filial_melo', val.nome_filial, {
                          path: '/',
                          maxAge: 60 * 60 * 24 * 7,
                        });
                        filialSet({ filial: val.nome_filial })
                          .then(() => {
                            setPerfil({ filial: val.nome_filial });
                          })
                          .catch((error) => {
                            console.error('Erro ao configurar filial:', error);
                            setCarregando(false);
                          });
                      }}
                    >
                      <div className="flex items-center">
                        <div className="mr-4 w-12 h-12 bg-gray-300 dark:bg-zinc-500 rounded-full flex items-center justify-center font-bold">
                          {val.codigo_filial}
                        </div>
                        <div className="text-slate-800 dark:text-white">
                          {val.nome_filial}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full">
                <Carregamento texto="Encontrando Filiais..." />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Server-side rendering para ter acesso ao banco de dados
export const getServerSideProps: GetServerSideProps = async () => {
  const pool = getPgPool();
  let filiais: any[] = [];

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT login_user_login, nome_filial, codigo_filial 
        FROM tb_login_filiais;
      `);
      filiais = result.rows;
    } catch (error) {
      console.error('Erro ao executar a query:', error);
      return {
        props: {
          filiais: [],
        },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    return {
      props: {
        filiais: [],
      },
    };
  }

  return {
    props: {
      filiais,
    },
  };
};

export default App;
