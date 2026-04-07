'use client';
import React, { useContext, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { ExitIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import api from '@/components/services/api';
import { useTheme } from 'next-themes';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(6, { message: 'A nova senha deve ter no mínimo 6 caracteres' }),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmNewPassword'],
  });

type FormFields = z.infer<typeof schema>;

function ChangePasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormFields>({
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
    resolver: zodResolver(schema),
  });
  const { user } = useContext(AuthContext);
  const { theme } = useTheme();
  const router = useRouter();
  const [urlLogo, setUrlLogo] = React.useState('');
  const [mensagemSucesso, setMensagemSucesso] = React.useState('');
  const [mensagemErro, setMensagemErro] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [openNewPassword, setOpenNewPassword] = React.useState(false);
  const [openConfirmNewPassword, setOpenConfirmNewPassword] =
    React.useState(false);
  const [exibirErroGeral, setExibirErroGeral] = useState(false);

  React.useEffect(() => {
    const urlLogoT =
      theme === 'dark' ? '/images/logo1Branco.webp' : '/images/logo1.webp';
    setUrlLogo(urlLogoT);
  }, [theme]);

  const handleVoltar = () => {
    router.back();
  };

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setLoading(true);
    setMensagemErro('');
    setMensagemSucesso('');
    setExibirErroGeral(false);

    try {
      const userId = user?.usuario; // Utiliza o codusr do usuário logado
      if (!userId) {
        setMensagemErro('Erro: ID do usuário não encontrado.');
        setLoading(false);
        return;
      }

      const response = await api.post('api/usuarios/novaSenha', {
        codusr: userId, // Envia codusr em vez de userId
        newPassword: data.newPassword,
      });

      if (response.status === 200) {
        setMensagemSucesso('Senha alterada com sucesso!');
        setLoading(false);
        setTimeout(() => {
          router.back(); // Redireciona para a página anterior
        }, 1500);
        reset(); // Limpa os campos do formulário
      } else {
        setMensagemErro('Ocorreu um erro ao tentar alterar a senha.');
        setLoading(false);
        console.error('Erro na alteração de senha:', response.data);
        setExibirErroGeral(true);
      }
    } catch (error: any) {
      console.error('Erro ao enviar dados para a API:', error);
      setMensagemErro('Ocorreu um erro ao tentar alterar a senha.');
      setLoading(false);
      setExibirErroGeral(true);
    }
  };

  const handleOpenNewPassword = () => {
    setOpenNewPassword(!openNewPassword);
  };

  const handleOpenConfirmNewPassword = () => {
    setOpenConfirmNewPassword(!openConfirmNewPassword);
  };

  const handleFecharErroGeral = () => {
    setExibirErroGeral(false);
  };

  return (
    <main className="bg-[#F6F7F9] text-zinc-800 dark:text-zinc-100  min-h-[600px] w-full h-screen flex flex-col justify-center">
      <div className="flex w-full h-[50%] dark:bg-[#1f517c] bg-[#347ab6] justify-start" />
      <div className="flex w-full h-[50%] dark:bg-slate-400 bg-[#F6F7F9] justify-center">
        <div className="mt-[-225px] rounded-2xl flex bg-white  dark:bg-slate-900 h-fit min-h-96 w-4/5 lg:w-3/5 justify-center px-6 py-6 lg:px-8">
          {/* Logo + sair */}
          <div className="hidden md:flex w-1/2 flex-col justify-between">
            <div className="text-lg font-bold">Bem Vindo</div>
            <img className="w-[60%]" src={urlLogo} alt="Logo" />
            <div
              className="flex items-center cursor-pointer"
              onClick={handleVoltar}
            >
              <IconButton
                variant="ghost"
                className="text-blue-900 dark:text-white"
              >
                <ExitIcon className="w-6 h-6" />
              </IconButton>
              <span className="ml-2 font-bold">Voltar</span>
            </div>
          </div>
          <div className="rounded-3xl flex bg-[#fafaf0] dark:bg-slate-700 border-2 h-fit w-[100%] md:w-[100%] xl:w-[50%] sm:w-[90%] flex-col justify-center items-center py-8">
            <div className="h-[5%]">
              <img
                className="flex items-center mx-auto h-auto w-[40%] mb-6 md:hidden "
                src={urlLogo}
                alt="Your Company"
              />
            </div>
            <div className="h-fit justify-center hidden md:flex items-start font-bold sm:mx-auto sm:w-full sm:max-w-sm mb-4">
              ALTERAR SENHA DE {user?.usuario}
            </div>

            {mensagemSucesso && (
              <div className="flex font-bold text-green-600 dark:text-green-300 justify-center w-full h-fit items-center md:items-center sm:items-end mb-4">
                {mensagemSucesso}
              </div>
            )}

            {mensagemErro && !exibirErroGeral && (
              <div className="flex font-bold text-red-600 dark:text-red-300 justify-center w-full h-fit items-center md:items-center sm:items-end mb-4">
                {mensagemErro}
              </div>
            )}

            {exibirErroGeral && (
              <div className="w-[90%] p-6 rounded-md bg-red-100 dark:bg-red-900 border border-red-500 dark:border-red-300 text-red-700 dark:text-red-300 flex flex-col items-center justify-center">
                <p className="font-bold mb-4 text-center">
                  Ocorreu um erro ao tentar alterar a senha.
                </p>
                <button
                  onClick={handleFecharErroGeral}
                  className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Fechar
                </button>
              </div>
            )}

            {!exibirErroGeral && (
              <form
                className="w-[90%]"
                action={''}
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="mb-6">
                  <label
                    htmlFor="newPassword"
                    className="block after:content-['*'] after:ml-0.5 after:text-red-500 after:dark:text-red-300 text-sm font-medium leading-6 text-primary"
                  >
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      {...register('newPassword')}
                      type={openNewPassword ? 'text' : 'password'}
                      className="w-full pl-3 h-12 pr-10 py-2 bg-transparent placeholder:text-slate-400 text-primary text-sm border border-slate-200 rounded-md transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                      placeholder="Digite a nova senha"
                      id="newPassword"
                    />
                    {openNewPassword ? (
                      <Eye
                        onClick={handleOpenNewPassword}
                        className="absolute flex items-center w-5 h-5 top-[13px] right-2.5 text-slate-600 cursor-pointer"
                      />
                    ) : (
                      <EyeOff
                        onClick={handleOpenNewPassword}
                        className="absolute w-5 h-5 top-[13px] right-2.5 text-slate-600 cursor-pointer"
                      />
                    )}
                  </div>
                  {errors.newPassword && (
                    <div className="text-red-500 dark:text-red-300 text-sm">
                      {errors.newPassword.message}
                    </div>
                  )}
                </div>

                <div className="mb-8">
                  <label
                    htmlFor="confirmNewPassword"
                    className="block after:content-['*'] after:ml-0.5 after:text-red-500 after:dark:text-red-300 text-sm font-medium leading-6 text-primary"
                  >
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      {...register('confirmNewPassword')}
                      type={openConfirmNewPassword ? 'text' : 'password'}
                      className="w-full pl-3 h-12 pr-10 py-2 bg-transparent placeholder:text-slate-400 text-primary text-sm border border-slate-200 rounded-md transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                      placeholder="Confirme a nova senha"
                      id="confirmNewPassword"
                    />
                    {openConfirmNewPassword ? (
                      <Eye
                        onClick={handleOpenConfirmNewPassword}
                        className="absolute flex items-center w-5 h-5 top-[13px] right-2.5 text-slate-600 cursor-pointer"
                      />
                    ) : (
                      <EyeOff
                        onClick={handleOpenConfirmNewPassword}
                        className="absolute w-5 h-5 top-[13px] right-2.5 text-slate-600 cursor-pointer"
                      />
                    )}
                  </div>
                  {errors.confirmNewPassword && (
                    <div className="text-red-500 dark:text-red-300 text-sm">
                      {errors.confirmNewPassword.message}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    disabled={isSubmitting || loading}
                    type="submit"
                    className="flex h-12 mt-2 bg-[#2B558D] w-full justify-center rounded-md items-stretch px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {loading ? (
                      <div
                        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-[#FFFFFF] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                        role="status"
                      >
                        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                          Carregando...
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-center text-white w-full h-full">
                        <KeyRound />
                        <span className="ml-2">Alterar Senha</span>
                      </div>
                    )}
                  </button>
                </div>

                {errors.root && (
                  <div className="text-red-500 dark:text-red-300 mt-2">
                    {errors.root.message}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default ChangePasswordPage;
