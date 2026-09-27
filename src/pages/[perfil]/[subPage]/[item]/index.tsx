import React, { useEffect, useContext, useMemo } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/authContexts';
import MenuPadrao from '@/components/menus/padrao';

/**
 * Rota dinâmica das telas internas (ex.: /admin/controleAcesso/perfis).
 *
 * A tela ativa é derivada DIRETAMENTE de router.query via useMemo — assim o
 * conteúdo troca imediatamente quando a URL muda (navegação por <Link> entre
 * telas do mesmo padrão de rota). O antigo fluxo guardava a permissão em estado
 * atualizado por useEffect + reescrevia a URL com window.history.replaceState,
 * o que dessincronizava o router do Next e causava "a URL muda mas a página não
 * troca, só com refresh".
 */
const Page = () => {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext);
  const { subPage, item, perfil } = router.query;

  const telaAtual =
    typeof perfil === 'string' && typeof subPage === 'string' && typeof item === 'string'
      ? `/${perfil}/${subPage}/${item}`
      : null;

  const permissoesPaths = useMemo(
    () =>
      (user?.permissoes ?? [])
        .map((p) => p.tb_telas?.PATH_TELA)
        .filter((p): p is string => !!p),
    [user],
  );

  const permissaoAtual = useMemo(
    () =>
      telaAtual && user?.permissoes
        ? user.permissoes.find((p) => p.tb_telas?.PATH_TELA === telaAtual) ?? null
        : null,
    [telaAtual, user],
  );

  // Autenticação/autorização + registro da última tela (sem reescrever a URL).
  useEffect(() => {
    if (!router.isReady || isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!telaAtual || !user.permissoes || !permissaoAtual) {
      router.replace('/naoAutorizado');
      return;
    }
    if (user.usuario) {
      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.usuario, screen: 'ultima_tela', preferences: { value: telaAtual } }),
      }).catch(() => {});
    }
  }, [router, telaAtual, user, isLoading, permissaoAtual]);

  if (isLoading || !router.isReady || !user || !permissaoAtual) {
    return <div className="h-screen bg-white dark:bg-zinc-900" />;
  }

  return (
    <MenuPadrao
      tela={permissaoAtual.tb_telas?.PATH_TELA}
      permissoes={permissoesPaths}
    />
  );
};

export default Page;
