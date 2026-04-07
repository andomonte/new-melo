import React, { useEffect, useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/authContexts';
import MenuPadrao from '@/components/menus/padrao';
import Carregamento from '@/utils/carregamento';
import type { Permissao } from '@/contexts/authContexts';

const Page = () => {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext); // ✅ Pegue o novo estado isLoading
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [permissaoAtual, setPermissaoAtual] = useState<Permissao | null>(null);
  const [permissoesPaths, setPermissoesPaths] = useState<string[]>([]);

  const { subPage, item, perfil } = router.query;

  useEffect(() => {
    // ✅ Verifique se o router está pronto E se o carregamento do usuário está completo
    if (!router.isReady || isLoading) {
      return;
    } // Se o usuário não existir (não autenticado), redirecione para login

    if (!user) {
      router.replace('/login');
      return;
    }

    if (
      typeof subPage !== 'string' ||
      typeof item !== 'string' ||
      !user.permissoes
    ) {
      // Se o usuário está autenticado mas não tem permissões, ou os dados da rota estão incompletos,
      // redirecione para a página de não autorizado
      router.replace('/naoAutorizado');
      return;
    }

    const telaAtual = `/${perfil}/${subPage}/${item}`;

    const permissaoEncontrada = user.permissoes.find(
      (p) => p.tb_telas?.PATH_TELA === telaAtual,
    );

    if (!permissaoEncontrada) {
      router.replace('/naoAutorizado');
      return;
    }

    setPermissaoAtual(permissaoEncontrada);

    const pathsPermitidos = user.permissoes
      .map((p) => p.tb_telas?.PATH_TELA)
      .filter((p): p is string => !!p);

    setPermissoesPaths(pathsPermitidos);

    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== telaAtual
    ) {
      window.history.replaceState(null, '', telaAtual);
    }

    setDadosCarregados(true);
  }, [router, subPage, item, user, perfil, isLoading]); // ✅ Adicione isLoading como dependência // ✅ Mostre o carregamento apenas se a página ou o usuário estiverem carregando

  if (isLoading || !dadosCarregados || !permissaoAtual) {
    return (
      <div className="h-screen">
        <Carregamento texto="Aguarde..." />{' '}
      </div>
    );
  }

  return (
    <MenuPadrao
      tela={permissaoAtual.tb_telas?.PATH_TELA}
      permissoes={permissoesPaths}
    />
  );
};

export default Page;
