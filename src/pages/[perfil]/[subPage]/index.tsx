import React, { useEffect, useContext, useMemo } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/authContexts';
import MenuPadrao from '@/components/menus/padrao';

/**
 * Rota dinâmica de 2 níveis (ex.: /admin/vendas). A tela ativa é derivada de
 * router.query via useMemo para que o conteúdo troque na hora que a URL muda
 * (sem depender de setState em useEffect nem reescrever a URL com history —
 * o que dessincronizava o router do Next e travava a troca de página).
 */
const Page = () => {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext);
  const { subPage, perfil } = router.query;

  const telaAtual =
    typeof perfil === 'string' && typeof subPage === 'string'
      ? `/${perfil}/${subPage}`
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
