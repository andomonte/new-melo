//import Home from '@/components/home';
import React from 'react';
import { useRouter } from 'next/router';
import { deleteCookie } from 'cookies-next';

function LogOut() {
  const router = useRouter();

  React.useEffect(() => {
    // 🧼 Limpa cookies
    deleteCookie('token_melo');
    deleteCookie('filial_melo'); // 👈 limpa o cookie da filial escolhida

    // 🧹 Limpa TODA a sessão do usuário. Antes o perfilUserMelo (usuário
    // logado) NÃO era removido, então após sair o sistema mantinha resíduo do
    // usuário anterior (e o header x-user-data das requisições continuava
    // apontando pra ele), causando o "sistema se perde" ao logar outro usuário.
    try {
      const chavesMelo = [
        'perfilUserMelo',
        'newPerfilMelo',
        'paginaAtualMelo',
        'telaAtualMelo',
        'carrinhoMelo',
        'clienteSelectMelo',
        'dadosClienteSelMelo',
      ];
      // perfilUserMelo agora fica no localStorage (compartilhado entre abas)
      chavesMelo.forEach((k) => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
    } catch (e) {
      console.warn('Falha ao limpar sessão no logout:', e);
    }

    // 🔁 Redireciona para o login com RELOAD COMPLETO (window.location, não
    // router.push). Isso remonta o AuthProvider do zero, zerando o estado
    // `user` em memória — que a navegação SPA não limpava.
    window.location.href = '/login';
  }, [router]);

  return (
    <div className="h-screen flex flex-col justify-center items-center">
      <div className="relative flex justify-center items-center">
        <div className="absolute animate-spin rounded-full h-28 w-28 border-t-4 border-b-4 border-blue-900"></div>
        <div className="flex justify-center flex-col items-center">
          <img
            src="/images/logo2.webp"
            alt="Melo Distribuidora"
            className="rounded-full h-16 w-16"
          />
        </div>
      </div>
      <div className="text-[16px] mt-10 text-[#2B558D] font-bold">
        Saindo...
      </div>
    </div>
  );
}

export default LogOut;
