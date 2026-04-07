import React, { useContext, useEffect, useState, useRef } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { useRouter } from 'next/router';
import Carregamento from '@/utils/carregamento';
import Image from 'next/image';
import logo from '@/../public/images/logo1.webp';

// Importações para páginas públicas
import SeparacaoPage from '@/components/corpo/separacao';
import ConferenciaPage from '@/components/corpo/conferencia';

const Page = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const jaRedirecionou = useRef(false);
  const usuarioFilialRef = useRef<string | null>(null);

  // Verificar se é uma rota pública
  const isRotaPublica =
    router.asPath === '/separacao' || router.asPath === '/conferencia';

  // Verifica se houve mudança no usuário ou filial
  useEffect(() => {
    if (isRotaPublica) return;

    if (user) {
      const identificadorAtual = `${user.usuario}-${user.filial}`;

      if (usuarioFilialRef.current !== identificadorAtual) {
        usuarioFilialRef.current = identificadorAtual;
        jaRedirecionou.current = false; // Permite um novo redirecionamento
      }
    }
  }, [user, isRotaPublica]);

  // ============================
  // REDIRECIONAMENTO (APENAS ESTA PARTE FOI TROCADA)
  // ============================
  useEffect(() => {
    if (isRotaPublica) return;
    if (!router.isReady) return;

    // Garantir que temos o usuário e as permissões carregadas
    const temPerms =
      !!user &&
      !!user.filial?.length &&
      Array.isArray(user.permissoes) &&
      user.permissoes.length > 0;
    if (!temPerms) return;

    // Rotas permitidas a partir das permissões
    const destinosPermitidos = (user.permissoes || [])
      .map((p) => p.tb_telas?.PATH_TELA)
      .filter((x): x is string => !!x);

    // 1) Prioridade: rota vinda do sessionStorage (ex.: '/vendas/novaVenda')
    let destFromStorage: string | null = null;
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem('telaAtualMelo');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string') destFromStorage = parsed;
        } catch {
          destFromStorage = null;
        }
      }
    }

    // Se veio do storage e é permitida → ir pra ela
    if (
      destFromStorage &&
      destinosPermitidos.includes(destFromStorage) &&
      router.asPath !== destFromStorage
    ) {
      jaRedirecionou.current = true;
      // não limpar aqui: a tela alvo pode limpar quando terminar de carregar
      router.replace(destFromStorage);
      return;
    }

    // Se veio do storage mas NÃO é permitida → limpar e cair no fallback
    if (destFromStorage && !destinosPermitidos.includes(destFromStorage)) {
      try {
        sessionStorage.removeItem('telaAtualMelo');
      } catch {}
    }

    // 2) Fallback: primeira rota permitida
    const destinoFallback = destinosPermitidos[0];
    if (
      destinoFallback &&
      router.asPath !== destinoFallback &&
      !jaRedirecionou.current
    ) {
      jaRedirecionou.current = true;
      router.replace(destinoFallback);
    } else if (!destinoFallback) {
      setErro(
        'Erro ao carregar permissões. Por favor, entre em contato com o suporte.',
      );
    }
  }, [router.isReady, isRotaPublica, user, router]);
  // ============================

  // Renderizar páginas públicas diretamente
  if (router.asPath === '/separacao') {
    return (
      <div className="w-screen h-screen bg-zinc-100 dark:bg-zinc-600">
        <SeparacaoPage />
      </div>
    );
  }

  if (router.asPath === '/conferencia') {
    return (
      <div className="w-screen h-screen bg-zinc-100 dark:bg-zinc-600">
        <ConferenciaPage />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-gray-100 dark:bg-zinc-900 text-center px-4">
        <div className="mb-6">
          <Image
            src={logo}
            alt="Logo Melo"
            width={150}
            height={150}
            priority
            className="mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
          {erro}
        </h1>
        <p className="text-gray-700 dark:text-gray-300">
          Tente atualizar a página ou entre em contato com o suporte.
        </p>
      </div>
    );
  }

  const texto = `CARREGANDO ${user?.perfil ?? ''}`;

  return (
    <div className="w-screen h-screen bg-zinc-100 dark:bg-zinc-600">
      <Carregamento texto={texto} />
    </div>
  );
};

export default Page;
