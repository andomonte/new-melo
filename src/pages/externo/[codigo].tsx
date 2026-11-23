// Venda Externa — link fixo por filial: /externo/<codigo_filial> (1 = MANAUS, 2 = RORAIMA, 3 = RONDONIA).
// Login próprio (usuário/senha do sistema) + PIN; funciona sem internet depois do 1º acesso.
// Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const VendaExternaApp = dynamic(() => import('@/components/vendaExterna/VendaExternaApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] flex items-center justify-center text-sm text-gray-500">Carregando…</div>
  ),
});

export default function PaginaExternoFilial() {
  const router = useRouter();
  const codigo = Number(router.query.codigo);

  // Service worker: guarda a tela no aparelho para abrir SEM internet (só em produção:
  // no "next dev" os arquivos mudam a cada edição e o cache atrapalharia).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw-externo.js', { scope: '/externo' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // o que a página carregou ANTES do SW assumir (1º acesso) também precisa ficar guardado
        setTimeout(() => {
          const urls = new Set<string>([location.href]);
          for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
            try {
              const u = new URL(e.name);
              if (u.origin === location.origin && (u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/images/'))) {
                urls.add(u.href);
              }
            } catch {
              /* */
            }
          }
          reg.active?.postMessage({ tipo: 'GUARDAR', urls: Array.from(urls) });
        }, 4000);
      })
      .catch(() => {
        /* sem SW: funciona só online */
      });
  }, []);

  return (
    <>
      <Head>
        <title>Venda Externa — Melo</title>
        {Number.isFinite(codigo) && <link rel="manifest" href={`/api/externo/manifest?c=${codigo}`} />}
        <meta name="theme-color" content="#1e3a5f" />
        {/* iPhone/iPad: "Adicionar à Tela de Início" abre em tela cheia */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Venda Melo" />
        <link rel="apple-touch-icon" href="/images/externo-icon-180.png" />
      </Head>
      {router.isReady && Number.isFinite(codigo) ? (
        <VendaExternaApp codigoFilial={codigo} />
      ) : router.isReady ? (
        <div className="min-h-[100dvh] flex items-center justify-center text-sm text-red-600">Link de filial inválido.</div>
      ) : null}
    </>
  );
}
