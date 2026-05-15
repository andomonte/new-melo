import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { deleteCookie } from 'cookies-next';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // 1. Limpa cookie de autenticação
    deleteCookie('token_melo');
    deleteCookie('filial_melo');

    // 2. Limpa todos os dados de sessão do sistema
    sessionStorage.removeItem('perfilUserMelo');
    sessionStorage.removeItem('paginaAtualMelo');
    sessionStorage.removeItem('telaAtualMelo');
    sessionStorage.removeItem('newPerfilMelo');

    // 3. Redireciona para o login
    router.replace('/login');
  }, [router]);

  return null;
}
