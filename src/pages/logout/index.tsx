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

    // 🧹 Limpa sessionStorage
    sessionStorage.setItem('newPerfilMelo', JSON.stringify(null));
    sessionStorage.setItem('carrinhoMelo', JSON.stringify([]));

    sessionStorage.setItem(
      'clienteSelectMelo',
      JSON.stringify({
        codigo: '',
        nome: '',
        documento: '',
        nomeFantasia: '',
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
        CODVEND: '',
      }),
    );
    sessionStorage.setItem('telaAtualMelo', JSON.stringify(''));
    sessionStorage.setItem(
      'dadosClienteSelMelo',
      JSON.stringify({
        codigo: '',
        nome: '',
        documento: '',
        nomeFantasia: '',
      }),
    );

    // 🔁 Redireciona para login
    router.push('/login');
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
