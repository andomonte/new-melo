'use client';

import { SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Eye, EyeOff, LogOut } from 'lucide-react';

import api from '@/components/services/api';
import { AuthContext } from '@/contexts/authContexts';
import { getCookie } from 'cookies-next';
import { useTheme } from 'next-themes';
//import { EyeSlashIcon } from '@heroicons/react/24/solid';
//import { EyeIcon } from '@heroicons/react/24/solid';
function createPerfil(
  usuario: string,
  obs: string,
  perfil: string,
  codusr: string,
  filial: string,
) {
  return {
    usuario,
    obs,
    perfil,
    codusr,
    filial,
  };
}

const schema = z.object({
  name: z.string().min(1, { message: 'Usuário é obrigatório' }),
  password: z.string().min(1, { message: 'Senha não pode estar vazia' }),
});

type FormFields = z.infer<typeof schema>;

function App() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    defaultValues: {
      name: '',
      password: '', // 👈 isso aqui resolve
    },
    resolver: zodResolver(schema),
  });
  const { theme } = useTheme();

  const [urlLogo, setUrlLogo] = React.useState('');

  const { signIn } = React.useContext(AuthContext);
  const { paginaAtual } = React.useContext(AuthContext);
  const router = useRouter();
  const [mensagemErro, setMensagemErro] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const urlLogoT =
      theme === 'dark' ? '/images/logo1Branco.webp' : '/images/logo1.webp';
    setUrlLogo(urlLogoT);
  }, [theme]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const newToken = getCookie('token_melo');
    const token = newToken?.slice(0, newToken.indexOf('-'));

    if (token)
      router.push({
        pathname: '/filial',
        query: { perfilName: token },
      });
    else {
      sessionStorage.setItem('newPerfilMelo', JSON.stringify(null));
    }
  }, [router]);
  /* const onSubmit: SubmitHandler<FormFields> = async (data) => {
    try {
      setloading(true);
      api
        .post('/api/login', {
          nome: data.name,
          outros: data.password,
        })
        .then((responses) => {
          if (responses) {
       
          }
        })
        .catch((error) => {
        
        });
    } catch (err) {
   
    }
  }; */

  const onSubmit: SubmitHandler<FormFields> = async (values) => {
    setLoading(true);
    api
      .post('/api/postgresql/verUser', {
        userLogin: values.name,
        userSenha: values.password,
      })
      .then((response) => {
        const newPerfil = createPerfil(
          response.data[0].login_user_login,
          response.data[0].login_user_obs,
          response.data[0].login_perfil_name,
          response.data[0].codusr ? response.data[0].codusr : '',
          '',
        );

        // Set]
        signIn(newPerfil).then(() => {
          const valorF = { pagina: '/' };
          paginaAtual(valorF).then(() => {
            router.push({
              pathname: '/filial',
              query: { perfilName: newPerfil.usuario },
            });
          });
        });
        // setLoading(false);
        //  setGrupo(response.data[0].LOGIN_GROUP_NAME);
      })
      .catch((error: string) => {
        console.log(error);
        setLoading(false);
        setMensagemErro('Usuário ou Senha não confere!!!');
      });

    /*     if (res?.ok) {
      // Authenticate user

      router.push({
        pathname: '/filial',
        //        query: { cpf: 'test' },
      });
      return res;
    }
    if (res?.error) {
      setMensagemErro('Usuário ou Senha não confere!!!');
    }
 */
    // if (res.url) Router.push('/');
  };
  const [openOlho, setOpenOlho] = React.useState(false);

  const handleOlho = () => {
    setOpenOlho(!openOlho);
  };

  return (
    <main className="bg-[#F6F7F9] text-zinc-800 dark:text-zinc-100  min-h-[600px] w-full h-screen   flex  flex-col justify-center ">
      <div className="  flex w-full h-[50%] dark:bg-[#1f517c] bg-[#347ab6]  justify-start" />
      <div className="  flex w-full h-[50%] dark:bg-slate-400  bg-[#F6F7F9]  justify-center">
        <div className=" mt-[-225px]  rounded-2xl flex bg-white  dark:bg-slate-900 h-[140%] min-h-96 w-4/5   lg:w-3/5  justify-center px-6 py-6 lg:px-8">
          <div className=" md:flex hidden  h-full  w-[50%] flex-col items-start justify-center ">
            <div className="flex font-bold  justify-start w-full h-[10%] items-start">
              Bem Vindo
            </div>
            <div className="flex justify-center w-full h-[90%] items-center">
              <img
                className="mx-auto h-auto w-[60%] "
                src={urlLogo}
                alt="Your Company"
              />{' '}
            </div>
          </div>
          <div className=" rounded-3xl flex bg-[#fafaf0] dark:bg-slate-700 border-2 h-full w-[100%] md:w-[100%] xl:w-[50%] sm:w-[90%] flex-col justify-center items-center ">
            <div className="h-[5%]">
              <img
                className="flex items-center mx-auto h-auto w-[40%] mb-10  md:hidden "
                src={urlLogo}
                alt="Your Company"
              />
            </div>
            <div className=" h-[10%] justify-center hidden md:flex items-start font-bold sm:mx-auto sm:w-full sm:max-w-sm">
              TELA DE LOGIN
            </div>

            <div className="flex font-bold text-red-600 dark:text-red-300 justify-center w-full h-[15%] items-center md:items-center sm:items-end">
              {mensagemErro ? mensagemErro : ''}
            </div>
            <div
              className={`${
                mensagemErro ? 'h-[75%]' : 'h-[90%'
              } h-[75%] w-[100%] flex justify-center items-center`}
            >
              <form
                className=" w-[90%]    "
                action={''}
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="mb-8 ">
                  <label className="block after:content-['*'] after:ml-0.5 after:text-red-500 after:dark:text-red-300 text-sm font-medium leading-6 text-primary">
                    Informe o Usuário
                  </label>
                  <input
                    {...register('name')}
                    onChange={() => {
                      setMensagemErro('');
                    }}
                    className="w-full pl-3 h-12 pr-10 py-2 bg-transparent placeholder:text-slate-400 text-primary text-sm border border-slate-200 rounded-md transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow "
                    placeholder="nome do usuario"
                  />
                  {errors.name && (
                    <div className="text-red-500 dark:text-red-300 text-sm">
                      {errors.name.message}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center  justify-between">
                    <label className="block after:content-['*'] after:ml-0.5 after:text-red-500 after:dark:text-red-300 text-sm font-medium leading-6 text-primary">
                      Digite sua Senha
                    </label>
                  </div>
                  <div className="w-full h-full items-center   min-w-[200px]">
                    <div className="relative">
                      <input
                        {...register('password', {
                          onChange: () => setMensagemErro(''), // 👈 já remove o erro no próprio RHF
                        })}
                        type={openOlho ? 'text' : 'password'}
                        className="w-full pl-3 h-12 pr-10 py-2 bg-transparent placeholder:text-slate-400 text-primary text-sm border border-blue-500 rounded-md transition duration-300 ease focus:outline-none focus:border-orange-600 hover:border-orange-300 shadow-sm focus:shadow type=password"
                        placeholder="informe sua password aqui"
                      />

                      {openOlho ? (
                        <Eye
                          onClick={handleOlho}
                          className="absolute flex items-center w-5 h-5 top-[13px] right-2.5 text-slate-600"
                        />
                      ) : (
                        <EyeOff
                          onClick={handleOlho}
                          className="absolute w-5 h-5 top-[13px] right-2.5 text-slate-600"
                        />
                      )}
                    </div>
                  </div>
                  {/* <div className="text-sm m-2">
                  <a href="#" className="text-cyan-500 hover:text-cyan-800">
                    Esqueceu a Senha?
                  </a>
                </div> */}
                  {errors.password && (
                    <div className="text-red-500 dark:text-red-300 text-sm">
                      {errors.password.message}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="flex h-12 mt-10 bg-[#2B558D] w-full  justify-center rounded-md items-stretch px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {loading ? (
                      <div
                        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-[#FFFFFF] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                        role="status"
                      >
                        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                          Loading...
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-center text-white w-full h-full">
                        <LogOut />
                        <span className="ml-2">Acessar</span>
                      </div>
                    )}
                  </button>
                </div>

                {errors.root && (
                  <div className="text-red-500 dark:text-red-300">
                    {errors.root.message}
                  </div>
                )}
              </form>
              {/* <div className="my-4 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-neutral-300 after:mt-0.5 after:flex-1 after:border-t after:border-neutral-300 dark:before:border-neutral-500 dark:after:border-neutral-500">
              <p className="mx-4 mb-0 text-gray-500 text-[0.8rem] text-center font-semibold dark:text-white">
                Ou
              </p>
            </div>
            <p className="mt-10 text-center text-sm text-gray-500">
              Não é usuário?
              <a
                href="#"
                className="ml-2 font-semibold leading-6 text-cyan-600 hover:text-cyan-800"
              >
                Fazer cadastro
              </a>
            </p> */}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
